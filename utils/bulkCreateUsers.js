const fs = require("fs");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const pdfParse = require("pdf-parse");

const User = require("../Models/UserModel");
const { sendWhatsAppMessage } = require("../utils/Whatsapp");

// ========== CONFIGURATION MULTER ==========
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "pdf-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (path.extname(file.originalname).toLowerCase() === ".pdf") cb(null, true);
  else cb(new Error("Seuls les fichiers PDF sont acceptés"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports.uploadPDF = upload.single("pdfFile");

// ========== FONCTIONS UTILITAIRES ==========
function generateRandomPassword(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function cleanPhone(phone) {
  if (!phone) return null;
  
  // Enlever tous les caractères non numériques sauf le +
  let formatted = phone.toString().replace(/[^\d+]/g, "");
  
  // Si déjà au bon format avec +221
  if (formatted.startsWith("+221") && formatted.length >= 12) return formatted;
  
  // Si commence par 221 sans +
  if (formatted.startsWith("221") && formatted.length >= 11) return "+" + formatted;
  
  // Si c'est un numéro local sénégalais (commence par 7 ou 3 et a 9 chiffres)
  if (/^[73]\d{8}$/.test(formatted)) return "+221" + formatted;
  
  // Si c'est un numéro court sans indicatif (probable sénégalais)
  if (formatted.length === 9 && !formatted.startsWith("+")) return "+221" + formatted;
  
  // Sinon ajouter +221 par défaut si pas d'indicatif
  if (!formatted.startsWith("+")) formatted = "+221" + formatted;
  
  return formatted;
}

function parsePdfText(text) {
  console.log("🔍 Parsing du texte...");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const users = [];

  // Format réel du PDF: IDNOM(+XXX) TELEPHONEDATE ACTIONS
  // Exemple: 1LSI HOLDING(+221) 77359134413/03/20251,134
  const regex = /^(\d+)(.+?)\((\+\d{1,4})\)\s*(\d{4,15})(\d{2}\/\d{2}\/\d{4})([\d,\.]+)$/;

  for (const line of lines) {
    // Ignorer les lignes d'en-tête et de navigation
    if (
      line.includes("ID") && line.includes("Prénoms") ||
      line.includes("Numéro de téléphone") ||
      line.includes("Liste des actionnaires") ||
      line.includes("Plateforme Universal Fab") ||
      line.includes("Rechercher") ||
      line.includes("Tableau de bord") ||
      line.includes("backoffice.universalfabsn") ||
      line.includes("Universal Fab Admin") ||
      /^\d+\/\d+$/.test(line)
    ) {
      continue;
    }

    const match = line.match(regex);
    if (match) {
      const [, id, fullName, countryCode, phone, date, actionsStr] = match;
      
      // Nettoyer le nom
      const cleanName = fullName.trim();
      const nameParts = cleanName.split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      
      // Construire le numéro complet
      const fullPhone = cleanPhone(countryCode + phone);
      
      // Parser le nombre d'actions
      const actionsNumber = parseInt(actionsStr.replace(/[,\.]/g, "")) || 0;
      
      if (firstName && fullPhone && actionsNumber > 0) {
        users.push({ firstName, lastName, telephone: fullPhone, actionsNumber, dividende: 0 });
        console.log(`✓ [${id}] ${firstName} ${lastName} - ${fullPhone} - ${actionsNumber} actions`);
      }
    }
  }

  return users;
}

// ========== EXTRACTION TEXTE PDF ==========
async function extractPdfText(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(dataBuffer);
  return pdfData;
}

// ========== CONTRÔLEUR PRINCIPAL ==========
module.exports.bulkCreateUsersFromPDF = async (req, res) => {
  let pdfPath = null;

  try {
    console.log("📥 req.body:", req.body);
    console.log("📄 req.file:", req.file);

    pdfPath = req.file?.path;
    const SEND_WHATSAPP = req.body.sendWhatsapp === true || req.body.sendWhatsapp === "true";

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return res.status(400).json({ 
        success: false, 
        message: "Aucun fichier PDF fourni ou fichier introuvable." 
      });
    }

    console.log("📖 Lecture du fichier PDF...");
    const pdfData = await extractPdfText(pdfPath);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      fs.unlinkSync(pdfPath);
      return res.status(400).json({ 
        success: false, 
        message: "Impossible d'extraire le texte du PDF." 
      });
    }

    const users = parsePdfText(pdfData.text);
    
    if (!users.length) {
      fs.unlinkSync(pdfPath);
      return res.status(400).json({
        success: false,
        message: "Aucun utilisateur détecté.",
        hint: "Format attendu: ID PRENOM_NOM (+XXX) TELEPHONE DATE ACTIONS",
        sample: pdfData.text.substring(0, 1000),
      });
    }

    console.log(`\n👥 Traitement de ${users.length} utilisateurs...`);

    let created = 0, skipped = 0, errors = [];
    const createdUsers = []; // Pour stocker les utilisateurs créés avec leurs mots de passe

    // ========================================
    // ÉTAPE 1: CRÉER TOUS LES UTILISATEURS
    // ========================================
    
    for (const u of users) {
      try {
        // Vérifier si l'utilisateur existe déjà
        const exists = await User.findOne({ telephone: u.telephone });
        
        if (exists) {
          console.log(`⏭️  [${u.id}] ${u.firstName} ${u.lastName} existe déjà`);
          skipped++;
          continue;
        }

        // Générer un mot de passe aléatoire
        const password = generateRandomPassword(8);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Créer le nouvel utilisateur
        const newUser = await User.create({
          firstName: u.firstName,
          lastName: u.lastName,
          telephone: u.telephone,
          password: hashedPassword,
          actionsNumber: u.actionsNumber,
          dividende: u.dividende,
          role: "actionnaire",
        });

        created++;
        console.log(`✅ [${u.id}] ${newUser.firstName} ${newUser.lastName} créé avec succès`);

        // Stocker pour envoi WhatsApp ultérieur
        if (SEND_WHATSAPP) {
          createdUsers.push({
            id: u.id,
            user: newUser,
            password: password
          });
        }
        
      } catch (err) {
        console.error(`❌ Erreur création [${u.id}] ${u.firstName} ${u.lastName}:`, err.message);
        errors.push({ 
          id: u.id,
          user: `${u.firstName} ${u.lastName}`,
          telephone: u.telephone,
          type: "creation", 
          error: err.message 
        });
      }
    }

    // ========================================
    // ÉTAPE 2: ENVOYER LES MESSAGES PAR LOTS
    // ========================================
    
    if (SEND_WHATSAPP && createdUsers.length > 0) {
      console.log(`\n📱 Envoi de ${createdUsers.length} messages WhatsApp par lots de 20...`);
      
      const BATCH_SIZE = 20;
      const DELAY_MS = 45000; // 45 secondes
      
      // Diviser en lots
      const batches = [];
      for (let i = 0; i < createdUsers.length; i += BATCH_SIZE) {
        batches.push(createdUsers.slice(i, i + BATCH_SIZE));
      }
      
      console.log(`📦 ${batches.length} lot(s) à traiter`);
      
      // Traiter chaque lot
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchNumber = batchIndex + 1;
        
        console.log(`\n📤 Lot ${batchNumber}/${batches.length} (${batch.length} messages)...`);
        
        // Envoyer tous les messages du lot en parallèle
        const promises = batch.map(async ({ id, user, password }) => {
          try {
            await sendWhatsAppMessage(
              user.telephone,
              `Bonjour ${user.firstName},Votre compte Universal Fab a été créé.Identifiant : ${user.telephone} Mot de passe : ${password} Bienvenue sur Universal Fab! Accédez à votre compte : https://actionuniversalfab.com`);
            console.log(`   ✅ [${id}] ${user.firstName} ${user.lastName} - ${user.telephone}`);
            return { success: true, id, telephone: user.telephone };
          } catch (msgErr) {
            console.error(`   ❌ [${id}] ${user.telephone}: ${msgErr.message}`);
            errors.push({ 
              id,
              telephone: user.telephone, 
              user: `${user.firstName} ${user.lastName}`,
              type: "whatsapp", 
              error: msgErr.message 
            });
            return { success: false, id, telephone: user.telephone, error: msgErr.message };
          }
        });
        
        // Attendre que tous les messages du lot soient envoyés
        const results = await Promise.allSettled(promises);
        
        const batchSuccess = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const batchFailed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
        
        console.log(`   📊 Lot ${batchNumber}: ${batchSuccess} succès, ${batchFailed} échecs`);
        
        // Attendre 45 secondes avant le prochain lot (sauf pour le dernier)
        if (batchIndex < batches.length - 1) {
          console.log(`   ⏳ Pause de 45 secondes avant le prochain lot...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }
      
      console.log(`\n✅ Envoi WhatsApp terminé`);
    }

    // ========================================
    // ÉTAPE 3: NETTOYER ET RÉPONDRE
    // ========================================
    
    // Supprimer le fichier PDF uploadé
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    console.log("\n📊 RÉSUMÉ FINAL:");
    console.log(`   Total détecté: ${users.length}`);
    console.log(`   ✅ Créés: ${created}`);
    console.log(`   ⏭️  Ignorés (déjà existants): ${skipped}`);
    console.log(`   ❌ Erreurs: ${errors.length}`);
    if (SEND_WHATSAPP) {
      const whatsappSuccess = createdUsers.length - errors.filter(e => e.type === 'whatsapp').length;
      console.log(`   📱 WhatsApp envoyés: ${whatsappSuccess}/${createdUsers.length}`);
    }

    return res.status(201).json({
      success: true,
      message: "Traitement terminé ✅",
      data: { 
        total: users.length, 
        created, 
        skipped, 
        failed: errors.length,
        whatsappSent: SEND_WHATSAPP ? createdUsers.length - errors.filter(e => e.type === 'whatsapp').length : 0
      },
      errors: errors.length > 0 ? errors : undefined,
    });
    
  } catch (error) {
    console.error("💥 Erreur complète:", error);
    if (pdfPath && fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    
    return res.status(500).json({ 
      success: false, 
      message: "Erreur serveur", 
      error: error.message 
    });
  }
};
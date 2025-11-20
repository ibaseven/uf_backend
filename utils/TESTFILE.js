const fs = require("fs");
const multer = require("multer");
const path = require("path");
const pdfParse = require("pdf-parse");

const User = require("../Models/UserModel");

// ========== CONFIGURATION MULTER (identique au BulkUserController) ==========
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "preview-pdf-" + uniqueSuffix + path.extname(file.originalname));
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
function cleanPhone(phone) {
  if (!phone) return null;
  
  let formatted = phone.toString().replace(/[^\d+]/g, "");
  
  if (formatted.startsWith("+221") && formatted.length >= 12) return formatted;
  if (formatted.startsWith("221") && formatted.length >= 11) return "+" + formatted;
  if (/^[73]\d{8}$/.test(formatted)) return "+221" + formatted;
  if (formatted.length === 9 && !formatted.startsWith("+")) return "+221" + formatted;
  if (!formatted.startsWith("+")) formatted = "+221" + formatted;
  
  return formatted;
}

function parsePdfText(text) {
  console.log("🔍 Preview - Parsing du texte...");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const users = [];
  const errors = [];

  const regex = /^(\d+)(.+?)\((\+\d{1,4})\)\s*(\d{4,15})(\d{2}\/\d{2}\/\d{4})([\d,\.]+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
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
      
      const cleanName = fullName.trim();
      const nameParts = cleanName.split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      
      const fullPhone = cleanPhone(countryCode + phone);
      const actionsNumber = parseInt(actionsStr.replace(/[,\.]/g, "")) || 0;
      
      // Validation
      const validationErrors = [];
      if (!firstName) validationErrors.push("Prénom manquant");
      if (!fullPhone) validationErrors.push("Téléphone invalide");
      if (actionsNumber <= 0) validationErrors.push("Nombre d'actions invalide");
      if (fullPhone && fullPhone.length < 10) validationErrors.push("Téléphone trop court");
      
      if (validationErrors.length > 0) {
        errors.push({
          lineNumber: i + 1,
          id: parseInt(id),
          rawLine: line.substring(0, 80) + (line.length > 80 ? "..." : ""),
          errors: validationErrors
        });
      } else {
        users.push({
          id: parseInt(id),
          firstName,
          lastName,
          telephone: fullPhone,
          actionsNumber,
          dateInscription: date,
        });
      }
    } else {
      // Ligne non parsée (potentiellement une erreur)
      if (line.length > 10 && line.match(/^\d+/)) {
        errors.push({
          lineNumber: i + 1,
          rawLine: line.substring(0, 80) + (line.length > 80 ? "..." : ""),
          errors: ["Format de ligne non reconnu"]
        });
      }
    }
  }

  return { users, parsingErrors: errors };
}

async function extractPdfText(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(dataBuffer);
  return pdfData;
}

// ========== CONTRÔLEUR DE PREVIEW ==========
module.exports.previewPdfImport = async (req, res) => {
  let pdfPath = null;

  try {
    console.log("\n📋 ========== PREVIEW MODE ==========");
    console.log("📥 Fichier reçu:", req.file?.originalname);

    pdfPath = req.file?.path;

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return res.status(400).json({ 
        success: false, 
        message: "Aucun fichier PDF fourni ou fichier introuvable." 
      });
    }

    // 1. Extraction du PDF
    console.log("📖 Extraction du PDF...");
    const pdfData = await extractPdfText(pdfPath);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      fs.unlinkSync(pdfPath);
      return res.status(400).json({ 
        success: false, 
        message: "Impossible d'extraire le texte du PDF." 
      });
    }

    console.log(`📄 PDF: ${pdfData.numpages} pages, ${pdfData.text.length} caractères`);

    // 2. Parsing
    const { users, parsingErrors } = parsePdfText(pdfData.text);
    
    if (!users.length && !parsingErrors.length) {
      fs.unlinkSync(pdfPath);
      return res.status(400).json({
        success: false,
        message: "Aucun utilisateur détecté dans le PDF.",
        hint: "Vérifiez le format du PDF. Format attendu: IDNOM(+XXX) TELEPHONEDATEACTIONS"
      });
    }

    console.log(`✅ ${users.length} utilisateurs détectés`);
    console.log(`⚠️  ${parsingErrors.length} erreurs de parsing`);

    // 3. Vérifier les doublons dans le fichier
    const phoneMap = {};
    const duplicatesInFile = [];
    
    users.forEach(u => {
      if (phoneMap[u.telephone]) {
        duplicatesInFile.push({
          telephone: u.telephone,
          users: [phoneMap[u.telephone], { id: u.id, firstName: u.firstName, lastName: u.lastName }]
        });
      } else {
        phoneMap[u.telephone] = { id: u.id, firstName: u.firstName, lastName: u.lastName };
      }
    });

    // 4. Vérifier les utilisateurs existants dans la base de données
    console.log("🔍 Vérification dans la base de données...");
    const existingUsers = [];
    
    for (const u of users) {
      const exists = await User.findOne({ telephone: u.telephone });
      if (exists) {
        existingUsers.push({
          telephone: u.telephone,
          pdfUser: { id: u.id, firstName: u.firstName, lastName: u.lastName },
          dbUser: { 
            firstName: exists.firstName, 
            lastName: exists.lastName,
            actionsNumber: exists.actionsNumber 
          }
        });
      }
    }

    console.log(`📊 ${existingUsers.length} utilisateurs existent déjà`);

    // 5. Calculer les statistiques
    const totalActions = users.reduce((sum, u) => sum + u.actionsNumber, 0);
    const newUsers = users.filter(u => !existingUsers.find(e => e.telephone === u.telephone));
    
    // Statistiques par pays
    const countryStats = {};
    users.forEach(u => {
      const country = u.telephone.substring(0, 4); // Ex: +221
      countryStats[country] = (countryStats[country] || 0) + 1;
    });

    // 6. Nettoyer le fichier uploadé
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    // 7. Préparer la réponse détaillée
    console.log("✅ Preview terminé\n");

    return res.status(200).json({
      success: true,
      message: "Analyse du PDF terminée ✅",
      preview: {
        // Résumé
        summary: {
          totalDetected: users.length,
          newUsers: newUsers.length,
          existingUsers: existingUsers.length,
          totalActions,
          parsingErrors: parsingErrors.length,
          duplicatesInFile: duplicatesInFile.length,
        },
        
        // Statistiques
        statistics: {
          pdfPages: pdfData.numpages,
          pdfTextLength: pdfData.text.length,
          countryDistribution: countryStats,
          averageActionsPerUser: users.length > 0 ? Math.round(totalActions / users.length) : 0,
        },

        // Échantillons (premiers et derniers)
        samples: {
          first5: users.slice(0, 5).map(u => ({
            id: u.id,
            name: `${u.firstName} ${u.lastName}`,
            telephone: u.telephone,
            actions: u.actionsNumber,
            status: existingUsers.find(e => e.telephone === u.telephone) ? "EXISTS" : "NEW"
          })),
          last5: users.slice(-5).map(u => ({
            id: u.id,
            name: `${u.firstName} ${u.lastName}`,
            telephone: u.telephone,
            actions: u.actionsNumber,
            status: existingUsers.find(e => e.telephone === u.telephone) ? "EXISTS" : "NEW"
          })),
        },

        // Problèmes détectés
        issues: {
          parsingErrors: parsingErrors.length > 0 ? parsingErrors : undefined,
          duplicatesInFile: duplicatesInFile.length > 0 ? duplicatesInFile : undefined,
          existingUsers: existingUsers.length > 0 ? existingUsers.slice(0, 10) : undefined, // Max 10 pour pas surcharger
        },

        // Recommandations
        recommendations: generateRecommendations({
          totalDetected: users.length,
          newUsers: newUsers.length,
          existingUsers: existingUsers.length,
          parsingErrors: parsingErrors.length,
          duplicatesInFile: duplicatesInFile.length,
        }),
      }
    });
  } catch (error) {
    console.error("💥 Erreur dans le preview:", error);
    if (pdfPath && fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    
    return res.status(500).json({ 
      success: false, 
      message: "Erreur lors de l'analyse du PDF", 
      error: error.message 
    });
  }
};

// ========== GÉNÉRATION DE RECOMMANDATIONS ==========
function generateRecommendations(stats) {
  const recommendations = [];

  if (stats.parsingErrors > 0) {
    recommendations.push({
      type: "ERROR",
      icon: "❌",
      message: `${stats.parsingErrors} ligne(s) n'ont pas pu être parsées. Vérifiez le format du PDF.`
    });
  }

  if (stats.duplicatesInFile > 0) {
    recommendations.push({
      type: "WARNING",
      icon: "⚠️",
      message: `${stats.duplicatesInFile} numéro(s) en doublon détecté(s) dans le PDF. Seul le premier sera importé.`
    });
  }

  if (stats.existingUsers > 0) {
    recommendations.push({
      type: "INFO",
      icon: "ℹ️",
      message: `${stats.existingUsers} utilisateur(s) existent déjà et seront ignorés lors de l'import.`
    });
  }

  if (stats.newUsers === 0) {
    recommendations.push({
      type: "WARNING",
      icon: "⚠️",
      message: "Aucun nouvel utilisateur ne sera créé. Tous les utilisateurs existent déjà."
    });
  } else {
    recommendations.push({
      type: "SUCCESS",
      icon: "✅",
      message: `${stats.newUsers} nouvel(aux) utilisateur(s) sera/seront créé(s).`
    });
  }

  if (stats.parsingErrors === 0 && stats.duplicatesInFile === 0) {
    recommendations.push({
      type: "SUCCESS",
      icon: "🎉",
      message: "Le PDF est propre et prêt pour l'import !"
    });
  }

  return recommendations;
}
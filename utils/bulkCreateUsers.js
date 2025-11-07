const fs = require("fs");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const pdfParse = require("pdf-parse"); // ✅ Correction ici - sans .default

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
  let formatted = phone.toString().replace(/[^\d+]/g, "");
  if (formatted.startsWith("+221")) return formatted;
  if (formatted.startsWith("221")) return "+" + formatted;
  if (!formatted.startsWith("+")) formatted = "+221" + formatted;
  return formatted;
}

function parsePdfText(text) {
  console.log("🔍 Parsing du texte...");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const users = [];

  const regex = /^(\d+)\s+(.+?)\s+\(\+\d{1,4}\)\s*(\d{7,15})\s+\d{2}\/\d{2}\/\d{4}\s+([\d,\.]+)$/;

  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const [, id, fullName, phone, actionsStr] = match;
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      const actionsNumber = parseInt(actionsStr.replace(/[,\.]/g, ""));
      users.push({ firstName, lastName, telephone: cleanPhone(phone), actionsNumber, dividende: 0 });
      console.log(`✓ Trouvé: ${firstName} ${lastName} - ${cleanPhone(phone)} - ${actionsNumber} actions`);
    }
  }

  return users;
}

// ========== EXTRACTION TEXTE PDF ==========
async function extractPdfText(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(dataBuffer); // ✅ Utilisation correcte
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
      return res.status(400).json({ success: false, message: "Aucun fichier PDF fourni ou fichier introuvable." });
    }

    console.log("📖 Lecture du fichier PDF...");
    const pdfData = await extractPdfText(pdfPath);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      fs.unlinkSync(pdfPath);
      return res.status(400).json({ success: false, message: "Impossible d'extraire le texte du PDF." });
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

    console.log(`👥 ${users.length} utilisateurs détectés`);

    let created = 0, skipped = 0, errors = [];

    for (const u of users) {
      try {
        const exists = await User.findOne({ telephone: u.telephone });
        if (exists) { skipped++; continue; }

        const password = generateRandomPassword(8);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

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

        if (SEND_WHATSAPP) {
          try {
            await sendWhatsAppMessage(
              newUser.telephone,
              `👋 Bonjour ${newUser.firstName},\n\nVotre compte Dioko a été créé.\n📱 Identifiant : ${newUser.telephone}\n🔐 Mot de passe : ${password}`
            );
          } catch (msgErr) {
            console.error(`❌ WhatsApp KO:`, msgErr.message);
            errors.push({ telephone: newUser.telephone, type: "whatsapp", error: msgErr.message });
          }
        }
      } catch (err) {
        console.error("❌ Erreur création:", err.message);
        errors.push({ user: `${u.firstName} ${u.lastName}`, type: "creation", error: err.message });
      }
    }

    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    return res.status(201).json({
      success: true,
      message: "Traitement terminé ✅",
      data: { total: users.length, created, skipped, failed: errors.length },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("💥 Erreur complète:", error);
    if (pdfPath && fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    return res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
  }
};
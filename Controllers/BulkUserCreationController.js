const User = require("../Models/UserModel");
const bcrypt = require("bcryptjs");
const { sendWhatsAppMessage } = require("../utils/Whatsapp");
function generateRandomPassword(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
module.exports.createBulkUsersWithRandomPasswords = async (req, res) => {
  try {
    const { users } = req.body; // Array of user objects
    const adminId = req.user.id;
    const admin = await User.findById(adminId);
    if (!admin || (!admin.isTheOwner && !admin.isTheSuperAdmin)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        message: "Veuillez fournir un tableau d'utilisateurs à créer"
      });
    }
    const siteUrl = "https://actionuniversalfab.com/";
    const whatsappGroupUrl = "https://chat.whatsapp.com/F90GE9Dblgx2eSdlqCQeTt";
    const createdUsers = [];
    const errors = [];
    for (const userData of users) {
      try {
        const { telephone, firstName, lastName, email, role = "actionnaire", actionsNumber = 0 } = userData;
        if (!telephone || !firstName || !lastName) {
          errors.push({
            telephone: telephone || "N/A",
            error: "Téléphone, prénom et nom sont requis"
          });
          continue;
        }
        const existingUser = await User.findOne({ telephone });
        if (existingUser) {
          errors.push({
            telephone,
            error: "Ce numéro de téléphone existe déjà"
          });
          continue;
        }
        const randomPassword = generateRandomPassword(10);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        const newUser = await User.create({
          telephone,
          firstName,
          lastName,
          email: email || undefined,
          password: hashedPassword,
          role,
          actionsNumber,
          dividende: 0,
          isBlocked: false
        });

        // Préparer le message WhatsApp
        const welcomeMessage = `Bienvenue chez Universall Fab ! Bonjour ${firstName} ${lastName}, Votre compte a été créé avec succès. Numéro: ${telephone} Mot de passe: ${randomPassword} Site web: ${siteUrl} Groupe WhatsApp: ${whatsappGroupUrl} Pour votre sécurité, veuillez changer votre mot de passe lors de votre première connexion. Cordialement, L'équipe Universall Fab`;

        // Envoyer le message WhatsApp
        try {
          await sendWhatsAppMessage(telephone, welcomeMessage);

          createdUsers.push({
            _id: newUser._id,
            telephone,
            firstName,
            lastName,
            email,
            password: randomPassword, // Pour l'admin seulement
            role,
            actionsNumber,
            messageSent: true
          });
        } catch (whatsappError) {
          console.error(`Erreur envoi WhatsApp pour ${telephone}:`, whatsappError);

          createdUsers.push({
            _id: newUser._id,
            telephone,
            firstName,
            lastName,
            email,
            password: randomPassword,
            role,
            actionsNumber,
            messageSent: false,
            whatsappError: "Échec de l'envoi WhatsApp"
          });
        }

      } catch (userError) {
        console.error("Erreur création utilisateur:", userError);
        errors.push({
          telephone: userData.telephone || "N/A",
          error: userError.message || "Erreur lors de la création"
        });
      }
    }

    return res.status(201).json({
      message: `${createdUsers.length} utilisateur(s) créé(s) avec succès`,
      success: true,
      created: createdUsers,
      errors: errors.length > 0 ? errors : undefined,
      totalRequested: users.length,
      totalCreated: createdUsers.length,
      totalErrors: errors.length,
      siteUrl,
      whatsappGroupUrl
    });

  } catch (error) {
    console.error("Erreur serveur:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la création des utilisateurs",
      error: error.message
    });
  }
};

// Controller pour créer un seul utilisateur avec mot de passe aléatoire
module.exports.createSingleUserWithRandomPassword = async (req, res) => {
  try {
    const { telephone, firstName, lastName, email, role = "actionnaire", actionsNumber = 0 } = req.body;
    const adminId = req.user.id;

    // Vérifier que l'utilisateur connecté est admin
    const admin = await User.findById(adminId);
    if (!admin || (!admin.isTheOwner && !admin.isTheSuperAdmin)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    // Validation
    if (!telephone || !firstName || !lastName) {
      return res.status(400).json({
        message: "Téléphone, prénom et nom sont requis"
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ telephone });
    if (existingUser) {
      return res.status(400).json({
        message: "Ce numéro de téléphone existe déjà"
      });
    }

    const siteUrl = "https://actionuniversalfab.com/";
    const whatsappGroupUrl = "https://chat.whatsapp.com/LJ5ao94sDYPDyYzVsqU49r";

    // Générer un mot de passe aléatoire
    const randomPassword = generateRandomPassword(10);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    // Créer l'utilisateur
    const newUser = await User.create({
      telephone,
      firstName,
      lastName,
      email: email || undefined,
      password: hashedPassword,
      role,
      actionsNumber,
      dividende: 0,
      isBlocked: false
    });

    // Préparer le message WhatsApp
    const welcomeMessage = `Bienvenue chez Universall Fab ! Bonjour ${firstName} ${lastName}, Votre compte a été créé avec succès. Numéro: ${telephone} Mot de passe: ${randomPassword} Site web: ${siteUrl} Groupe WhatsApp: ${whatsappGroupUrl} Pour votre sécurité, veuillez changer votre mot de passe lors de votre première connexion. Cordialement, L'équipe Universall Fab`;

    // Envoyer le message WhatsApp
    let messageSent = true;
    let whatsappError = null;

    try {
      await sendWhatsAppMessage(telephone, welcomeMessage);
    } catch (error) {
      console.error("Erreur envoi WhatsApp:", error);
      messageSent = false;
      whatsappError = "Échec de l'envoi WhatsApp";
    }

    return res.status(201).json({
      message: "Utilisateur créé avec succès",
      success: true,
      user: {
        _id: newUser._id,
        telephone,
        firstName,
        lastName,
        email,
        password: randomPassword, // Pour l'admin seulement
        role,
        actionsNumber,
        messageSent,
        whatsappError
      },
      siteUrl,
      whatsappGroupUrl
    });

  } catch (error) {
    console.error("Erreur serveur:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la création de l'utilisateur",
      error: error.message
    });
  }
};

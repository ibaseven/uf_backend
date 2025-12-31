const User = require("../Models/UserModel");
const { sendWhatsAppMessage } = require("../utils/Whatsapp");
const cron = require("node-cron");

/**
 * Fonction pour envoyer l'invitation WhatsApp aux nouveaux actionnaires
 * qui ont acheté des actions mais n'ont pas encore reçu l'invitation
 */
const sendWhatsAppInvitationToNewActionnaires = async () => {
  try {
    console.log("\n🔍 Recherche des nouveaux actionnaires...");

    // Trouver les actionnaires qui ont des actions (actionsNumber >= 5)
    // mais qui n'ont pas encore reçu l'invitation WhatsApp
    // Exclure le propriétaire (isTheOwner = true)
    const newActionnaires = await User.find({
      role: "actionnaire",
      actionsNumber: { $gte: 5 }, // A au moins 5 actions
      whatsAppInvitationSent: false, // N'a pas encore reçu l'invitation
      isTheOwner: false // Exclure le propriétaire
    });

    if (!newActionnaires || newActionnaires.length === 0) {
      console.log("✅ Aucun nouvel actionnaire à inviter");
      return {
        success: true,
        message: "Aucun nouvel actionnaire à inviter",
        total: 0
      };
    }

    console.log(`📋 ${newActionnaires.length} nouvel(s) actionnaire(s) trouvé(s)`);

    const results = {
      total: newActionnaires.length,
      success: 0,
      failed: 0,
      errors: []
    };

    // Envoyer l'invitation à chaque nouvel actionnaire
    for (const actionnaire of newActionnaires) {
      try {
        // Vérifier que l'actionnaire a un numéro de téléphone
        if (!actionnaire.telephone) {
          results.failed++;
          results.errors.push({
            user: `${actionnaire.firstName} ${actionnaire.lastName}`,
            reason: "Numéro de téléphone manquant"
          });
          continue;
        }

        // Message d'invitation personnalisé
        const message = `Bienvenue ${actionnaire.firstName} ${actionnaire.lastName} ! 🎉
Félicitations pour votre investissement en tant qu'actionnaire d'Universal Fab !
Vous avez actuellement ${actionnaire.actionsNumber} action${actionnaire.actionsNumber > 1 ? 's' : ''}.
📱 Rejoignez notre groupe WhatsApp des actionnaires :
https://chat.whatsapp.com/LJ5ao94sDYPDyYzVsqU49r
Restez connecté pour recevoir toutes les actualités et mises à jour importantes.
Cordialement,
L'équipe Universall Fab`;

        // Envoyer le message WhatsApp
        await sendWhatsAppMessage(actionnaire.telephone, message);

        // Marquer l'invitation comme envoyée
        actionnaire.whatsAppInvitationSent = true;
        await actionnaire.save();

        results.success++;
        console.log(`✅ Invitation envoyée à ${actionnaire.firstName} ${actionnaire.lastName} (${actionnaire.telephone})`);

      } catch (error) {
        results.failed++;
        results.errors.push({
          user: `${actionnaire.firstName} ${actionnaire.lastName}`,
          telephone: actionnaire.telephone,
          reason: error.message
        });
        console.error(`❌ Erreur pour ${actionnaire.firstName} ${actionnaire.lastName}:`, error.message);
      }
    }

    console.log(`\n🎉 Invitations terminées - Succès: ${results.success}, Échecs: ${results.failed}`);

    return {
      success: true,
      message: "Invitations envoyées",
      results
    };

  } catch (error) {
    console.error("❌ Erreur lors de l'envoi des invitations:", error);
    return {
      success: false,
      message: "Erreur lors de l'envoi des invitations",
      error: error.message
    };
  }
};

/**
 * Controller pour déclencher manuellement l'envoi des invitations
 */
module.exports.sendInvitations = async (req, res) => {
  try {
    // Vérifier que l'utilisateur connecté est le propriétaire
    if (!req.user || req.user.isTheOwner !== true) {
      return res.status(403).json({
        message: "Seul le propriétaire peut déclencher l'envoi des invitations WhatsApp"
      });
    }

    const result = await sendWhatsAppInvitationToNewActionnaires();

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    console.error("Erreur:", error);
    return res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
};

/**
 * Fonction pour initialiser le cron job
 * Vérifie toutes les 20 heures s'il y a de nouveaux actionnaires à inviter
 */
module.exports.initWhatsAppInvitationCron = () => {
  // Cron job qui s'exécute toutes les 20 heures
   const cronSchedule = "46 20 * * *";
 // Toutes les 20 heures

  const task = cron.schedule(cronSchedule, async () => {
    console.log("\n⏰ Cron Job - Vérification des nouveaux actionnaires...");
    await sendWhatsAppInvitationToNewActionnaires();
  });

  console.log("✅ Cron job d'invitation WhatsApp initialisé (toutes les 20 heures)");

  return task;
};

/**
 * Envoyer l'invitation à un actionnaire spécifique
 */
module.exports.sendInvitationToActionnaire = async (req, res) => {
  try {
    const { userId } = req.params;

    const actionnaire = await User.findById(userId);

    if (!actionnaire) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    if (actionnaire.role !== "actionnaire") {
      return res.status(400).json({
        message: "Cet utilisateur n'est pas un actionnaire"
      });
    }

    if (!actionnaire.telephone) {
      return res.status(400).json({
        message: "Numéro de téléphone manquant pour cet utilisateur"
      });
    }

    if (actionnaire.actionsNumber < 5) {
      return res.status(400).json({
        message: "L'actionnaire doit avoir au minimum 5 actions pour recevoir l'invitation"
      });
    }

    if (actionnaire.isTheOwner === true) {
      return res.status(400).json({
        message: "Le propriétaire ne peut pas recevoir d'invitation"
      });
    }

    // Message d'invitation personnalisé
    const message = `Bienvenue ${actionnaire.firstName} ${actionnaire.lastName} ! 🎉

Félicitations pour votre investissement en tant qu'actionnaire d'Universal Fab !

Vous avez actuellement ${actionnaire.actionsNumber} action${actionnaire.actionsNumber > 1 ? 's' : ''}.

📱 Rejoignez notre groupe WhatsApp des actionnaires :
https://chat.whatsapp.com/LJ5ao94sDYPDyYzVsqU49r

🌐 Accédez à votre espace actionnaire :
https://actionuniversalfab.com/

Restez connecté pour recevoir toutes les actualités et mises à jour importantes.

Cordialement,
L'équipe Universall Fab`;

    // Envoyer le message WhatsApp
    await sendWhatsAppMessage(actionnaire.telephone, message);

    // Marquer l'invitation comme envoyée
    actionnaire.whatsAppInvitationSent = true;
    await actionnaire.save();

    console.log(`✅ Invitation envoyée à ${actionnaire.firstName} ${actionnaire.lastName}`);

    return res.status(200).json({
      message: "Invitation envoyée avec succès",
      user: {
        nom: `${actionnaire.firstName} ${actionnaire.lastName}`,
        telephone: actionnaire.telephone,
        actionsNumber: actionnaire.actionsNumber
      }
    });

  } catch (error) {
    console.error("Erreur lors de l'envoi de l'invitation:", error);
    return res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
};

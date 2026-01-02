const User = require("../Models/UserModel");
const { sendWhatsAppMessage, sendSMSMessage } = require("../utils/Whatsapp");

const divideInBatches = (array, batchSize) => {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports.sendPasswordsToActionnaires = async (req, res) => {
  try {
    const actionnaires = await User.find({ role: "actionnaire" });

    if (!actionnaires.length) {
      return res.status(404).json({ message: "Aucun actionnaire trouvé" });
    }

    const BATCH_SIZE = 10;
    const DELAY = 5 * 60 * 1000; // 5 minutes en millisecondes

    // Liste des indicatifs pour l'envoi par SMS
    const SMS_COUNTRY_CODES = [
      '+221', // Sénégal
      '+223', // Mali
      '+224', // Guinée
      '+225', // Côte d'Ivoire
      '+226', // Burkina Faso
      '+227', // Niger
      '+228', // Togo
      '+229', // Bénin
      '+245', // Guinée-Bissau
      '+243'  // RDC
    ];

    const batches = divideInBatches(actionnaires, BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      console.log(`Envoi du lot ${i + 1} sur ${batches.length} (${batches[i].length} actionnaires)...`);

      await Promise.all(
        batches[i].map(async (user) => {
          const message = `Bonjour cher(e) actionnaire,
Pour accéder à votre espace actionnaire, utilisez votre mot de passe actuel ou réinitialisez-le via "Mot de passe oublié" avec votre numéro : ${user.telephone}
Site : https://actionuniversalfab.com/
Groupe WhatsApp : https://chat.whatsapp.com/LJ5ao94sDYPDyYzVsqU49r
Cordialement,
L'équipe Universal Fab`;

          // Vérifier si le numéro commence par un des indicatifs SMS
          const isSMSCountry = SMS_COUNTRY_CODES.some(code => 
            user.telephone.startsWith(code)
          );

          if (isSMSCountry) {
            await sendSMSMessage(user.telephone, message);
            console.log(`✅ SMS envoyé à ${user.firstName} ${user.lastName} (${user.telephone})`);
          } else {
            await sendWhatsAppMessage(user.telephone, message);
            console.log(`✅ WhatsApp envoyé à ${user.firstName} ${user.lastName} (${user.telephone})`);
          }
        })
      );

      // Pause de 5 minutes sauf pour le dernier lot
      if (i < batches.length - 1) {
        console.log(`⏳ Pause de 5 minutes avant le prochain lot...`);
        await sleep(DELAY);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Envoi des messages terminé par lot de 10",
      total: actionnaires.length,
      lots: batches.length
    });

  } catch (error) {
    console.error("Erreur lors de l'envoi des messages:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Envoyer le mot de passe à un actionnaire spécifique
 */
module.exports.sendPasswordToActionnaire = async (req, res) => {
  try {
    const { userId } = req.params;

    // Récupérer l'utilisateur
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



    // Générer un nouveau mot de passe simple
    const newPassword = generateSimplePassword();

    // Hasher le mot de passe avant de le sauvegarder
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Sauvegarder le mot de passe hashé dans la base de données
    actionnaire.password = hashedPassword;
    actionnaire.whatsAppInvitationSent = true; // Marquer l'invitation comme envoyée
    await actionnaire.save();

    // Message WhatsApp personnalisé
    const message = `Bonjour ${actionnaire.firstName} ${actionnaire.lastName},

Votre nouveau mot de passe a été modifié avec succès.

🔐 Nouveau mot de passe : ${newPassword}

Veuillez conserver ces informations en lieu sûr.

📱 Rejoignez notre groupe WhatsApp :
https://chat.whatsapp.com/LJ5ao94sDYPDyYzVsqU49r

🌐 Accédez à votre espace actionnaire :
https://actionuniversalfab.com/

Pour toute question, n'hésitez pas à nous contacter.

Cordialement,
L'équipe Universall Fab`;

    // Envoyer le message WhatsApp
    await sendWhatsAppMessage(actionnaire.telephone, message);

    console.log(`✅ Mot de passe envoyé à ${actionnaire.firstName} ${actionnaire.lastName} - Nouveau mot de passe: ${newPassword}`);

    return res.status(200).json({
      message: "Mot de passe envoyé avec succès",
      user: {
        nom: `${actionnaire.firstName} ${actionnaire.lastName}`,
        telephone: actionnaire.telephone,
        nouveauMotDePasse: newPassword
      }
    });

  } catch (error) {
    console.error("Erreur lors de l'envoi du mot de passe:", error);
    return res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
};

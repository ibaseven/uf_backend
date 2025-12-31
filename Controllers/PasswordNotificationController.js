const User = require("../Models/UserModel");
const { sendWhatsAppMessage } = require("../utils/Whatsapp");
const bcrypt = require("bcryptjs");

/**
 * Fonction utilitaire pour générer un mot de passe simple de 8 caractères
 * Format: 4 lettres + 4 chiffres (ex: abcd1234)
 */
const generateSimplePassword = () => {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';

  let password = '';

  // Ajouter 4 lettres
  for (let i = 0; i < 4; i++) {
    password += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  // Ajouter 4 chiffres
  for (let i = 0; i < 4; i++) {
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return password;
};

/**
 * Fonction utilitaire pour diviser un tableau en lots
 */
const divideInBatches = (array, batchSize) => {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
};

/**
 * Fonction utilitaire pour ajouter un délai
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Envoyer les nouveaux mots de passe à tous les actionnaires via WhatsApp
 * Envoi par lots de 20 avec délai entre chaque lot
 */
module.exports.sendPasswordsToActionnaires = async (req, res) => {
  try {
    // Récupérer tous les utilisateurs avec le rôle "actionnaire" et minimum 5 actions
    const actionnaires = await User.find({
      role: "actionnaire",
    });

    if (!actionnaires || actionnaires.length === 0) {
      return res.status(404).json({
        message: "Aucun actionnaire avec minimum 5 actions trouvé dans la base de données"
      });
    }

    const BATCH_SIZE = 20;
    const DELAY_BETWEEN_BATCHES = 3000; // 3 secondes entre chaque lot

    const results = {
      total: actionnaires.length,
      success: 0,
      failed: 0,
      errors: []
    };

    // Diviser les actionnaires en lots de 20
    const batches = divideInBatches(actionnaires, BATCH_SIZE);
    //console.log(`📦 Total: ${actionnaires.length} actionnaires divisés en ${batches.length} lot(s) de ${BATCH_SIZE}`);

    // Traiter chaque lot
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n🔄 Traitement du lot ${batchIndex + 1}/${batches.length} (${batch.length} actionnaires)...`);

      // Traiter tous les actionnaires du lot en parallèle
      const batchPromises = batch.map(async (actionnaire) => {
        try {
          // Vérifier que l'utilisateur a un téléphone
          if (!actionnaire.telephone) {
            results.failed++;
            results.errors.push({
              user: `${actionnaire.firstName} ${actionnaire.lastName}`,
              reason: "Numéro de téléphone manquant"
            });
            return;
          }

          // Vérifier que l'actionnaire a au minimum 5 actions
          

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

          results.success++;
          console.log(`✅ Mot de passe envoyé à ${actionnaire.firstName} ${actionnaire.lastName} (${actionnaire.telephone}) - Nouveau mot de passe: ${newPassword}`);

        } catch (error) {
          results.failed++;
          results.errors.push({
            user: `${actionnaire.firstName} ${actionnaire.lastName}`,
            telephone: actionnaire.telephone,
            reason: error.message
          });
          console.error(`❌ Erreur pour ${actionnaire.firstName} ${actionnaire.lastName}:`, error.message);
        }
      });

      // Attendre que tous les envois du lot soient terminés
      await Promise.all(batchPromises);

      //console.log(`✅ Lot ${batchIndex + 1}/${batches.length} terminé - Succès: ${results.success}, Échecs: ${results.failed}`);

      // Ajouter un délai avant le prochain lot (sauf pour le dernier)
      if (batchIndex < batches.length - 1) {
        console.log(`⏳ Pause de ${DELAY_BETWEEN_BATCHES / 3000} secondes avant le prochain lot...`);
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }

    //console.log(`\n🎉 Envoi terminé - Total: ${results.total}, Succès: ${results.success}, Échecs: ${results.failed}`);

    // Réponse avec le résumé
    return res.status(200).json({
      success:true,
      message: "Envoi des mots de passe terminé",
      results: {
        total: results.total,
        lots: batches.length,
        succès: results.success,
        échecs: results.failed,
        erreurs: results.errors
      }
    });

  } catch (error) {
    console.error("Erreur lors de l'envoi des mots de passe:", error);
    return res.status(500).json({
      message: "Erreur serveur lors de l'envoi des mots de passe",
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

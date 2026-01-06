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
module.exports.sendPasswordsToActionnairesWhatsApp = async (req, res) => {
  try {
    // Liste des numéros à contacter
    const contactsWhatsApp = [
      { nom: "Ba Mouhamadoumoustapha", telephone: "+221784463441" },
      { nom: "fall toure Abdou", telephone: "+00393515914558" },
      { nom: "Sallah Saikh", telephone: "+2203688797" },
      { nom: "ceesay Omar", telephone: "+2207258831" },
      { nom: "DIOUF POUYE Maïmouna", telephone: "+33768194727" },
      { nom: "KOPGUEP KOPGUEP ANITA", telephone: "+237699459901" },
      { nom: "Tounkap Stephane wandji", telephone: "+237620066736" },
      { nom: "NGUIDJOL ANDRE YOANN MBIMBE", telephone: "+242044332997" },
      { nom: "spse TCHANQUE YANGO", telephone: "+237699582683" },
      { nom: "Tchapnga Fideline Yackson", telephone: "+237676015501" },
      { nom: "Nitchogna Barnabé Tchebe", telephone: "+237679884338" },
      { nom: "KODINDO JULES DEMBA", telephone: "+5816681852" },
      { nom: "EVELINE KODINDO NAINLA", telephone: "+15816688782" },
      { nom: "NGUEYEM YVAN", telephone: "+237659341046" },
      { nom: "ahmadou bamba Diagne", telephone: "+0033758719105" },
      { nom: "AMEGAN Afuwa", telephone: "+13176791586" },
      { nom: "Diop Mamadou", telephone: "+212619869828" },
      { nom: "DIAGNE Aissatou", telephone: "+436765086260" },
      { nom: "Ba Mariem", telephone: "+22241204324" },
      { nom: "Fall Oumou", telephone: "+22246701879" },
      { nom: "Mawousi FRANKLIN Akouete", telephone: "+33753636190" },
      { nom: "BALOUKI EGLOUDJARE", telephone: "+15145500830" },
      { nom: "Di Tata", telephone: "+14389897795" },
      { nom: "Tossoukpe Hunlede Ayele", telephone: "+14184472237" },
      { nom: "Njoba Dieng Lo N'deye", telephone: "+33605778164" },
      { nom: "TOULASSI Koffi", telephone: "+33629237868" },
      { nom: "Agbeli Tapoayi Theo", telephone: "+13092922068" },
      { nom: "sow Khady", telephone: "+014503300862" },
      { nom: "FATOUMATA BINETOU DIOP", telephone: "+33641998803" },
      { nom: "DIAMBAR SECK PAPA", telephone: "+393455855866" },
      { nom: "MBALLO AMADOU", telephone: "+33744244639" },
      { nom: "El Hassen Zeidane", telephone: "+22236357435" },
      { nom: "wade Ahmethtidiane", telephone: "+966542917489" },
      { nom: "Diarra Diakhoumpa Mame", telephone: "+33762444465" },
      { nom: "Mbayealiounendaw", telephone: "+22244225190" },
      { nom: "CEESAY HAKIM", telephone: "+2207201467" },
      { nom: "CEESAY MODOU", telephone: "+2203635652" },
      { nom: "sallah Ousman", telephone: "+2202251446" },
      { nom: "ceesay Mariama", telephone: "+2207789344" },
      { nom: "ceesay Abdoulie", telephone: "+2203376033" },
      { nom: "Sene Abdoulaye", telephone: "+393484463850" },
      { nom: "Abdoulie", telephone: "+2207066141" },
      { nom: "Kane Ameth", telephone: "+12639992300" },
      { nom: "ndiaye Suzanne", telephone: "+447898787663" },
      { nom: "CISSE", telephone: "+00393294577803" },
      { nom: "Camara Bella Seynabou", telephone: "221774025392" },
      { nom: "Diagne Madeleine", telephone: "221777174696" },
      { nom: "Ndiaye Abdou Khoudoss", telephone: "221775455673" },
      { nom: "Diedhiou Sali", telephone: "0033652404459" }
    ];

    const BATCH_SIZE = 3;
    const DELAY = 2 * 60 * 1000; // 2 minutes en millisecondes

    const batches = divideInBatches(contactsWhatsApp, BATCH_SIZE);

    console.log(`📊 Envoi WhatsApp à ${contactsWhatsApp.length} actionnaires par lot de ${BATCH_SIZE}`);
    console.log(`📊 Total de ${batches.length} lots avec pause de 2 minutes entre chaque`);

    for (let i = 0; i < batches.length; i++) {
      console.log(`Envoi du lot ${i + 1} sur ${batches.length} (${batches[i].length} actionnaires)...`);

      await Promise.all(
        batches[i].map(async (contact) => {
          const message = `Bonjour cher(e) actionnaire,
Pour accéder à votre espace actionnaire, utilisez votre mot de passe actuel ou réinitialisez-le via "Mot de passe oublié" avec votre numéro : ${contact.telephone}
Site : https://actionuniversalfab.com/
Groupe WhatsApp : https://chat.whatsapp.com/LJ5ao94sDYPDyYzVsqU49r
Cordialement,
L'équipe Universal Fab`;

          try {
            await sendWhatsAppMessage(contact.telephone, message);
            console.log(`✅ WhatsApp envoyé à ${contact.nom} (${contact.telephone})`);
          } catch (error) {
            console.error(`❌ Erreur pour ${contact.nom}:`, error.message);
          }
        })
      );

      // Pause de 2 minutes sauf pour le dernier lot
      if (i < batches.length - 1) {
        console.log(`⏳ Pause de 2 minutes avant le prochain lot...`);
        await sleep(DELAY);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Envoi WhatsApp terminé par lot de 3",
      total: contactsWhatsApp.length,
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
module.exports.sendPasswordsToActionnaires = async (req, res) => {
  try {
    const actionnaires = await User.find({ role: "actionnaire" });

    if (!actionnaires.length) {
      return res.status(404).json({ message: "Aucun actionnaire trouvé" });
    }

    const BATCH_SIZE = 10;
    const START_FROM_BATCH = 33; // ⬅️ Commencer au lot 33

    const SMS_COUNTRY_CODES = [
      '+221', '+223', '+224', '+225', '+226', 
      '+227', '+228', '+229', '+245', '+243'
    ];

    const batches = divideInBatches(actionnaires, BATCH_SIZE);

    console.log(`📊 Démarrage à partir du lot ${START_FROM_BATCH} sur ${batches.length} lots totaux`);

    for (let i = START_FROM_BATCH - 1; i < batches.length; i++) {
      console.log(`Envoi du lot ${i + 1} sur ${batches.length} (${batches[i].length} actionnaires)...`);

      await Promise.all(
        batches[i].map(async (user) => {
          const message = `Bonjour cher(e) actionnaire,
Pour accéder à votre espace actionnaire, utilisez votre mot de passe actuel ou réinitialisez-le via "Mot de passe oublié" avec votre numéro : ${user.telephone}
Site : https://actionuniversalfab.com/
Groupe WhatsApp : https://chat.whatsapp.com/LJ5ao94sDYPDyYzVsqU49r
Cordialement,
L'équipe Universal Fab`;

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
    }

    return res.status(200).json({
      success: true,
      message: `Envoi terminé du lot ${START_FROM_BATCH} au lot ${batches.length}`,
      total: actionnaires.length,
      totalLots: batches.length,
      lotsSent: batches.length - (START_FROM_BATCH - 1)
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

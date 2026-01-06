const axios = require("axios");
const qs = require("qs");

const INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const TOKEN = process.env.ULTRAMSG_TOKEN;

function formatPhoneNumber(telephone) {
  // Supprimer tous les caractères non numériques
  let cleaned = telephone.replaceAll(/\D/g, '');
  
  // Validation de base - s'assurer que ce n'est pas vide
  if (!cleaned) {
    throw new Error('Numéro de téléphone invalide');
  }
  return cleaned;
}
module.exports.sendWhatsAppMessage=async(phoneNumber, message) =>{
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    const data = qs.stringify({
      "token": TOKEN,
      "to": formattedPhone,
      "body": message
    });
    
    const config = {
      method: 'post',
      url: `https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`,
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: data
    };
    
    const response = await axios(config);
    console.log(response);
    
    return response.data;
  } catch (error) {
    console.error("Erreur d'envoi WhatsApp:", error);
    throw error;
  }
}
module.exports.sendWhatsAppDocument = async (phone, pdfUrl, caption) => {
  try {
    const data = qs.stringify({
      token: TOKEN,
      to: phone,
      document: pdfUrl,
      filename: "Contrat_Actions.pdf",
      caption: caption
    });

    await axios.post(
      `https://api.ultramsg.com/${INSTANCE_ID}/messages/document`,
      data,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log("✅ Document WhatsApp envoyé !");
    return { success: true };
  } catch (error) {
    console.error("❌ Erreur envoi WhatsApp :", error.response?.data || error.message);
    return { success: false };
  }
};

module.exports.sendSMSMessage=async(telephone, message) =>{
try {
    const accountId = process.env.LAM_ACCOUNT_ID;
    const password = process.env.LAM_PASSWORD;

    if (!accountId || !password) {
      throw new Error('LAM_ACCOUNT_ID et LAM_PASSWORD doivent être configurés dans .env');
    }

    const formattedPhone = formatPhoneNumber(telephone);

    const payload = {
      accountid: accountId,
      password: password,
      sender: "Universall Fab",
      ret_id: `dioko_${Date.now()}`,
      priority: "2",
      text: message,
      to: [
        {
          ret_id_1: formattedPhone
        }
      ]
    };

    const response = await axios.post('https://lamsms.lafricamobile.com/api', payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    //console.log(response);

    return { success: true, response: response.data };

  } catch (error) {
    if (error.response) {
      const responseText = error.response.data;
    }
    throw error;
  }
}

// Liste des indicatifs de pays pour lesquels on envoie des OTP par SMS
// SEULEMENT ces pays nécessitent un OTP pour la sécurité
const SMS_COUNTRY_CODES = [
  '+221', '+223', '+224', '+225', '+226',
  '+227', '+228', '+229', '+245', '+243',"221","223","224"
];

// Vérifie si le numéro de téléphone nécessite un OTP (pays dans la liste SMS)
function shouldUseOTP(telephone) {
  return SMS_COUNTRY_CODES.some(code => telephone.startsWith(code));
}

// Export de la fonction pour utilisation dans les controllers
module.exports.shouldUseOTP = shouldUseOTP;

// Fonction pour envoyer un OTP par SMS (seulement pour les pays dans la liste)
module.exports.sendOTPMessage = async(telephone, message) => {
  try {
    if (shouldUseOTP(telephone)) {
      // Envoyer par SMS pour les pays africains spécifiques
      await module.exports.sendSMSMessage(telephone, message);
      console.log(`📱 OTP envoyé par SMS à ${telephone}`);
      return { channel: 'SMS', success: true, requireOTP: true };
    } else {
      // Pas d'OTP pour les autres pays - connexion directe
      console.log(`✅ Pas d'OTP requis pour ${telephone} - connexion directe`);
      return { channel: 'none', success: true, requireOTP: false };
    }
  } catch (error) {
    console.error(`❌ Erreur lors de l'envoi de l'OTP à ${telephone}:`, error);
    throw error;
  }
} 
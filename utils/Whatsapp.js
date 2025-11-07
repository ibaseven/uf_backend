const axios = require("axios");
const qs = require("qs");

const INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const TOKEN = process.env.ULTRAMSG_TOKEN;

function formatPhoneNumber(telephone) {
  // Supprimer tous les caractères non numériques
  let cleaned = telephone.replace(/\D/g, '');
  
  // Validation de base - s'assurer que ce n'est pas vide
  if (!cleaned) {
    throw new Error('Numéro de téléphone invalide');
  }
  return cleaned;
}
module.exports.sendWhatsAppMessage=async(telephone, message) =>{
  try {
    // Formater le numéro de téléphone sans forcer l'indicatif
    const formattedPhone = formatPhoneNumber(telephone);
    
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
    //console.log(response);
    
    return response.data;
  } catch (error) {
    console.error("Erreur d'envoi WhatsApp:", error);
    throw error;
  }
}
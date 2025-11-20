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
    
    return { success: true, response: response.data };
    
  } catch (error) {
    if (error.response) {
      const responseText = error.response.data;
    }
    throw error;
  }
}
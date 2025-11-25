const axios = require('axios');
require('dotenv').config();

// 🔧 Configuration de base PayDunya
const BASE_URL = 'https://app.paydunya.com';
const HEADERS = {
  'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY,
  'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY,
  'PAYDUNYA-PUBLIC-KEY': process.env.PAYDUNYA_PUBLIC_KEY,
  'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN,
  'Content-Type': 'application/json'
};


const createInvoice = async ({ items, totalAmount, callbackUrl }) => {
  try {
    const payload = {
      store: {
        name: "Universall Fab",
       // email: "contact@nappyproud.com",
        phone_number: "221773878232",
        //website_url: "https://nappyproud.com"
      },
       actions: {
        callback_url:callbackUrl

      },
      invoice: {
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity || 1,
          unit_price: item.unit_price
        })),
        total_amount: totalAmount,
      }
    };

    const url = `${BASE_URL}/api/v1/checkout-invoice/create`;
    const res = await axios.post(url, payload, { headers: HEADERS });
    return res.data;
  } catch (err) {
    console.error("Erreur création facture:", err.response?.data || err.message);
    throw err;
  }
};



const checkInvoiceStatus = async (token) => {
  try {
    const url = `${BASE_URL}/api/v1/checkout-invoice/confirm/${token}`;
    const res = await axios.get(url, { headers: HEADERS });
    return res.data;
  } catch (err) {
    console.error("Erreur vérification facture:", err.response?.data || err.message);
    throw err;
  }
};


const transferToAgent = async ({ account_alias, amount, withdraw_mode, callback_url }) => {
  try {
    const url = `${BASE_URL}/api/v2/disburse/get-invoice`;
    const validWithdrawModes = [
      "paydunya", "orange-money-senegal", "free-money-senegal", "expresso-senegal", "wave-senegal",
      "mtn-benin", "moov-benin", "mtn-ci", "orange-money-ci", "moov-ci", "wave-ci",
      "t-money-togo", "moov-togo", "orange-money-mali", "orange-money-burkina", "moov-burkina-faso"
    ];
    if (!validWithdrawModes.includes(withdraw_mode)) {
      throw new Error(`Méthode de retrait "${withdraw_mode}" non supportée.`);
    }
    const payload = { account_alias, amount, withdraw_mode, callback_url };
    const res = await axios.post(url, payload, { headers: HEADERS });
    return res.data;
  } catch (err) {
    console.error("Erreur transfert:", err.response?.data || err.message);
    throw err;
  }
};
const submitDisburseInvoice = async (disburse_invoice, disburse_id = null) => {
  try {
    //('🔍 Soumission de facture de décaissement:', { disburse_invoice, disburse_id });
    
    // Validation des paramètres
    if (!disburse_invoice) {
      throw new Error('Le paramètre disburse_invoice est obligatoire');
    }
    
    // Préparation du payload
    const payload = {
      disburse_invoice: disburse_invoice.trim()
    };
    
    // Ajouter disburse_id au payload uniquement s'il est fourni
    if (disburse_id) {
      payload.disburse_id = disburse_id.trim();
    }
    
    //('📤 Payload soumission:', payload);
    
    // ✅ CORRECTION: Utiliser la configuration centralisée
    const fullUrl = `${BASE_URL}/api/v2/disburse/submit-invoice`;
    //('🔗 URL soumission:', fullUrl);
    
    // Envoi de la requête
    const response = await axios.post(fullUrl, payload,{ headers: HEADERS });
    
    //('✅ Réponse soumission Paydunya:', response.data);
    
    // Analyse de la réponse
    if (response.data.response_code === "00" || 
        response.data.status === "success" || 
        response.data.response_status === "success") {
      return {
        success: true,
        data: response.data,
        message: response.data.response_text || response.data.message || 'Facture soumise avec succès'
      };
    } else {
      console.warn('⚠️ Transaction échouée côté Paydunya:', response.data.description || response.data.response_text);
      return {
        success: false,
        data: response.data,
        error: response.data.response_text || response.data.message || response.data.description || 'Erreur lors de la soumission de la facture'
      };
    }
  } catch (error) {
    console.error('❌ Erreur soumission Paydunya:', {
      message: error.message,
      url: error.config?.url,
      responseData: error.response?.data,
      responseStatus: error.response?.status
    });
    
    return {
      success: false,
      error: error.response?.data?.message || error.response?.data?.description || error.message || 'Erreur lors de la soumission de la facture de décaissement',
      details: error.response?.data
    };
  }
};
module.exports = {
  createInvoice,
  checkInvoiceStatus,
  transferToAgent,
  submitDisburseInvoice
};

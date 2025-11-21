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

module.exports = {
  createInvoice,
  checkInvoiceStatus,
  transferToAgent
};

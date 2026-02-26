// Config/diokolink.js
require("dotenv").config();

const DIOKOLINK_CONFIG = {
  SECRET_KEY: process.env.DIOKOLINK_SECRET_KEY,
  WEBHOOK_SECRET: process.env.DIOKOLINK_WEBHOOK_SECRET,
  ENVIRONMENT: process.env.DIOKOLINK_ENV || 'test',
  BASE_URL: 'https://diokolink.com/api/v1',

  ENDPOINTS: {
    INITIALIZE_PAYMENT: '/payments/initialize',
    GET_PAYMENTS: '/payments',
    GET_PAYMENT: '/payments',
    CALCULATE_FEES: '/payments/calculate-fees',
    INITIALIZE_PAYOUT: '/payouts/initialize',
    GET_PAYOUTS: '/payouts',
    GET_PAYOUT: '/payouts',
    CALCULATE_PAYOUT_FEES: '/payouts/calculate-fees',
    GET_PAYMENT_METHODS: '/payment-methods',
    GET_BALANCE: '/balance',
    GET_BALANCE_MOVEMENTS: '/balance/movements',
  },

  CALLBACK_URL: process.env.BACKEND_URL || 'https://localhost:5000',
  RETURN_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  MERCHANT_INFO: {
    name: "UniversallFab",
    description: "Plateforme d'investissement en actions",
    phone: process.env.COMPANY_PHONE || "221773878232",
    email: process.env.COMPANY_EMAIL || "contact@universallfab.com",
    website: process.env.FRONTEND_URL || "http://localhost:3000"
  }
};

const validateConfig = () => {
  const required = ['SECRET_KEY'];
  const missing = required.filter(key => !DIOKOLINK_CONFIG[key]);

  if (missing.length > 0) {
    console.error('❌ Configuration DiokoLink manquante:', missing);
    console.error('🔍 Vérifiez ces variables dans votre fichier .env :');
    console.error('   - DIOKOLINK_SECRET_KEY=votre_secret_key');
    console.error('   - DIOKOLINK_WEBHOOK_SECRET=votre_webhook_secret (optionnel)');
    console.error('   - DIOKOLINK_ENV=test (ou live pour production)');
    throw new Error(`Configuration DiokoLink manquante: ${missing.join(', ')}`);
  }

  console.log('✅ Configuration DiokoLink validée');
  console.log(`📍 Environnement: ${DIOKOLINK_CONFIG.ENVIRONMENT}`);
  console.log(`🌐 Base URL: ${DIOKOLINK_CONFIG.BASE_URL}`);
};

const getHeaders = () => {
  if (!DIOKOLINK_CONFIG.SECRET_KEY) {
    console.error('❌ Secret Key DiokoLink manquante');
    throw new Error('Configuration DiokoLink invalide: SECRET_KEY manquant');
  }

  return {
    'Authorization': `Bearer ${DIOKOLINK_CONFIG.SECRET_KEY}`,
    'Content-Type': 'application/json',
    'X-Environment': DIOKOLINK_CONFIG.ENVIRONMENT
  };
};

const buildCallbackUrls = (transactionId = null) => {
  const baseCallback = `${DIOKOLINK_CONFIG.CALLBACK_URL}/api/ipnpayment`;

  return {
    callback_url: baseCallback,
    return_url: `${DIOKOLINK_CONFIG.RETURN_URL}/payment/success${transactionId ? `?transaction=${transactionId}` : ''}`,
    cancel_url: `${DIOKOLINK_CONFIG.RETURN_URL}/payment/cancel${transactionId ? `?transaction=${transactionId}` : ''}`
  };
};

const validateWebhookSignature = (payload, signature) => {
  if (!DIOKOLINK_CONFIG.SECRET_KEY) {
    console.warn('⚠️ SECRET_KEY non configuré - validation ignorée');
    return true;
  }

  if (!signature) {
    console.warn('⚠️ Signature webhook manquante');
    return false;
  }

  try {
    const crypto = require('crypto');
    // DiokoLink signe avec SECRET_KEY sur le body brut (string)
    const bodyString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', DIOKOLINK_CONFIG.SECRET_KEY);
    const expectedSignature = hmac.update(bodyString).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('❌ Erreur validation signature webhook:', error);
    return false;
  }
};

const testDiokoLinkConnection = async () => {
  try {
    const axios = require('axios');
    console.log('🧪 Test de connexion DiokoLink...');

    const fullUrl = `${DIOKOLINK_CONFIG.BASE_URL}${DIOKOLINK_CONFIG.ENDPOINTS.GET_BALANCE}`;
    const response = await axios.get(fullUrl, {
      headers: getHeaders(),
      timeout: 10000,
      validateStatus: (status) => status < 500
    });

    console.log(`✅ Serveur DiokoLink accessible - Status: ${response.status}`);
    return {
      success: true,
      status: response.status,
      message: 'Connexion à DiokoLink établie',
      data: response.data
    };
  } catch (error) {
    console.error('❌ Problème de connectivité vers DiokoLink:', error.message);
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
};

module.exports = {
  DIOKOLINK_CONFIG,
  validateConfig,
  getHeaders,
  buildCallbackUrls,
  validateWebhookSignature,
  testDiokoLinkConnection
};

try {
  validateConfig();
} catch (error) {
  console.error('❌ Erreur de configuration DiokoLink:', error.message);
}

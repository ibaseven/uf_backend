// Services/diokolinkService.js
const axios = require('axios');
require('dotenv').config();
const { DIOKOLINK_CONFIG, getHeaders } = require('../Config/diokolink');
// DiokoLink Service - DiokoVente


const initializePayment = async (amount, type = 'link', customer, reference, paymentMethod = null, metadata = {}) => {
  try {
    const payload = {
      amount: amount,
      currency: 'XOF',
      type: type, // 'direct' ou 'link'
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone
      },
      reference: reference,
      metadata: metadata
    };

    // Pour les paiements directs, spécifier la méthode de paiement
    if (type === 'link' && paymentMethod) {
      payload.payment_method = paymentMethod;
    }

    const fullUrl = `${DIOKOLINK_CONFIG.BASE_URL}${DIOKOLINK_CONFIG.ENDPOINTS.INITIALIZE_PAYMENT}`;

    const response = await axios.post(fullUrl, payload, {
      headers: getHeaders(),
      timeout: 30000
    });

    if (response.data.success) {
      return {
        success: true,
        transaction_id: response.data.data.transaction_id,
        payment_url: response.data.data.payment_url || null,
        status: response.data.data.status,
        amount: response.data.data.amount,
        currency: response.data.data.currency,
        rawResponse: response.data
      };
    } else {
      throw new Error(response.data.message || 'Erreur lors de l\'initialisation du paiement');
    }
  } catch (error) {
    console.error('❌ Erreur DiokoLink initializePayment:', {
      message: error.message,
      url: error.config?.url,
      responseData: error.response?.data,
      responseStatus: error.response?.status
    });

    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Erreur lors de l\'initialisation du paiement',
      details: error.response?.data
    };
  }
};



const checkPaymentStatus = async (transactionId) => {
  try {
    const fullUrl = `${DIOKOLINK_CONFIG.BASE_URL}${DIOKOLINK_CONFIG.ENDPOINTS.GET_PAYMENT}/${transactionId}`;

    const response = await axios.get(fullUrl, {
      headers: getHeaders(),
      timeout: 15000
    });

    if (response.data.success) {
      return {
        success: true,
        status: response.data.data.status,
        transaction: response.data.data,
        data: response.data
      };
    } else {
      throw new Error(response.data.message || 'Erreur lors de la vérification du statut');
    }
  } catch (error) {
    console.error('❌ Erreur lors de la vérification du paiement:', {
      message: error.message,
      responseData: error.response?.data,
      responseStatus: error.response?.status
    });

    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Erreur lors de la vérification du statut'
    };
  }
};


const initializePayout = async (accountAlias, amount, paymentMethod, reference, metadata = {}) => {
  try {
    // Normaliser le numéro de téléphone
    let normalizedPhone = accountAlias;
    if (!normalizedPhone.startsWith('+')) {
      // Ajouter le préfixe pays si manquant (Sénégal par défaut)
      normalizedPhone = normalizedPhone.startsWith('221')
        ? `+${normalizedPhone}`
        : `+221${normalizedPhone}`;
    }

    const payload = {
      amount: amount,
      currency: 'XOF',
      payment_method: paymentMethod,
      beneficiary: {
        phone: normalizedPhone,
        name: metadata.beneficiary_name || 'Actionnaire Dioko'
      },
      reference: reference,
      metadata: metadata
    };

    const fullUrl = `${DIOKOLINK_CONFIG.BASE_URL}${DIOKOLINK_CONFIG.ENDPOINTS.INITIALIZE_PAYOUT}`;

    const response = await axios.post(fullUrl, payload, {
      headers: getHeaders(),
      timeout: 30000
    });

    if (response.data.success) {
      return {
        success: true,
        transaction_id: response.data.data.transaction_id,
        status: response.data.data.status,
        amount: response.data.data.amount,
        currency: response.data.data.currency,
        rawResponse: response.data
      };
    } else {
      throw new Error(response.data.message || 'Erreur lors du décaissement');
    }
  } catch (error) {
    console.error('❌ Erreur DiokoLink initializePayout:', {
      message: error.message,
      url: error.config?.url,
      responseData: error.response?.data,
      responseStatus: error.response?.status
    });

    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Erreur lors du décaissement',
      details: error.response?.data
    };
  }
};


const getPayments = async (filters = {}) => {
  try {
    const fullUrl = `${DIOKOLINK_CONFIG.BASE_URL}${DIOKOLINK_CONFIG.ENDPOINTS.GET_PAYMENTS}`;

    const response = await axios.get(fullUrl, {
      headers: getHeaders(),
      params: filters,
      timeout: 15000
    });

    if (response.data.success) {
      return {
        success: true,
        payments: response.data.data,
        pagination: response.data.pagination || null
      };
    } else {
      throw new Error(response.data.message || 'Erreur lors de la récupération des paiements');
    }
  } catch (error) {
    console.error('❌ Erreur récupération paiements:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Erreur lors de la récupération des paiements'
    };
  }
};


const calculateFees = async (amount, paymentMethod = null) => {
  try {
    const payload = {
      amount: amount,
      currency: 'XOF'
    };

    if (paymentMethod) {
      payload.payment_method = paymentMethod;
    }

    const fullUrl = `${DIOKOLINK_CONFIG.BASE_URL}${DIOKOLINK_CONFIG.ENDPOINTS.CALCULATE_FEES}`;

    const response = await axios.post(fullUrl, payload, {
      headers: getHeaders(),
      timeout: 10000
    });

    if (response.data.success) {
      return {
        success: true,
        fees: response.data.data
      };
    } else {
      throw new Error(response.data.message || 'Erreur calcul des frais');
    }
  } catch (error) {
    console.error('❌ Erreur calcul frais:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Erreur lors du calcul des frais'
    };
  }
};


const getPaymentMethods = async (country = null, type = 'payment') => {
  try {
    const params = { type };
    if (country) {
      params.country = country;
    }

    const fullUrl = `${DIOKOLINK_CONFIG.BASE_URL}${DIOKOLINK_CONFIG.ENDPOINTS.GET_PAYMENT_METHODS}`;

    const response = await axios.get(fullUrl, {
      headers: getHeaders(),
      params: params,
      timeout: 10000
    });

    if (response.data.success) {
      return {
        success: true,
        methods: response.data.data
      };
    } else {
      throw new Error(response.data.message || 'Erreur récupération méthodes');
    }
  } catch (error) {
    console.error('❌ Erreur récupération méthodes paiement:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Erreur lors de la récupération des méthodes de paiement'
    };
  }
};


const getBalance = async () => {
  try {
    const fullUrl = `${DIOKOLINK_CONFIG.BASE_URL}${DIOKOLINK_CONFIG.ENDPOINTS.GET_BALANCE}`;

    const response = await axios.get(fullUrl, {
      headers: getHeaders(),
      timeout: 10000
    });

    if (response.data.success) {
      return {
        success: true,
        balance: response.data.data
      };
    } else {
      throw new Error(response.data.message || 'Erreur récupération solde');
    }
  } catch (error) {
    console.error('❌ Erreur récupération solde:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Erreur lors de la récupération du solde'
    };
  }
};

const testConnection = async () => {
  try {
    console.log('🧪 Test de connexion DiokoLink...');

    const result = await getBalance();

    if (result.success) {
      console.log('✅ Connexion DiokoLink établie avec succès');
      console.log('💰 Solde:', result.balance);
      return {
        success: true,
        message: 'Connexion à DiokoLink établie',
        balance: result.balance
      };
    } else {
      throw new Error(result.error);
    }

  } catch (error) {
    console.error('❌ Erreur test connexion DiokoLink:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Échec de connexion à DiokoLink'
    };
  }
};

module.exports = {
  initializePayment,
  checkPaymentStatus,
  initializePayout,
  getPayments,
  calculateFees,
  getPaymentMethods,
  getBalance,
  testConnection,
  DIOKOLINK_CONFIG
};

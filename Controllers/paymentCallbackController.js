/* const { updateStatusBuyAction } = require("./ActionController");
const { updateStatusPayemt } = require("./UserProjectController");



// Callback URL pour le paiement
module.exports.handlePaymentCallback = async (req, res) => {
  try {
    const data = req.body.data;
    if (!data?.invoice?.token) {
      return res.status(400).json({ message: "Données de callback invalides" });
    }

    const invoiceToken = data.invoice.token;
    const status = data.status;

    // Appeler la fonction de mise à jour
    const result = await updateStatusPayemt(invoiceToken, status);

    // Gérer les erreurs retournées
    if (result.error) {
      return res.status(result.statusCode).json({ 
        message: result.message,
        ...(result.transaction && { transaction: result.transaction })
      });
    }

    // Succès
    res.status(200).json({
      message: result.message,
      transaction: result.transaction,
      user: result.user,
      projectsStatus: result.projectsStatus
    });

  } catch (err) {
    console.error("Erreur callback paiement:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};


module.exports.handleBuyActionsCallback = async (req, res) => {
  try {
    const data = req.body.data;
    if (!data?.invoice?.token) {
      return res.status(400).json({ message: "Données de callback invalides" });
    }

    const invoiceToken = data.invoice.token;
    const status = data.status;

    // Appeler la fonction de mise à jour
    const result = await updateStatusBuyAction(invoiceToken, status);

    // Gérer les erreurs retournées
    if (result.error) {
      return res.status(result.statusCode).json({ 
        message: result.message,
        ...(result.transaction && { transaction: result.transaction })
      });
    }

    // Succès
    res.status(200).json({
      message: result.message,
      transaction: result.transaction,
      user: result.user,
      projectsStatus: result.projectsStatus
    });

  } catch (err) {
    console.error("Erreur callback paiement:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};
 */






const CallbackLog = require('../Models/CallbackLog');
const { updateStatusBuyAction } = require('./ActionController');
const { updateStatusPayemt } = require('./UserProjectController');
const { checkPaymentStatus } = require('../Services/diokolinkService');

// Mapper les statuts DiokoLink vers les statuts internes
const mapDiokolinkStatus = (diokolinkStatus) => {
    const statusMapping = {
        'pending': 'pending',
        'success': 'completed',
        'completed': 'completed',
        'failed': 'failed',
        'expired': 'cancelled',
        'cancelled': 'cancelled'
    };
    return statusMapping[diokolinkStatus] || 'pending';
};

// Extraire le token et le statut depuis le body DiokoLink
// Structure: {"event":"transaction.success","timestamp":"...","data":{"transaction_id":"AA0...","payment_link_token":"pl_..."}}
// Le token stocké en DB est le payment_link_token (pl_...), pas le transaction_id final
const extractDiokolinkData = (body) => {
    const data = body.data || body;
    // Priorité: payment_link_token (pl_...) qui correspond à ce qu'on stocke en DB
    const token = data.payment_link_token || data.payment_link_id
        || body.payment_link_token
        || data.transaction_id || data.reference
        || body.transaction_id || body.reference;
    const rawStatus = data.status || (body.event?.replace('transaction.', '')) || body.status;
    return { token, rawStatus };
};

// Callback pour paiement de projets (DiokoLink)
module.exports.handlePaymentCallback = async (req, res) => {
    try {
        const body = req.body;
        const { token: invoiceToken, rawStatus } = extractDiokolinkData(body);

        if (!invoiceToken) {
            console.error('❌ Token manquant dans le callback DiokoLink', JSON.stringify(body).substring(0, 200));
            return res.status(400).json({ message: "Token manquant" });
        }

        // Vérifier le statut réel via DiokoLink API
        let status = 'pending';
        try {
            const paymentStatus = await checkPaymentStatus(invoiceToken);
            if (paymentStatus.success) {
                status = mapDiokolinkStatus(paymentStatus.transaction?.status || rawStatus);
            } else {
                status = mapDiokolinkStatus(rawStatus);
            }
        } catch (err) {
            console.warn('⚠️ Impossible de vérifier via API DiokoLink, utilisation du status du callback:', rawStatus);
            status = mapDiokolinkStatus(rawStatus);
        }

        const result = await updateStatusPayemt(invoiceToken, status);

        if (result.error) {
            return res.status(result.statusCode).json({ message: result.message });
        }

        return res.status(200).json({ message: result.message, success: true });

    } catch (err) {
        console.error("❌ Erreur callback payment DiokoLink:", err.message);
        return res.status(500).json({ message: "Erreur serveur" });
    }
};

// Callback pour achat d'actions (DiokoLink)
module.exports.handleBuyActionsCallback = async (req, res) => {
    try {
        const body = req.body;
        const { token: invoiceToken, rawStatus } = extractDiokolinkData(body);

        if (!invoiceToken) {
            console.error('❌ Token manquant dans le callback DiokoLink', JSON.stringify(body).substring(0, 200));
            return res.status(400).json({ message: "Token manquant" });
        }

        console.log(`🔄 Callback DiokoLink reçu - Token: ${invoiceToken} - Status brut: ${rawStatus}`);

        // Vérifier le statut réel via DiokoLink API
        let status = 'pending';
        try {
            const paymentStatus = await checkPaymentStatus(invoiceToken);
            if (paymentStatus.success) {
                status = mapDiokolinkStatus(paymentStatus.transaction?.status || rawStatus);
                console.log(`✅ Statut DiokoLink vérifié: ${paymentStatus.transaction?.status} → ${status}`);
            } else {
                status = mapDiokolinkStatus(rawStatus);
            }
        } catch (err) {
            console.warn('⚠️ Vérification API DiokoLink impossible, utilisation du status callback:', rawStatus);
            status = mapDiokolinkStatus(rawStatus);
        }

        console.log(`🎯 Traitement callback: ${invoiceToken} - Status: ${status}`);

        const result = await updateStatusBuyAction(invoiceToken, status);

        if (result.error) {
            console.log(`⚠️ ${result.message}`);
            return res.status(result.statusCode).json({ message: result.message });
        }

        console.log(`✅ Callback DiokoLink traité avec succès: ${invoiceToken}`);

        return res.status(200).json({ message: result.message, success: true });

    } catch (err) {
        console.error("❌ Erreur callback DiokoLink:", err.message);
        return res.status(500).json({ message: "Erreur serveur" });
    }
};

module.exports.confirmPaymentManually = async (req, res) => {
  try {
    const { invoiceToken, status } = req.body;

    if (!invoiceToken) {
      return res.status(400).json({
        success: false,
        message: "invoiceToken manquant"
      });
    }

    const finalStatus = status || "completed";

    const result = await updateStatusBuyAction(invoiceToken, finalStatus);

    if (result.error) {
      return res.status(result.statusCode || 500).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: "Paiement traité avec succès",
      data: result
    });

  } catch (error) {
    console.error("❌ Erreur confirmPaymentManually:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};


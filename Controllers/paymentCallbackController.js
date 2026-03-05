 const { updateStatusBuyAction } = require("./ActionController");
const { updateStatusPayemt } = require("./UserProjectController");
const { updateStatusMoratoireVersement } = require("./MoratoireController");
const CallbackLog = require('../Models/CallbackLog');

const { checkPaymentStatus } = require('../Services/diokolinkService');
   const Transaction = require('../Models/TransactionModel');


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
 








// Mapper les statuts DiokoLink vers les statuts internes
// const mapDiokolinkStatus = (diokolinkStatus) => {
//     const statusMapping = {
//         'pending': 'pending',
//         'success': 'completed',
//         'completed': 'completed',
//         'failed': 'failed',
//         'expired': 'cancelled',
//         'cancelled': 'cancelled'
//     };
//     return statusMapping[diokolinkStatus] || 'pending';
// };

// // Extraire le token et le statut depuis le body (PayDunya ou DiokoLink)
// // PayDunya IPN: { data: { invoice: { token, status }, status } }
// // DiokoLink IPN: { event, data: { transaction_id, payment_link_token, status } }
// const extractDiokolinkData = (body) => {
//     const data = body.data || body;
//     // PayDunya format (priorité) : data.invoice.token
//     // DiokoLink format : data.payment_link_token ou data.transaction_id
//     const token = data?.invoice?.token
//         || data.payment_link_token || data.payment_link_id
//         || body.payment_link_token
//         || data.transaction_id || data.reference
//         || body.transaction_id || body.reference;
//     const rawStatus = data?.invoice?.status
//         || data.status || (body.event?.replace('transaction.', '')) || body.status;
//     return { token, rawStatus };
// };

// // Callback universel (DiokoLink envoie tout vers /ipn)
// // Détecte automatiquement si c'est un achat d'actions ou un versement projet
// module.exports.handlePaymentCallback = async (req, res) => {
//     try {
//         const body = req.body;
//         const { token: invoiceToken, rawStatus } = extractDiokolinkData(body);

//         if (!invoiceToken) {
//             console.error('❌ Token manquant dans le callback DiokoLink', JSON.stringify(body).substring(0, 200));
//             return res.status(400).json({ message: "Token manquant" });
//         }

//         // Vérifier le statut réel via DiokoLink API
//         let status = 'pending';
//         try {
//             const paymentStatus = await checkPaymentStatus(invoiceToken);
//             if (paymentStatus.success) {
//                 status = mapDiokolinkStatus(paymentStatus.transaction?.status || rawStatus);
//             } else {
//                 status = mapDiokolinkStatus(rawStatus);
//             }
//         } catch (err) {
//             console.warn('⚠️ Impossible de vérifier via API DiokoLink, utilisation du status du callback:', rawStatus);
//             status = mapDiokolinkStatus(rawStatus);
//         }

//         // Détecter le type de transaction via la DB
//         const Transaction = require('../Models/TransactionModel');
//         const transaction = await Transaction.findOne({ invoiceToken });

//         if (!transaction) {
//             console.error(`❌ Aucune transaction trouvée pour le token: ${invoiceToken}`);
//             return res.status(404).json({ message: "Transaction introuvable" });
//         }

//         let result;
//         // Si la transaction a un champ "actions" rempli → c'est un achat d'actions
//         if (transaction.actions) {
//             console.log(`🎯 Token ${invoiceToken} → achat d'actions, appel updateStatusBuyAction`);
//             result = await updateStatusBuyAction(invoiceToken, status);
//         } else {
//             // Sinon → c'est un versement projet
//             console.log(`🎯 Token ${invoiceToken} → versement projet, appel updateStatusPayemt`);
//             result = await updateStatusPayemt(invoiceToken, status);
//         }

//         if (result.error) {
//             return res.status(result.statusCode).json({ message: result.message });
//         }

//         return res.status(200).json({ message: result.message, success: true });

//     } catch (err) {
//         console.error("❌ Erreur callback payment DiokoLink:", err.message);
//         return res.status(500).json({ message: "Erreur serveur" });
//     }
// };

// // Callback pour achat d'actions (DiokoLink)
// module.exports.handleBuyActionsCallback = async (req, res) => {
//     try {
//         const body = req.body;
//         const { token: invoiceToken, rawStatus } = extractDiokolinkData(body);

//         if (!invoiceToken) {
//             console.error('❌ Token manquant dans le callback DiokoLink', JSON.stringify(body).substring(0, 200));
//             return res.status(400).json({ message: "Token manquant" });
//         }

//         console.log(`🔄 Callback DiokoLink reçu - Token: ${invoiceToken} - Status brut: ${rawStatus}`);

//         // Vérifier le statut réel via DiokoLink API
//         let status = 'pending';
//         try {
//             const paymentStatus = await checkPaymentStatus(invoiceToken);
//             if (paymentStatus.success) {
//                 status = mapDiokolinkStatus(paymentStatus.transaction?.status || rawStatus);
//                 console.log(`✅ Statut DiokoLink vérifié: ${paymentStatus.transaction?.status} → ${status}`);
//             } else {
//                 status = mapDiokolinkStatus(rawStatus);
//             }
//         } catch (err) {
//             console.warn('⚠️ Vérification API DiokoLink impossible, utilisation du status callback:', rawStatus);
//             status = mapDiokolinkStatus(rawStatus);
//         }

//         console.log(`🎯 Traitement callback: ${invoiceToken} - Status: ${status}`);

//         const result = await updateStatusBuyAction(invoiceToken, status);

//         if (result.error) {
//             console.log(`⚠️ ${result.message}`);
//             return res.status(result.statusCode).json({ message: result.message });
//         }

//         console.log(`✅ Callback DiokoLink traité avec succès: ${invoiceToken}`);

//         return res.status(200).json({ message: result.message, success: true });

//     } catch (err) {
//         console.error("❌ Erreur callback DiokoLink:", err.message);
//         return res.status(500).json({ message: "Erreur serveur" });
//     }
// };

// Webhook pour les payouts DiokoLink (retraits de dividendes)
// DiokoLink appelle ce endpoint quand un payout est complété/échoué
// Callback URL pour les versements moratoires
module.exports.handleMoratoireVersementCallback = async (req, res) => {
  try {
    const data = req.body.data;
    if (!data?.invoice?.token) {
      return res.status(400).json({ message: "Données de callback invalides" });
    }

    const invoiceToken = data.invoice.token;
    const status = data.status;

    const result = await updateStatusMoratoireVersement(invoiceToken, status);

    if (result.error) {
      return res.status(result.statusCode).json({ message: result.message });
    }

    return res.status(200).json({ message: result.message, success: true });
  } catch (err) {
    console.error("Erreur callback moratoire:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

module.exports.handlePayoutCallback = async (req, res) => {
    try {
        const body = req.body;
        const data = body.data || body;

        // Extraire le transaction_id du payout
        const payoutTransactionId = data.transaction_id || data.reference
            || body.transaction_id || body.reference;

        const rawStatus = data.status
            || (body.event?.replace('payout.', ''))
            || body.status;

        if (!payoutTransactionId) {
            console.error('❌ transaction_id manquant dans le webhook payout', JSON.stringify(body).substring(0, 200));
            return res.status(400).json({ message: "transaction_id manquant" });
        }

        console.log(`🔄 Webhook payout DiokoLink - ID: ${payoutTransactionId} - Status: ${rawStatus}`);

        const mappedStatus = mapDiokolinkStatus(rawStatus);

        // Trouver la transaction par invoiceToken (qui stocke le transaction_id DiokoLink du payout)
     
        const transaction = await Transaction.findOne({ invoiceToken: payoutTransactionId });

        if (!transaction) {
            console.error(`❌ Aucune transaction payout trouvée pour ID: ${payoutTransactionId}`);
            return res.status(404).json({ message: "Transaction introuvable" });
        }

        // Ne pas rétrograder un statut déjà final
        if (transaction.status === 'completed' || transaction.status === 'failed') {
            console.log(`ℹ️ Transaction ${payoutTransactionId} déjà en statut final: ${transaction.status}`);
            return res.status(200).json({ success: true, message: "Statut déjà final" });
        }

        transaction.status = mappedStatus;
        await transaction.save();

        console.log(`✅ Transaction payout ${payoutTransactionId} mise à jour → ${mappedStatus}`);
        return res.status(200).json({ success: true, message: "Payout mis à jour" });

    } catch (err) {
        console.error("❌ Erreur webhook payout DiokoLink:", err.message);
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

    const result = await updateStatusBuyAction(invoiceToken, status);

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


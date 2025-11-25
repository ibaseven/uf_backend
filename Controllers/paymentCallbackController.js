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
const { validateCallbackPayload } = require('../Middlewares/callbackValidator');

// Callback pour paiement de projets
module.exports.handlePaymentCallback = async (req, res) => {
    try {
        // Le payload a été vérifié par verifyPaydunyaCallback
        const data = req.paydunya;
        
        if (!data || !data.invoiceToken) {
            return res.status(400).json({ message: "Payload invalide" });
        }
        
        const invoiceToken = data.invoiceToken;
        const status = data.status;
        
        const result = await updateStatusPayemt(invoiceToken, status);
        
        if (result.error) {
            return res.status(result.statusCode).json({ 
                message: result.message
            });
        }
        
        return res.status(200).json({
            message: result.message,
            success: true
        });
        
    } catch (err) {
        console.error("❌ Erreur callback payment:", err.message);
        return res.status(500).json({ message: "Erreur serveur" });
    }
};

// Callback pour achat d'actions
module.exports.handleBuyActionsCallback = async (req, res) => {
    try {
        // ✅ Le payload a déjà été vérifié par verifyPaydunyaCallback
        const data = req.paydunya;
        
        if (!data || !data.invoiceToken) {
            console.error('❌ Payload manquant après middleware');
            return res.status(400).json({ message: "Payload invalide" });
        }
        
        const invoiceToken = data.invoiceToken;
        const status = data.status;
        
        console.log(`🔄 Traitement callback: ${invoiceToken} - Status: ${status}`);
        
        // Appeler la fonction de mise à jour
        const result = await updateStatusBuyAction(invoiceToken, status);
        
        // Gérer les erreurs
        if (result.error) {
            console.log(`⚠️ ${result.message}`);
            return res.status(result.statusCode).json({ 
                message: result.message
            });
        }
        
        console.log(`✅ Callback traité avec succès: ${invoiceToken}`);
        
        return res.status(200).json({
            message: result.message,
            success: true
        });
        
    } catch (err) {
        console.error("❌ Erreur callback:", err.message);
        return res.status(500).json({ message: "Erreur serveur" });
    }
};


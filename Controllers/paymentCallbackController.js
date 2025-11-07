const { updateStatusBuyAction } = require("./ActionController");
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


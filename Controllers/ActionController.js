const User = require("../Models/UserModel")
const Action= require("../Models/ActionModel");
const { createInvoice } = require("../Services/paydunya");
const callbackurl=process.env.BACKEND_URL

module.exports.buyAction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { actionNumber } = req.body;

    
    
    const pricePerAction = 200;
    const totalPrice = pricePerAction * actionNumber;

    const items = [
  { name: `Participation projet `, unit_price: totalPrice }
];
  const invoice = await createInvoice({
  items,
  totalAmount: totalPrice,
  callbackUrl: `${callbackurl}/api/ipnpayment`
});
    const newAction = new Action({
      userId,
      actionNumber,
      price: totalPrice,
        invoiceToken: invoice.token, 
        callbackUrl:invoice.callbackUrl
    });

    await newAction.save();

    return res.status(201).json({
      message: "Achat effectué avec succès !",
      data: newAction,
      invoice
    });
  } catch (error) {
    console.error("Erreur lors de l'achat :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports.updateStatusBuyAction = async (invoiceToken, status) => {
  try {
    // 1️⃣ Chercher la transaction
    const transaction = await Action.findOne({ invoiceToken });
    if (!transaction) {
      return {
        error: true,
        statusCode: 404,
        message: "Transaction introuvable.",
      };
    }

    // 2️⃣ Déjà confirmée → on ne refait rien
    if (transaction.status === "confirmed") {
      return {
        error: true,
        statusCode: 200,
        message: "Transaction déjà traitée.",
        transaction,
      };
    }

    // 3️⃣ Paiement échoué
    if (status !== "completed") {
      transaction.status = "failed";
      await transaction.save();
      return {
        error: true,
        statusCode: 400,
        message: "Paiement non validé.",
        transaction,
      };
    }

    // 4️⃣ Récupérer l'utilisateur
    const user = await User.findById(transaction.userId);
    if (!user) {
      return {
        error: true,
        statusCode: 404,
        message: "Utilisateur introuvable.",
      };
    }

    // 5️⃣ Augmenter le nombre d’actions de l’utilisateur
    user.actionsNumber = (user.actionsNumber || 0) + transaction.actionNumber;
    await user.save();

    // 6️⃣ Marquer la transaction comme confirmée
    transaction.status = "confirmed";
    await transaction.save();

    return {
      error: false,
      message: "Paiement confirmé et nombre d’actions mis à jour.",
      transaction,
      user,
    };

  } catch (error) {
    console.error("Erreur dans updateStatusBuyAction:", error);
    return {
      error: true,
      statusCode: 500,
      message: "Erreur serveur",
      details: error.message,
    };
  }
};
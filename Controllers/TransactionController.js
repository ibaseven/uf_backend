const Transaction = require("../Models/TransactionModel")
const User= require("../Models/UserModel")
module.exports.getAllTransactionsByUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }
    const transactions = await Transaction.find({ user: userId });
    return res.status(200).json({
      message: "Récupération réussie",
      transactions,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erreur interne du serveur",
      error: error.message,
    });
  }
};
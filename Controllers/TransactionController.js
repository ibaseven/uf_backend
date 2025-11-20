const { model } = require("mongoose");
const Transaction = require("../Models/TransactionModel");
const User = require("../Models/UserModel");
module.exports.getAllTransactionsByUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const transactions = await Transaction.find({ userId })
      .populate({
        path: "projectIds",
        model: "Project",
        select: "nameProject packPrice",
      })
      .populate({
        path: "userId",
        model: "User",
        select: "firstName lastName email telephone",
      })
      .populate({
        path: "actions",
        model: "Action", // Ajout du model
        select: "actionNumber price status", // Ajout de plus de champs utiles
      })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      message: "Récupération réussie",
      total: transactions.length,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        telephone: user.telephone,
      },
      transactions,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des transactions :", error);
    return res.status(500).json({
      message: "Erreur interne du serveur",
      error: error.message,
    });
  }
};

module.exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate({
        path: "projectIds",
        model: "Project",
        select: "nameProject packPrice",
      })
      .populate({
        path: "userId",
        model: "User",
        select: "firstName lastName email telephone",
      })
      .populate({
        path: "actions",
        model: "Action",
        select: "actionNumber price status",
      })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      message: "Transactions récupérées avec succès",
      total: transactions.length,
      transactions,
    });

  } catch (error) {
    console.error("Erreur lors de la récupération des transactions :", error);
    return res.status(500).json({
      message: "Erreur interne du serveur",
      error: error.message,
    });
  }
};

const User = require("../Models/UserModel");
const Project = require("../Models/ProjectModel");
const { createInvoice } = require("../Services/paydunya");
const Transaction = require("../Models/TransactionModel");

const callbackurl=process.env.BACKEND_URL
module.exports.participateProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.body;

    const user = await User.findById(userId);
    const project = await Project.findById(projectId);

    if (!user || !project) {
      return res.status(404).json({ message: "Utilisateur ou projet introuvable." });
    }

    // Chercher si l'utilisateur participe déjà à ce projet
    let participation = user.projectPayments?.find(
      (p) => p.projectId.toString() === projectId.toString()
    );

    if (!participation) {
      // Première participation - créer une nouvelle entrée
      participation = {
        projectId,
        nameProject: project.nameProject,
        amountPaid: 0,
        remainingToPay: project.packPrice,
        completed: false
      };
      user.projectPayments = [...(user.projectPayments || []), participation];
    } else {
      
      participation.remainingToPay += project.packPrice;
      participation.completed = false; // Réinitialiser car nouveau pack ajouté
    }

    // Ajouter le projet dans projectId si pas déjà présent
    if (!user.projectId.includes(projectId)) {
      user.projectId.push(projectId);
    }

    await user.save();

    // Calculer le nombre de packs (basé sur amountPaid + remainingToPay)
    const totalInvestment = participation.amountPaid + participation.remainingToPay;
    const numberOfPacks = totalInvestment / project.packPrice;

    res.status(200).json({
      success: true,
      message: "Participation enregistrée. Le paiement est attendu pour valider la participation.",
      participation: {
        projectName: project.nameProject,
        numberOfPacks: numberOfPacks,
        totalInvestment: totalInvestment,
        amountPaid: participation.amountPaid,
        remainingToPay: participation.remainingToPay,
        completed: participation.completed
      }
    });

  } catch (error) {
    console.error("Erreur participation projet:", error);
    res.status(500).json({success: false, message: "Erreur serveur", error: error.message });
  }
};

module.exports.giveYourDividendToTheProject = async (req, res) => {
  try {
    const { projectIds, amount } = req.body; 
    const userId =  req.user?.id; 

    if (!userId) {
      return res.status(400).json({ message: "L'identifiant de l'utilisateur est requis." });
    }

    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return res.status(400).json({ message: "Le champ projectIds doit être un tableau d'identifiants valides." });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Montant invalide." });
    }
    const updatedProjects = await Promise.all(
      projectIds.map(async (id) => {
        const project = await Project.findById(id);
        if (!project) return null;
        return project;
      })
    );

    const items = [
  { name: `Participation projet `, unit_price: amount }
];
  const invoice = await createInvoice({
  items,
  totalAmount: amount,
   callbackUrl: `${callbackurl}/api/ipn`
});
const TransactionRecord = await Transaction.create({
      userId,
      projectIds,
      amount,
      status: "pending", // paiement pas encore confirmé
      description: `Participation aux projets ${projectIds.join(", ")}. Paiement en attente.`,
      invoiceToken: invoice.token, 
    });

    res.status(200).json({
      success:true,
      message: "Participation enregistrée et paiement déclenché. Attente de validation.",
      userId,
      updatedProjects: updatedProjects.filter(Boolean),
      TransactionRecord,
      invoice,
    });
  } catch (error) {
    console.error("Erreur dans giveYourDividendToTheProject:", error);
    res.status(500).json({success:false, message: "Erreur serveur", error: error.message });
  }
};

module.exports.updateStatusPayemt = async (invoiceToken, status) => {
  try {
    // Chercher la transaction
    const transaction = await Transaction.findOne({ invoiceToken });
    if (!transaction) {
      return { 
        error: true, 
        statusCode: 404, 
        message: "Transaction introuvable." 
      };
    }

    // Vérifier si déjà traitée
    if (transaction.status === "confirmed") {
      return { 
        error: true, 
        statusCode: 200, 
        message: "Transaction déjà traitée", 
        transaction 
      };
    }

    // Vérifier le statut du paiement
    if (status !== "completed") {
      transaction.status = "failed";
      await transaction.save();
      return { 
        error: true, 
        statusCode: 400, 
        message: "Paiement non validé.",
        transaction 
      };
    }

    // Récupérer l'utilisateur
    const user = await User.findById(transaction.userId);
    if (!user) {
      return { 
        error: true, 
        statusCode: 404, 
        message: "Utilisateur introuvable." 
      };
    }

    // Répartir le montant entre les projets
    const perProjectAmount = Math.floor(transaction.amount / transaction.projectIds.length);

    for (const projectId of transaction.projectIds) {
      const project = await Project.findById(projectId);
      if (!project) continue;

      let participation = user.projectPayments?.find(
        (p) => p.projectId.toString() === projectId.toString()
      );

      if (!participation) {
        participation = {
          projectId,
          amountPaid: 0,
          remainingToPay: project.packPrice,
          completed: false
        };
        user.projectPayments = [...(user.projectPayments || []), participation];
      }

      // ✅ Ignorer si déjà complété
      if (participation.completed) continue;

      // ✅ Ajouter le montant payé
      participation.amountPaid += perProjectAmount;

      // ✅ CORRECTION : Calculer le reste à payer correctement
      participation.remainingToPay = Math.max(
        participation.remainingToPay - perProjectAmount,
        0
      );

      // ✅ Marquer comme complété si tout est payé
      if (participation.remainingToPay === 0) {
        participation.completed = true;
      }

      // ✅ Mettre à jour les dividendes du projet
      project.dividends = (project.dividends || 0) + perProjectAmount;
      await project.save();
    }

    await user.save();

    transaction.status = "confirmed";
    await transaction.save();

    // Préparer le retour avec populate pour avoir le nom du projet
    await user.populate('projectPayments.projectId', 'nameProject');

    const projectsStatus = user.projectPayments.map((p) => {
      // Calculer le nombre de packs
      const totalInvestment = p.amountPaid + p.remainingToPay;
      const numberOfPacks = p.projectId?.packPrice 
        ? Math.floor(totalInvestment / p.projectId.packPrice) 
        : 0;

      return {
        projectId: p.projectId?._id,
        nameProject: p.projectId?.nameProject || "Projet",
        numberOfPacks: numberOfPacks,
        amountPaidByUser: p.amountPaid,
        remainingToPay: p.remainingToPay,
        totalInvestment: totalInvestment,
        completed: p.completed,
      };
    });

    return {
      error: false,
      message: "Paiement confirmé et participation mise à jour.",
      transaction,
      user,
      projectsStatus
    };

  } catch (error) {
    console.error("Erreur dans updateStatusPayemt:", error);
    return { 
      error: true, 
      statusCode: 500, 
      message: "Erreur serveur", 
      details: error.message 
    };
  }
};

module.exports.getProjectByUser = async (req, res) => {
  try {
    const userId = req.user.id;

    // Vérifier que l'utilisateur existe et récupérer ses projets
    const user = await User.findById(userId).populate({
      path:"projectId",
      select:"nameProject packPrice monthlyPayment"
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    // Les projets sont maintenant disponibles dans user.projects
    return res.status(200).json({
      message: "Projets récupérés avec succès",
      projects: user.projectId || [],
    });
  } catch (error) {
    console.error("Erreur dans getProjectByUser:", error);
    return res.status(500).json({
      message: "Erreur serveur",
      error: error.message,
    });
  }
};


module.exports.changePassword = async (req, res) => {
  const { telephone, currentPassword, newPassword } = req.body;

  try {
    const user = await User.findOne({ telephone });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Vérifiez si le mot de passe actuel est correct
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Mot de passe actuel incorrect" });
    }

    // Hash le nouveau mot de passe
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Mettez à jour le mot de passe dans la base de données
    user.password = hashedNewPassword;
    await user.save();

    res.status(200).json({ message: "Mot de passe mis à jour avec succès" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour du mot de passe" });
  }
};






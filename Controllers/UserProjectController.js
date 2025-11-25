const User = require("../Models/UserModel");
const Project = require("../Models/ProjectModel");
const { createInvoice } = require("../Services/paydunya");
const Transaction = require("../Models/TransactionModel");
const MAIN_ADMIN_ID = process.env.MAIN_ADMIN_ID
const callbackurl=process.env.BACKEND_URL
const mongoose = require('mongoose');
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
    const session = await mongoose.startSession();
    
    try {
        session.startTransaction();
        
        // Verrou atomique
        const transaction = await Transaction.findOneAndUpdate(
            { 
                invoiceToken,
                status: { $ne: 'confirmed' }
            },
            {
                $set: { lastUpdateAttempt: new Date() }
            },
            {
                new: false,
                session
            }
        );
        
        if (!transaction) {
            const existing = await Transaction.findOne({ invoiceToken }).session(session);
            
            if (!existing) {
                await session.abortTransaction();
                return {
                    error: true,
                    statusCode: 404,
                    message: "Transaction introuvable"
                };
            }
            
            if (existing.status === 'confirmed') {
                await session.abortTransaction();
                return {
                    error: true,
                    statusCode: 200,
                    message: "Transaction déjà traitée"
                };
            }
            
            await session.abortTransaction();
            return {
                error: true,
                statusCode: 500,
                message: "Impossible de verrouiller"
            };
        }
        
        if (status !== 'completed') {
            transaction.status = 'failed';
            await transaction.save({ session });
            await session.commitTransaction();
            
            return {
                error: true,
                statusCode: 400,
                message: "Paiement non validé"
            };
        }
        
        const user = await User.findById(transaction.userId).session(session);
        if (!user) {
            await session.abortTransaction();
            return {
                error: true,
                statusCode: 404,
                message: "Utilisateur introuvable"
            };
        }
        
        // Calculs en centimes
        const totalAmountCents = Math.round((transaction.amount || 0) * 100);
        const projectCount = transaction.projectIds?.length || 1;
        const perProjectAmountCents = Math.floor(totalAmountCents / projectCount);
        
        // ✅ Commission automatique (6% déduit, 94% pour l'admin)
        const adminShareCents = Math.round(totalAmountCents * 0.94);
        
        // Traitement des projets
        for (const projectId of transaction.projectIds) {
            const project = await Project.findById(projectId).session(session);
            if (!project) continue;
            
            let participation = user.projectPayments?.find(
                p => p.projectId.toString() === projectId.toString()
            );
            
            if (!participation) {
                const packPriceCents = Math.round((project.packPrice || 0) * 100);
                participation = {
                    projectId,
                    amountPaid: 0,
                    remainingToPay: packPriceCents / 100,
                    completed: false
                };
                user.projectPayments = [...(user.projectPayments || []), participation];
            }
            
            if (participation.completed) continue;
            
            const amountPaidCents = Math.round((participation.amountPaid || 0) * 100);
            const remainingCents = Math.round((participation.remainingToPay || 0) * 100);
            
            const newAmountPaidCents = amountPaidCents + perProjectAmountCents;
            const newRemainingCents = Math.max(remainingCents - perProjectAmountCents, 0);
            
            participation.amountPaid = newAmountPaidCents / 100;
            participation.remainingToPay = newRemainingCents / 100;
            participation.completed = (newRemainingCents === 0);
            
            const projectDividendsCents = Math.round((project.dividends || 0) * 100);
            project.dividends = (projectDividendsCents + perProjectAmountCents) / 100;
            await project.save({ session });
        }
        
        await user.save({ session });
        
       // Trouver l'admin principal via isMainAdmin
const mainAdmin = await User.findOne({ isMainAdmin: true }).session(session);

if (mainAdmin) {
    const currentAdminDividendeCents = Math.round((mainAdmin.dividende || 0) * 100);

    const newAdminDividendeCents = currentAdminDividendeCents + adminShareCents;

    mainAdmin.dividende = newAdminDividendeCents / 100;

    

    await mainAdmin.save({ session });
}

        
        transaction.status = 'confirmed';
        await transaction.save({ session });
        
        await session.commitTransaction();
        
        await user.populate('projectPayments.projectId', 'nameProject packPrice');
        
        const projectsStatus = user.projectPayments.map(p => ({
            projectId: p.projectId?._id,
            nameProject: p.projectId?.nameProject || "Projet",
            amountPaid: p.amountPaid,
            remainingToPay: p.remainingToPay,
            completed: p.completed
        }));
        
        return {
            error: false,
            message: "Paiement confirmé",
            transaction,
            user,
            projectsStatus
        };
        
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        
        console.error("❌ updateStatusPayemt:", error.message);
        
        return {
            error: true,
            statusCode: 500,
            message: "Erreur serveur"
        };
        
    } finally {
        session.endSession();
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






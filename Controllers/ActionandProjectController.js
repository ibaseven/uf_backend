const Action = require("../Models/ActionModel");
const User = require("../Models/UserModel");
const ProjectDividende = require("../Models/ProjectDividende");
const Project = require("../Models/ProjectModel");
module.exports.createActionAndCalculateDividendes = async (req, res) => {
  try {

    
    const ActionUser = req.user.id;
    const { PriceAction } = req.body;

    // 1️⃣ Vérifier l'utilisateur connecté
    const currentUser = await User.findById(ActionUser);
    if (!currentUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

   
    const action = await Action.create({ PriceAction });
    const actionnaires = await User.find({ role: "actionnaire" });
    const updates = actionnaires.map(async (user) => {
      const dividende = user.actionsNumber * PriceAction;
      user.dividende += dividende;
      return user.save();
    });
    await Promise.all(updates);
    return res.status(201).json({
      message: "Dividendes calculés avec succès pour les actionnaires",
      priceAction: PriceAction,
      totalActionnaires: actionnaires.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports.distributeProjectDividende = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { projectId, totalAmount } = req.body;

    // 1️⃣ Vérifier admin
    const admin = await User.findById(adminId);
    if (!admin || (!admin.isTheOwner && !admin.isTheSuperAdmin)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    // 2️⃣ Récupérer le projet
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Projet non trouvé" });
    }

    // 3️⃣ Participants éligibles (amountPaid > 0 et plafond non atteint)
    const eligible = project.participants.filter(p => 
      p.amountPaid > 0 && 
      p.amountPaid * 10 > (p.dividendeReceived) // montant déjà reçu pour ce projet
    );

    if (!eligible.length) {
      return res.status(400).json({
        message: "Aucun participant éligible"
      });
    }

    // 4️⃣ Total amountPaid global des participants éligibles
    const totalPaidGlobal = eligible.reduce(
      (sum, p) => sum + p.amountPaid,
      0
    );

    // 5️⃣ Distribution proportionnelle
    for (const participant of eligible) {
      const user = await User.findById(participant.userId);
      if (!user) continue;

      const plafond = participant.amountPaid * 10;
      const dejaRecu = participant.dividendeReceived || 0;
      const resteARecevoir = plafond - dejaRecu;

      // Part proportionnelle
      const partBrute = (participant.amountPaid / totalPaidGlobal) * totalAmount;
      const montantFinal = Math.min(partBrute, resteARecevoir);

      if (montantFinal > 0) {
        // 🔹 Mise à jour user
        user.dividende += montantFinal;
        await user.save();

        // 🔹 Mise à jour participant dans le projet
        const projectParticipant = project.participants.find(p =>
          p.userId.toString() === user._id.toString()
        );
        if (projectParticipant) {
          projectParticipant.dividendeReceived = (projectParticipant.dividendeReceived || 0) + montantFinal;
        }

        // 🔹 Historique
        await ProjectDividende.create({
          userId: user._id,
          Price: montantFinal
        });
      }
    }

    // 🔹 Sauvegarder le projet avec les dividendeReceived mis à jour
    await project.save();

    return res.status(200).json({
      message: "Distribution effectuée selon amountPaid",
      totalDistribue: totalAmount,
      participantsPayes: eligible.length
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
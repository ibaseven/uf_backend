const User = require("../Models/UserModel");
const Fees = require("../Models/feesModel");
const { sendWhatsAppMessage } = require("../utils/Whatsapp");

module.exports.deducteTheFee = async (req, res) => {
  try {
    const userId = req.user.id;
    const { montant, description } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    if (user.isTheSuperAdmin !== true) {
      return res.status(403).json({
        message: "Vous n'avez pas l'autorisation pour cette action"
      });
    }

    const owner = await User.findOne({ isTheOwner: true });
    const superAdmin = await User.findOne({ isTheSuperAdmin: true });
    if (!owner) {
      return res.status(404).json({ message: "Owner introuvable" });
    }

    if (owner.dividende_actions < montant) {
      return res.status(400).json({ message: "Solde insuffisant" });
    }

  let reste = montant;

// Priorité aux dividendes actions
if (owner.dividende_actions >= reste) {
  owner.dividende_actions -= reste;
  superAdmin.dividende_actions -= reste;
  reste = 0;
} else {
  reste -= owner.dividende_actions;
  reste = superAdmin.dividende_actions;
  owner.dividende_actions = 0;
  superAdmin.dividende_actions=0;
}

// Puis on utilise dividende_project si nécessaire
if (reste > 0) {
  if (owner.dividende_project >= reste) {
    owner.dividende_project -= reste;
    superAdmin.dividende_project -= reste;
    reste = 0;
  } else {
    // Solde insuffisant total
    return res.status(400).json({ message: "Solde insuffisant dans les dividendes" });
  }
}
    await Fees.create({
      montant,
      description,
      createdBy: userId,
      ownerId: owner._id,
      date: new Date()
    });

    await owner.save();
    await superAdmin.save()

    // 4️⃣ Message WhatsApp (si numéro présent)
    if (owner.telephone) {
      const message = 
        `Bonjour ${owner.firstName + owner.lastName} une Déduction a etait effectuée pour des frais de service .`+`Montant : ${Number(montant).toLocaleString()} FCFA\n` +`Description : ${description}\n` + `Nouveau solde : ${owner.dividende_actions.toLocaleString()} FCFA`;
      try {
        await sendWhatsAppMessage(owner.telephone, message);
      } catch (error) {
        console.warn("⚠️ Échec d'envoi WhatsApp :", error.message);
      }
    }

    return res.status(200).json({
      message: "Frais déduits avec succès",
      nouveauSolde: owner.dividende_actions,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erreur interne du serveur",
      error: error.message
    });
  }
};

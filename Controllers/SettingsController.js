const Settings = require("../Models/SettingsModel")
const User = require("../Models/UserModel")

module.exports.updateActionPrice = async (req, res) => {
  try {
    const { newPrice } = req.body;

    if (!newPrice || newPrice <= 0) {
      return res.status(400).json({
        message: "Le prix doit être un nombre positif."
      });
    }

    // Example : stocker la config dans un document unique "settings"
    const settings = await Settings.findOneAndUpdate(
      {},
      { pricePerAction: newPrice },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      message: "Prix des actions mis à jour avec succès.",
      pricePerAction: settings.pricePerAction
    });

  } catch (error) {
    console.error("Erreur mise à jour prix action :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports.getActionPrice = async (req, res) => {
  try {
    let settings = await Settings.findOne();


    return res.status(200).json({
      message: "Prix de l'action récupéré avec succès",
      pricePerAction: settings.pricePerAction
    });

  } catch (error) {
    console.error("Erreur getActionPrice :", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// GET settings (actionsBlocked, projectsBlocked)
module.exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    return res.status(200).json({
      actionsBlocked: settings?.actionsBlocked ?? false,
      projectsBlocked: settings?.projectsBlocked ?? false,
      pricePerAction: settings?.pricePerAction ?? 2000
    });
  } catch (error) {
    console.error("Erreur getSettings :", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// Toggle block/unblock actions (isTheOwner only)
module.exports.toggleActionsBlock = async (req, res) => {
  try {
    const caller = await User.findById(req.user.id);
    if (!caller?.isTheOwner) {
      return res.status(403).json({ message: "Accès refusé. Réservé au propriétaire." });
    }

    const settings = await Settings.findOneAndUpdate(
      {},
      [{ $set: { actionsBlocked: { $not: "$actionsBlocked" } } }],
      { new: true, upsert: true }
    );

    return res.status(200).json({
      message: settings.actionsBlocked ? "Achat d'actions bloqué" : "Achat d'actions débloqué",
      actionsBlocked: settings.actionsBlocked
    });
  } catch (error) {
    console.error("Erreur toggleActionsBlock :", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// Toggle block/unblock projects (isTheOwner only)
module.exports.toggleProjectsBlock = async (req, res) => {
  try {
    const caller = await User.findById(req.user.id);
    if (!caller?.isTheOwner) {
      return res.status(403).json({ message: "Accès refusé. Réservé au propriétaire." });
    }

    const settings = await Settings.findOneAndUpdate(
      {},
      [{ $set: { projectsBlocked: { $not: "$projectsBlocked" } } }],
      { new: true, upsert: true }
    );

    return res.status(200).json({
      message: settings.projectsBlocked ? "Paiements projets bloqués" : "Paiements projets débloqués",
      projectsBlocked: settings.projectsBlocked
    });
  } catch (error) {
    console.error("Erreur toggleProjectsBlock :", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};


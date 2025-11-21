const Settings = require("../Models/SettingsModel")

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


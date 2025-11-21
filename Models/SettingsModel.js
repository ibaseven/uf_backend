const mongoose = require("mongoose")
const SettingsSchema = mongoose.Schema({
  pricePerAction: {
    type: Number,
    default: 2000
  }
});

module.exports = mongoose.model("Settings", SettingsSchema);

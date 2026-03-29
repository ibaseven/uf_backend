const mongoose = require("mongoose")
const SettingsSchema = mongoose.Schema({
  pricePerAction: {
    type: Number,
    default: 2000
  },
  actionsBlocked: {
    type: Boolean,
    default: false
  },
  projectsBlocked: {
    type: Boolean,
    default: false
  },
  dividendsActionsBlocked: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("Settings", SettingsSchema);

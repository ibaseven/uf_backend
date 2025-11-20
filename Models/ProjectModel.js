const mongoose = require("mongoose");

const ProjectSchema = mongoose.Schema({
  nameProject: {
    type: String,
  },
  packPrice: {
    type: Number,
  },
  duration: {
    type: Number,
  },
  monthlyPayment: {
    type: Number,
  },
  description: {
    type: String,
  },
  gainProject: {
    type: String,
  },
  rapportUrl: {
    type: String, 
    default: null
  },
});

module.exports = mongoose.model("Project", ProjectSchema);

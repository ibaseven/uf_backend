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
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    dividendeReceived: {
  type: Number,
  default: 0
},
    name: String,
    numberOfPacks: {
      type: Number,
      default: 0
    },
    totalInvestment: {
      type: Number,
      default: 0
    },
    amountPaid: {
      type: Number,
      default: 0
    },
    remainingToPay: {
      type: Number,
      default: 0
    },
    completed: {
      type: Boolean,
      default: false
    },
    participationDate: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model("Project", ProjectSchema);
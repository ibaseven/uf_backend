const mongoose = require('mongoose');

const VersementSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  invoiceToken: { type: String },
  type: { type: String, enum: ['paydunya', 'manuel'], default: 'paydunya' },
  note: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'confirmed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const MoratoireSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actionNumber: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  versementMontant: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['active', 'completed', 'suspended', 'cancelled'],
    default: 'active'
  },
  totalPaid: { type: Number, default: 0 },
  contractPdfUrl: { type: String, default: null },
  actionContractSent: { type: Boolean, default: false },
  versements: [VersementSchema]
}, { timestamps: true });

module.exports = mongoose.model('Moratoire', MoratoireSchema);

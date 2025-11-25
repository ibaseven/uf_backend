const mongoose = require('mongoose');

const callbackLogSchema = new mongoose.Schema({
    invoiceToken: {
        type: String,
        required: true,
        index: true
    },
    status: {
        type: String,
        required: true
    },
    callbackType: {
        type: String,
        enum: ['payment', 'action'],
        required: true
    },
    ipAddress: String,
    userAgent: String,
    payload: {
        type: Object,
        required: true
    },
    processingStatus: {
        type: String,
        enum: ['success', 'failed', 'duplicate', 'invalid'],
        default: 'success'
    },
    errorMessage: String
}, {
    timestamps: true
});

// Index unique pour éviter les doublons
callbackLogSchema.index(
    { invoiceToken: 1, status: 1, callbackType: 1 }, 
    { unique: true }
);

// TTL pour auto-suppression après 90 jours
callbackLogSchema.index(
    { createdAt: 1 }, 
    { expireAfterSeconds: 7776000 }
);

module.exports = mongoose.model('CallbackLog', callbackLogSchema);
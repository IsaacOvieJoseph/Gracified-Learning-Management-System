const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    taxRate: {
        type: Number,
        default: 0 // percentage
    },
    vatRate: {
        type: Number,
        default: 0 // percentage
    },
    serviceFeeRate: {
        type: Number,
        default: 0 // percentage
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);

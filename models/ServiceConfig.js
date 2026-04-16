const mongoose = require('mongoose');

const serviceConfigSchema = new mongoose.Schema({
    serviceName: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String
    },
    requiredDocuments: [{
        name: { type: String, required: true },
        description: { type: String },
        isRequired: { type: Boolean, default: true },
        maxSize: { type: Number, default: 2 },
        allowedTypes: { type: [String], default: ['image/jpeg', 'image/png', 'application/pdf'] }
    }],
    processingFee: {
        type: Number,
        default: 50
    },
    estimatedDays: {
        type: Number,
        default: 5
    },
    isActive: {
        type: Boolean,
        default: true
    },
    displayOrder: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

serviceConfigSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('ServiceConfig', serviceConfigSchema);
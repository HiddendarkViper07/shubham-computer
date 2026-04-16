const mongoose = require('mongoose');

const paymentSettingsSchema = new mongoose.Schema({
    // Payment Gateway Selection
    activeGateway: {
        type: String,
        enum: ['razorpay', 'easebuzz', 'none'],
        default: 'razorpay'
    },
    
    // Enable/Disable Payment
    paymentEnabled: {
        type: Boolean,
        default: true
    },
    
    // Razorpay Settings
    razorpay: {
        enabled: { type: Boolean, default: true },
        keyId: { type: String, default: '' },
        keySecret: { type: String, default: '' },
        testMode: { type: Boolean, default: true }
    },
    
    // Easebuzz Settings
    easebuzz: {
        enabled: { type: Boolean, default: false },
        merchantKey: { type: String, default: '' },
        saltKey: { type: String, default: '' },
        accessKey: { type: String, default: '' },
        testMode: { type: Boolean, default: true },
        env: { type: String, enum: ['test', 'production'], default: 'test' }
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

paymentSettingsSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('PaymentSettings', paymentSettingsSchema);
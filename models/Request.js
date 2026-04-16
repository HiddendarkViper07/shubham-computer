const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    requestId: {
        type: String,
        unique: true,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    userName: {
        type: String,
        required: true
    },
    userEmail: {
        type: String
    },
    serviceName: {
        type: String,
        required: true
    },
    requiredDocs: [{
        type: String
    }],
    uploadedFiles: [{
        fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
        fileName: String,
        uploadDate: Date
    }],
    extraMessage: {
        type: String
    },
    address: {
        type: String
    },
    mobile: {
        type: String
    },
    amount: {
        type: Number,
        default: 50
    },
    paymentMethod: {
        type: String
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    transactionId: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'rejected', 'on-hold'],
        default: 'pending'
    },
    adminNote: {
        type: String
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    processedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    // Add these fields to the Request schema
    certificateId: {
        type: String
    },
    certificateIssuedDate: {
        type: Date
    }
    
});

requestSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

requestSchema.statics.generateRequestId = function() {
    return 'REQ' + Date.now() + Math.floor(Math.random() * 1000);
};

module.exports = mongoose.model('Request', requestSchema);
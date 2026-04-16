const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
    certificateId: {
        type: String,
        unique: true,
        required: true
    },
    requestId: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
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
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File'
    },
    fileName: {
        type: String
    },
    fileSize: {
        type: Number
    },
    issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    issuedByName: {
        type: String
    },
    issuedDate: {
        type: Date,
        default: Date.now
    },
    validUntil: {
        type: Date
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'revoked'],
        default: 'active'
    },
    notes: {
        type: String
    },
    downloadCount: {
        type: Number,
        default: 0
    }
});

certificateSchema.statics.generateCertificateId = function() {
    return 'CERT' + Date.now() + Math.floor(Math.random() * 1000);
};

module.exports = mongoose.model('Certificate', certificateSchema);
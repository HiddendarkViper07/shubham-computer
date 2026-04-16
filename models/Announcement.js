const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['general', 'vacancy', 'new_service', 'update', 'important'],
        default: 'general'
    },
    targetUsers: {
        type: String,
        enum: ['all', 'active', 'new'],
        default: 'all'
    },
    attachment: {
        fileName: String,
        fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File' }
    },
    link: {
        type: String
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    },
    views: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('Announcement', announcementSchema);
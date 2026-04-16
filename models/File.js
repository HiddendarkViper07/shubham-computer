const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    originalName: {
        type: String,
        required: true
    },
    uploader: {
        type: String,
        default: 'Anonymous'
    },
    uploaderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    contentType: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    data: {
        type: Buffer,
        required: true
    },
    category: {
        type: String,
        enum: ['document', 'image', 'pdf', 'other', 'certificate', 'announcement'],
        default: 'document'
    },
    requestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Request'
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    downloads: {
        type: Number,
        default: 0
    },
    views: {
        type: Number,
        default: 0
    }
});

// Virtual for formatted size
fileSchema.virtual('formattedSize').get(function() {
    if (this.size < 1024) return this.size + ' B';
    if (this.size < 1024 * 1024) return (this.size / 1024).toFixed(2) + ' KB';
    return (this.size / (1024 * 1024)).toFixed(2) + ' MB';
});

// Virtual for file icon
fileSchema.virtual('fileIcon').get(function() {
    if (this.contentType?.startsWith('image/')) return '🖼️';
    if (this.contentType === 'application/pdf') return '📄';
    if (this.category === 'certificate') return '📜';
    if (this.category === 'announcement') return '📢';
    return '📁';
});

// Ensure virtuals are included in JSON
fileSchema.set('toJSON', { virtuals: true });
fileSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('File', fileSchema);
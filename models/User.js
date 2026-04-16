const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        default: 'User'
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: false
    },
    mobile: {
        type: String,
        trim: true,
        default: ''
    },
    aadharNumber: {
        type: String,
        trim: true,
        default: ''
    },
    profileImage: {
        type: String,
        default: 'https://i.pravatar.cc/150?img=7'
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    kycStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    googleId: String,
    facebookId: String,
    appleId: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    }
});

userSchema.pre('save', async function(next) {
    if (!this.password || !this.isModified('password')) {
        return next();
    }
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.pre('validate', function(next) {
    if (!this.fullName || this.fullName.trim() === '') {
        this.fullName = this.email ? this.email.split('@')[0] : 'User';
    }
    next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
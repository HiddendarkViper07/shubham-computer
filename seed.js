const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const UserSchema = new mongoose.Schema({
    fullName: String,
    email: String,
    password: String,
    role: String,
    isVerified: Boolean,
    kycStatus: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

async function createAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        const existingAdmin = await User.findOne({ email: 'admin@shubhamcomputer.com' });
        if (existingAdmin) {
            console.log('ℹ️ Admin already exists');
            process.exit(0);
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Admin@123', salt);
        
        const admin = new User({
            fullName: 'Administrator',
            email: 'admin@shubhamcomputer.com',
            password: hashedPassword,
            role: 'admin',
            isVerified: true,
            kycStatus: 'verified'
        });
        
        await admin.save();
        console.log('✅ Admin user created successfully!');
        console.log('📧 Email: admin@shubhamcomputer.com');
        console.log('🔑 Password: Admin@123');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

createAdmin();
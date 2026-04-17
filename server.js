const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const path = require('path');
const passport = require('passport');
const dotenv = require('dotenv');

// Load env variables FIRST
dotenv.config();

console.log('🔑 Razorpay Key ID:', process.env.RAZORPAY_KEY_ID ? 'Loaded' : 'Not Found');
console.log('🔐 Google OAuth:', process.env.GOOGLE_CLIENT_ID ? 'Configured' : 'Not Configured');
console.log('🏦 Easebuzz:', process.env.EASEBUZZ_MERCHANT_KEY ? 'Configured' : 'Not Configured');
console.log('📦 MongoDB URI:', process.env.MONGODB_URI ? 'Configured' : 'MISSING!');

const app = express();

// Models
const User = require('./models/User');

// Passport config
require('./config/passport');

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
    console.error('❌ FATAL ERROR: MONGODB_URI is not defined in environment variables');
    process.exit(1);
}

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'shubham_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: mongoURI,
        collectionName: 'sessions',
        autoRemove: 'interval',
        autoRemoveInterval: 10,
        touchAfter: 24 * 3600
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        secure: false,
        httpOnly: true
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Serialize/deserialize
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// ✅ Global variables middleware - PASSES EVERYTHING TO VIEWS
app.use(async (req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isAuthenticated = !!req.session.user;
    res.locals.isAdmin = req.session.user?.role === 'admin';
    
    // ✅ CRITICAL: Pass OAuth variables to all views
    res.locals.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
    res.locals.FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
    res.locals.APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || '';
    res.locals.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
    
    // Load payment settings
    try {
        const PaymentSettings = require('./models/PaymentSettings');
        const paymentSettings = await PaymentSettings.findOne();
        res.locals.paymentEnabled = paymentSettings ? paymentSettings.paymentEnabled : true;
        res.locals.activeGateway = paymentSettings ? paymentSettings.activeGateway : 'razorpay';
    } catch (e) {
        res.locals.paymentEnabled = true;
        res.locals.activeGateway = 'razorpay';
    }
    
    next();
});

// MongoDB Connection
mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Initialize Payment Settings after DB connection
mongoose.connection.once('open', async () => {
    try {
        const PaymentSettings = require('./models/PaymentSettings');
        const settings = await PaymentSettings.findOne();
        if (!settings) {
            const defaultSettings = new PaymentSettings({
                paymentEnabled: true,
                activeGateway: 'razorpay',
                razorpay: {
                    enabled: true,
                    keyId: process.env.RAZORPAY_KEY_ID || '',
                    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
                    testMode: true
                },
                easebuzz: {
                    enabled: false,
                    merchantKey: process.env.EASEBUZZ_MERCHANT_KEY || '',
                    saltKey: process.env.EASEBUZZ_SALT_KEY || '',
                    testMode: true,
                    env: 'test'
                }
            });
            await defaultSettings.save();
            console.log('✅ Default payment settings created');
        }
    } catch (err) {
        console.error('⚠️ Payment settings init error:', err.message);
    }
});

// Import Routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

// Use Routes
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/upload', uploadRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).render('404', { 
        title: 'Page Not Found',
        user: req.session.user || null
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(500).render('error', {
        title: 'Server Error',
        error: err.message,
        user: req.session.user || null
    });
});

// Start server
const PORT = process.env.PORT || 8081;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔒 Admin panel available at /admin`);
});
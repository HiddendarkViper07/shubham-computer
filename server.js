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

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'shubham_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Custom serialize/deserialize for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Global variables middleware
app.use(async (req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isAuthenticated = !!req.session.user;
    res.locals.isAdmin = req.session.user?.role === 'admin';
    
    // Load payment settings for views
    try {
        const PaymentSettings = require('./models/PaymentSettings');
        const paymentSettings = await PaymentSettings.findOne();
        res.locals.paymentEnabled = paymentSettings ? paymentSettings.paymentEnabled : true;
        res.locals.activeGateway = paymentSettings ? paymentSettings.activeGateway : 'razorpay';
        res.locals.RAZORPAY_KEY_ID = paymentSettings?.razorpay?.keyId || process.env.RAZORPAY_KEY_ID || '';
    } catch (e) {
        res.locals.paymentEnabled = true;
        res.locals.activeGateway = 'razorpay';
        res.locals.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
    }
    
    res.locals.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
    res.locals.FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
    res.locals.APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || '';
    next();
});

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shubham_computer';

mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Initialize Payment Settings if not exists
// Initialize Payment Settings if not exists
const PaymentSettings = require('./models/PaymentSettings');
PaymentSettings.findOne().then(settings => {
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
        defaultSettings.save().then(() => console.log('✅ Default payment settings created'));
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
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        user: req.session.user || null
    });
});

// Start server
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔒 Admin panel: http://localhost:${PORT}/admin`);
});
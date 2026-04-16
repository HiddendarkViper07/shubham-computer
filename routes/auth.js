const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');

// Register
router.post('/register', [
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => value === req.body.password ? true : false).withMessage('Passwords do not match')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('signup', { title: 'Sign Up', error: errors.array()[0].msg });
    }

    try {
        const { fullName, email, password, mobile } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('signup', { title: 'Sign Up', error: 'Email already registered' });
        }
        
        const user = new User({ fullName, email, password, mobile });
        await user.save();
        res.redirect('/login?registered=true');
    } catch (error) {
        res.render('signup', { title: 'Sign Up', error: 'Registration failed' });
    }
});

// Login
router.post('/login', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('login', { title: 'Login', error: errors.array()[0].msg, success: null });
    }

    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.render('login', { title: 'Login', error: 'Invalid email or password', success: null });
        }
        
        user.lastLogin = new Date();
        await user.save();
        
        req.session.user = { id: user._id, fullName: user.fullName, email: user.email, role: user.role, profileImage: user.profileImage };
        
        if (user.role === 'admin') return res.redirect('/admin/dashboard');
        res.redirect('/home');
    } catch (error) {
        res.render('login', { title: 'Login', error: 'Login failed', success: null });
    }
});

// Google OAuth
if (process.env.GOOGLE_CLIENT_ID) {
    router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
    router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
        req.session.user = { id: req.user._id, fullName: req.user.fullName, email: req.user.email, role: req.user.role, profileImage: req.user.profileImage };
        res.redirect('/home');
    });
}

// Facebook OAuth
if (process.env.FACEBOOK_APP_ID) {
    router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
    router.get('/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), (req, res) => {
        req.session.user = { id: req.user._id, fullName: req.user.fullName, email: req.user.email, role: req.user.role, profileImage: req.user.profileImage };
        res.redirect('/home');
    });
}

// Apple OAuth
if (process.env.APPLE_CLIENT_ID) {
    router.get('/apple', passport.authenticate('apple'));
    router.post('/apple/callback', passport.authenticate('apple', { failureRedirect: '/login' }), (req, res) => {
        req.session.user = { id: req.user._id, fullName: req.user.fullName, email: req.user.email, role: req.user.role, profileImage: req.user.profileImage };
        res.redirect('/home');
    });
}

// Admin Login Page
router.get('/admin-login', (req, res) => {
    res.render('admin-login', { title: 'Admin Login', error: null });
});

// Admin Login Handler
router.post('/admin-login', [
    body('email').isEmail(),
    body('password').notEmpty()
], async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, role: 'admin' });
        if (!user || !(await user.comparePassword(password))) {
            return res.render('admin-login', { title: 'Admin Login', error: 'Invalid credentials' });
        }
        req.session.user = { id: user._id, fullName: user.fullName, email: user.email, role: user.role, profileImage: user.profileImage };
        res.redirect('/admin/dashboard');
    } catch (error) {
        res.render('admin-login', { title: 'Admin Login', error: 'Login failed' });
    }
});

module.exports = router;
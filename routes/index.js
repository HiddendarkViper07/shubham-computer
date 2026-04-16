const express = require('express');
const router = express.Router();
const { isAuthenticated, isGuest } = require('../middleware/auth');
const User = require('../models/User');
const Request = require('../models/Request');
const File = require('../models/File');
const ServiceConfig = require('../models/ServiceConfig');
const Notification = require('../models/Notification');
const Certificate = require('../models/Certificate');
const Announcement = require('../models/Announcement');
const PaymentSettings = require('../models/PaymentSettings');
const ContactMessage = require('../models/ContactMessage');

// Helper
async function getUnreadCount(userId) {
    return await Notification.countDocuments({ userId, isRead: false });
}

// Helper: Get payment gateway configuration
async function getPaymentGatewayConfig() {
    try {
        const settings = await PaymentSettings.findOne();
        const paymentEnabled = settings ? settings.paymentEnabled : true;
        const activeGateway = settings ? settings.activeGateway : 'razorpay';
        
        let gatewayConfig = { paymentEnabled, activeGateway };
        
        if (paymentEnabled) {
            if (activeGateway === 'razorpay') {
                gatewayConfig.razorpayKeyId = settings?.razorpay?.keyId || process.env.RAZORPAY_KEY_ID || '';
            } else if (activeGateway === 'easebuzz') {
                gatewayConfig.easebuzzMerchantKey = settings?.easebuzz?.merchantKey || process.env.EASEBUZZ_MERCHANT_KEY || '';
                gatewayConfig.easebuzzEnv = settings?.easebuzz?.env || 'test';
            }
        }
        
        return gatewayConfig;
    } catch (error) {
        return { paymentEnabled: true, activeGateway: 'razorpay', razorpayKeyId: process.env.RAZORPAY_KEY_ID || '' };
    }
}

// ==================== CERTIFICATE ROUTES ====================

// Download Certificate (User)
router.get('/certificates/:id/download', isAuthenticated, async (req, res) => {
    try {
        const certificate = await Certificate.findById(req.params.id).populate('fileId');
        if (!certificate) {
            return res.status(404).send('Certificate not found');
        }
        
        // Check if certificate belongs to user
        if (certificate.userId.toString() !== req.session.user.id) {
            return res.status(403).send('Access denied');
        }
        
        certificate.downloadCount += 1;
        await certificate.save();
        
        const file = certificate.fileId;
        res.set('Content-Type', file.contentType);
        res.set('Content-Disposition', `attachment; filename="${certificate.fileName}"`);
        res.send(file.data);
    } catch (error) {
        res.status(404).send('Certificate not found');
    }
});

// View Single Certificate
router.get('/certificates/:id', isAuthenticated, async (req, res) => {
    try {
        const certificate = await Certificate.findById(req.params.id)
            .populate('fileId')
            .populate('issuedBy', 'fullName');
        
        if (!certificate) {
            return res.status(404).render('404', { 
                title: 'Certificate Not Found',
                user: req.session.user 
            });
        }
        
        // Check if certificate belongs to user or user is admin
        if (certificate.userId.toString() !== req.session.user.id && req.session.user.role !== 'admin') {
            return res.status(403).render('403', { 
                title: 'Access Denied',
                message: 'You do not have permission to view this certificate.',
                user: req.session.user 
            });
        }
        
        const unreadCount = await getUnreadCount(req.session.user.id);
        
        res.render('certificate-detail', {
            title: `Certificate - ${certificate.serviceName}`,
            user: req.session.user,
            certificate,
            unreadCount
        });
    } catch (error) {
        console.error('Certificate view error:', error);
        res.status(404).render('404', { 
            title: 'Certificate Not Found',
            user: req.session.user 
        });
    }
});

// ==================== ANNOUNCEMENT ROUTES ====================

// Announcements Page (User)
router.get('/announcements', isAuthenticated, async (req, res) => {
    try {
        const announcements = await Announcement.find({ 
            isActive: true,
            $or: [
                { expiresAt: null },
                { expiresAt: { $gte: new Date() } }
            ]
        }).sort({ createdAt: -1 });
        
        const unreadCount = await getUnreadCount(req.session.user.id);
        
        res.render('announcements', {
            title: 'Announcements - Shubham Computer',
            user: req.session.user,
            announcements,
            unreadCount
        });
    } catch (error) {
        res.render('announcements', {
            title: 'Announcements',
            user: req.session.user,
            announcements: [],
            unreadCount: 0
        });
    }
});

// View Single Announcement
router.get('/announcements/:id', isAuthenticated, async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id)
            .populate('createdBy', 'fullName');
        
        if (!announcement) {
            return res.redirect('/announcements');
        }
        
        announcement.views += 1;
        await announcement.save();
        
        const unreadCount = await getUnreadCount(req.session.user.id);
        
        res.render('announcement-detail', {
            title: announcement.title,
            user: req.session.user,
            announcement,
            unreadCount
        });
    } catch (error) {
        res.redirect('/announcements');
    }
});

// Download Announcement Attachment
router.get('/announcements/:id/download', isAuthenticated, async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement || !announcement.attachment?.fileId) {
            return res.status(404).send('Attachment not found');
        }
        
        const file = await File.findById(announcement.attachment.fileId);
        if (!file) {
            return res.status(404).send('File not found');
        }
        
        res.set('Content-Type', file.contentType);
        res.set('Content-Disposition', `attachment; filename="${announcement.attachment.fileName}"`);
        res.send(file.data);
    } catch (error) {
        res.status(404).send('File not found');
    }
});

// ==================== MAIN PAGE ROUTES ====================

// Splash Screen
router.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/home');
    res.render('splash', { title: 'Shubham Computer' });
});

// Login Page
router.get('/login', isGuest, (req, res) => {
    res.render('login', { 
        title: 'Login - Shubham Computer',
        error: null,
        success: req.query.registered ? 'Registration successful!' : null
    });
});

// Signup Page
router.get('/signup', isGuest, (req, res) => {
    res.render('signup', { title: 'Sign Up - Shubham Computer', error: null });
});

// Home Page
router.get('/home', isAuthenticated, async (req, res) => {
    try {
        const stats = {
            totalRequests: await Request.countDocuments({ userId: req.session.user.id }),
            totalFiles: await File.countDocuments({ uploaderId: req.session.user.id }),
            pendingRequests: await Request.countDocuments({ userId: req.session.user.id, status: 'pending' })
        };
        const unreadCount = await getUnreadCount(req.session.user.id);
        
        res.render('home', {
            title: 'Home - Shubham Computer',
            user: req.session.user,
            stats,
            unreadCount
        });
    } catch (error) {
        res.render('home', { 
            title: 'Home', 
            user: req.session.user, 
            stats: { totalRequests: 0, totalFiles: 0, pendingRequests: 0 }, 
            unreadCount: 0 
        });
    }
});

// Profile Page
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        const requests = await Request.find({ userId: req.session.user.id }).sort({ createdAt: -1 });
        const unreadCount = await getUnreadCount(req.session.user.id);
        
        res.render('profile', { title: 'My Profile', user, requests, unreadCount });
    } catch (error) {
        res.redirect('/home');
    }
});

// My Requests Page
router.get('/requests', isAuthenticated, async (req, res) => {
    try {
        const requests = await Request.find({ userId: req.session.user.id }).sort({ createdAt: -1 });
        const unreadCount = await getUnreadCount(req.session.user.id);
        
        res.render('requests', { title: 'My Requests', user: req.session.user, requests: requests || [], unreadCount });
    } catch (error) {
        res.render('requests', { title: 'My Requests', user: req.session.user, requests: [], unreadCount: 0 });
    }
});

// Payments Page
router.get('/payments', isAuthenticated, async (req, res) => {
    try {
        const payments = await Request.find({ userId: req.session.user.id, paymentStatus: 'completed' }).sort({ createdAt: -1 });
        const totalSpent = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const unreadCount = await getUnreadCount(req.session.user.id);
        
        res.render('payments', { title: 'Payments', user: req.session.user, payments, totalSpent, unreadCount });
    } catch (error) {
        res.render('payments', { title: 'Payments', user: req.session.user, payments: [], totalSpent: 0, unreadCount: 0 });
    }
});

// Apply Services Page
router.get('/apply', isAuthenticated, async (req, res) => {
    try {
        const unreadCount = await getUnreadCount(req.session.user.id);
        res.render('apply', { title: 'Apply for Certificate', user: req.session.user, unreadCount });
    } catch (error) {
        res.render('apply', { title: 'Apply for Certificate', user: req.session.user, unreadCount: 0 });
    }
});

// Individual Service Application Form
router.get('/apply/:id', isAuthenticated, async (req, res) => {
    try {
        const service = await ServiceConfig.findById(req.params.id);
        if (!service || !service.isActive) return res.redirect('/apply');
        
        const unreadCount = await getUnreadCount(req.session.user.id);
        const gatewayConfig = await getPaymentGatewayConfig();
        
        res.render('apply-form', {
            title: `Apply for ${service.serviceName}`,
            user: req.session.user,
            service,
            unreadCount,
            paymentEnabled: gatewayConfig.paymentEnabled,
            activeGateway: gatewayConfig.activeGateway,
            gatewayConfig: gatewayConfig
        });
    } catch (error) {
        console.error('Apply form error:', error);
        res.redirect('/apply');
    }
});

// Application Success Page
router.get('/application-success', isAuthenticated, async (req, res) => {
    const { requestId, service } = req.query;
    const unreadCount = await getUnreadCount(req.session.user.id);
    
    try {
        await Notification.create({
            userId: req.session.user.id,
            title: 'Application Submitted',
            message: `Your application for ${service} has been submitted. Request ID: ${requestId}`,
            type: 'success',
            link: '/requests'
        });
    } catch (e) {
        console.error('Notification error:', e);
    }
    
    res.render('application-success', {
        title: 'Application Submitted',
        user: req.session.user,
        requestId: requestId || 'N/A',
        service: service || 'N/A',
        unreadCount
    });
});

// Upload Page
router.get('/upload-page', isAuthenticated, async (req, res) => {
    try {
        const unreadCount = await getUnreadCount(req.session.user.id);
        res.render('upload', { title: 'Upload Documents', user: req.session.user, message: null, error: null, unreadCount });
    } catch (error) {
        res.render('upload', { title: 'Upload Documents', user: req.session.user, message: null, error: null, unreadCount: 0 });
    }
});

// ==================== SUPPORT & MESSAGES ROUTES ====================

// Support Page
router.get('/support', isAuthenticated, async (req, res) => {
    try {
        const unreadCount = await getUnreadCount(req.session.user.id);
        res.render('support', { title: 'Support', user: req.session.user, unreadCount });
    } catch (error) {
        res.render('support', { title: 'Support', user: req.session.user, unreadCount: 0 });
    }
});

// Submit Support Message
router.post('/support/send', isAuthenticated, async (req, res) => {
    try {
        const { subject, message } = req.body;
        
        if (!subject || !message) {
            return res.status(400).json({ success: false, error: 'Subject and message are required' });
        }
        
        const contactMessage = new ContactMessage({
            userId: req.session.user.id,
            userName: req.session.user.fullName,
            userEmail: req.session.user.email,
            subject: subject,
            message: message,
            status: 'pending'
        });
        
        await contactMessage.save();
        
        // Notify admins
        const admins = await User.find({ role: 'admin' }).select('_id');
        
        for (const admin of admins) {
            await Notification.create({
                userId: admin._id,
                title: 'New Support Message',
                message: `${req.session.user.fullName} sent a message: ${subject}`,
                type: 'info',
                link: '/admin/messages'
            });
        }
        
        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Support message error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// My Messages Page (User)
router.get('/messages', isAuthenticated, async (req, res) => {
    try {
        const messages = await ContactMessage.find({ userId: req.session.user.id })
            .sort({ createdAt: -1 })
            .populate('repliedBy', 'fullName');
        
        const unreadCount = await getUnreadCount(req.session.user.id);
        
        res.render('messages', {
            title: 'My Messages - Shubham Computer',
            user: req.session.user,
            messages,
            unreadCount
        });
    } catch (error) {
        console.error('Messages error:', error);
        res.render('messages', {
            title: 'My Messages',
            user: req.session.user,
            messages: [],
            unreadCount: 0
        });
    }
});

// View Single Message (User)
router.get('/messages/:id', isAuthenticated, async (req, res) => {
    try {
        const message = await ContactMessage.findById(req.params.id)
            .populate('repliedBy', 'fullName');
        
        if (!message) {
            return res.redirect('/messages');
        }
        
        // Check if message belongs to user
        if (message.userId.toString() !== req.session.user.id) {
            return res.status(403).render('403', { 
                title: 'Access Denied',
                message: 'You do not have permission to view this message.',
                user: req.session.user 
            });
        }
        
        const unreadCount = await getUnreadCount(req.session.user.id);
        
        res.render('message-detail', {
            title: `Message: ${message.subject}`,
            user: req.session.user,
            message,
            unreadCount
        });
    } catch (error) {
        res.redirect('/messages');
    }
});

// ==================== NOTIFICATIONS ====================

// Notifications Page
router.get('/notifications', isAuthenticated, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.session.user.id }).sort({ createdAt: -1 }).limit(50);
        const unreadCount = await getUnreadCount(req.session.user.id);
        
        res.render('notifications', { title: 'Notifications', user: req.session.user, notifications, unreadCount });
    } catch (error) {
        res.render('notifications', { title: 'Notifications', user: req.session.user, notifications: [], unreadCount: 0 });
    }
});

// Mark notification as read
router.post('/notifications/:id/read', isAuthenticated, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== CERTIFICATES LIST ====================

// My Certificates Page
router.get('/certificates', isAuthenticated, async (req, res) => {
    try {
        const certificates = await Certificate.find({ userId: req.session.user.id }).sort({ issuedDate: -1 }).populate('fileId');
        const unreadCount = await getUnreadCount(req.session.user.id);
        
        res.render('certificates', { title: 'My Certificates', user: req.session.user, certificates, unreadCount });
    } catch (error) {
        res.render('certificates', { title: 'My Certificates', user: req.session.user, certificates: [], unreadCount: 0 });
    }
});

// ==================== LOGOUT ====================

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Logout error:', err);
        res.redirect('/login');
    });
});

module.exports = router;
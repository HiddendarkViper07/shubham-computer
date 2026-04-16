const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const { apiAuth, apiAdminAuth } = require('../middleware/auth');
const Request = require('../models/Request');
const File = require('../models/File');
const User = require('../models/User');
const ServiceConfig = require('../models/ServiceConfig');
const Notification = require('../models/Notification');
const PaymentSettings = require('../models/PaymentSettings');
const paymentService = require('../services/paymentService');

// Initialize Razorpay
const Razorpay = require('razorpay');

const docStorage = multer.memoryStorage();
const docUpload = multer({ storage: docStorage, limits: { fileSize: 2 * 1024 * 1024 } });

// Get service requirements
router.get('/service-requirements', async (req, res) => {
    try {
        const configs = await ServiceConfig.find({ isActive: true }).sort({ displayOrder: 1 });
        res.json(configs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get payment configuration for frontend
router.get('/payment-config', async (req, res) => {
    try {
        const config = await paymentService.getGatewayConfig();
        res.json({ success: true, config });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create Payment Order (Dynamic Gateway)
router.post('/create-order', apiAuth, async (req, res) => {
    try {
        const { amount, currency, receipt } = req.body;
        
        const settings = await PaymentSettings.findOne();
        const paymentEnabled = settings ? settings.paymentEnabled : true;
        const activeGateway = settings ? settings.activeGateway : 'razorpay';
        
        if (!paymentEnabled) {
            return res.json({ 
                success: true, 
                paymentSkipped: true,
                message: 'Payment is currently disabled'
            });
        }
        
        if (activeGateway === 'razorpay') {
            const razorpayKeyId = settings?.razorpay?.keyId || process.env.RAZORPAY_KEY_ID;
            const razorpayKeySecret = settings?.razorpay?.keySecret || process.env.RAZORPAY_KEY_SECRET;
            
            if (!razorpayKeyId || !razorpayKeySecret) {
                return res.status(400).json({ success: false, error: 'Razorpay not configured' });
            }
            
            const razorpay = new Razorpay({
                key_id: razorpayKeyId,
                key_secret: razorpayKeySecret
            });
            
            const order = await razorpay.orders.create({
                amount: amount * 100,
                currency: currency || 'INR',
                receipt: receipt || 'receipt_' + Date.now(),
                payment_capture: 1
            });
            
            res.json({
                success: true,
                gateway: 'razorpay',
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: razorpayKeyId
            });
            
        } else if (activeGateway === 'easebuzz') {
            res.json({
                success: true,
                gateway: 'easebuzz',
                merchantKey: settings?.easebuzz?.merchantKey || process.env.EASEBUZZ_MERCHANT_KEY,
                env: settings?.easebuzz?.env || 'test'
            });
        } else {
            res.json({ success: true, paymentSkipped: true });
        }
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify Payment
router.post('/verify-payment', apiAuth, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, gateway } = req.body;
        
        const settings = await PaymentSettings.findOne();
        
        if (gateway === 'razorpay' || !gateway) {
            const razorpayKeySecret = settings?.razorpay?.keySecret || process.env.RAZORPAY_KEY_SECRET;
            
            if (!razorpayKeySecret) {
                return res.status(400).json({ success: false, error: 'Razorpay secret not configured' });
            }
            
            const generatedSignature = crypto
                .createHmac('sha256', razorpayKeySecret)
                .update(razorpay_order_id + '|' + razorpay_payment_id)
                .digest('hex');
            
            if (generatedSignature === razorpay_signature) {
                res.json({ success: true, message: 'Payment verified' });
            } else {
                res.status(400).json({ success: false, error: 'Invalid signature' });
            }
        } else {
            res.json({ success: true, message: 'Payment verified' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit request - FIXED: Added docUpload.none() to parse multipart form data
router.post('/submit-request', apiAuth, docUpload.none(), async (req, res) => {
    try {
        console.log('📝 Submit request body:', req.body);
        
        const { 
            serviceName, 
            fullName, 
            email, 
            mobile, 
            address, 
            note, 
            razorpay_payment_id, 
            razorpay_order_id, 
            razorpay_signature, 
            fileIds,
            paymentSkipped 
        } = req.body;
        
        // Validate required fields
        if (!serviceName) {
            return res.status(400).json({ success: false, error: 'Service name is required' });
        }
        if (!fullName) {
            return res.status(400).json({ success: false, error: 'Full name is required' });
        }
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required' });
        }
        
        let serviceConfig = await ServiceConfig.findOne({ serviceName });
        const processingFee = serviceConfig ? serviceConfig.processingFee : 50;
        const requestId = 'REQ' + Date.now() + Math.floor(Math.random() * 1000);
        
        const uploadedFileIds = [];
        if (fileIds) {
            try {
                const ids = JSON.parse(fileIds);
                for (const fileId of ids) {
                    const file = await File.findById(fileId);
                    if (file) {
                        uploadedFileIds.push({ 
                            fileId: file._id, 
                            fileName: file.originalName, 
                            uploadDate: new Date() 
                        });
                    }
                }
            } catch (e) {
                console.error('Error parsing fileIds:', e);
            }
        }
        
        const requiredDocs = serviceConfig ? 
            serviceConfig.requiredDocuments.filter(d => d.isRequired).map(d => d.name) : 
            ["Aadhar Card", "PAN Card"];
        
        // Determine payment status
        let paymentStatus = 'completed';
        let paymentMethod = 'Razorpay';
        let amount = processingFee;
        let transactionId = razorpay_payment_id || 'TXN' + Date.now();
        
        if (paymentSkipped === 'true') {
            paymentStatus = 'completed';
            paymentMethod = 'Free';
            amount = 0;
            transactionId = 'FREE' + Date.now();
        }
        
        const request = new Request({
            requestId,
            userId: req.session.user.id,
            userName: fullName,
            userEmail: email,
            serviceName: serviceName,
            requiredDocs,
            uploadedFiles: uploadedFileIds,
            extraMessage: note || '',
            amount: amount,
            paymentMethod: paymentMethod,
            paymentStatus: paymentStatus,
            transactionId: transactionId,
            status: 'pending',
            address: address || '',
            mobile: mobile || ''
        });
        
        await request.save();
        console.log('✅ Request saved:', requestId);
        
        // Create notification
        await Notification.create({
            userId: req.session.user.id,
            title: 'Application Submitted',
            message: `Your application for ${serviceName} has been submitted. Request ID: ${requestId}`,
            type: 'success',
            link: '/requests'
        });
        
        res.json({ success: true, requestId, message: 'Request submitted successfully' });
        
    } catch (error) {
        console.error('❌ Submit request error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user's requests
router.get('/my-requests', apiAuth, async (req, res) => {
    try {
        const requests = await Request.find({ userId: req.session.user.id }).sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user's files
router.get('/my-files', apiAuth, async (req, res) => {
    try {
        const files = await File.find({ uploaderId: req.session.user.id }).select('-data').sort({ uploadDate: -1 });
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get unread count
router.get('/unread-count', apiAuth, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ userId: req.session.user.id, isRead: false });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update profile
router.put('/profile', apiAuth, async (req, res) => {
    try {
        const { fullName, mobile, aadharNumber } = req.body;
        await User.findByIdAndUpdate(req.session.user.id, { fullName, mobile, aadharNumber });
        req.session.user.fullName = fullName;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get payment settings
router.get('/admin/payment-settings', apiAdminAuth, async (req, res) => {
    try {
        let settings = await PaymentSettings.findOne();
        if (!settings) {
            settings = new PaymentSettings();
            await settings.save();
        }
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Update payment settings
router.post('/admin/payment-settings', apiAdminAuth, async (req, res) => {
    try {
        const { paymentEnabled, activeGateway, razorpay, easebuzz } = req.body;
        
        let settings = await PaymentSettings.findOne();
        if (!settings) settings = new PaymentSettings();
        
        settings.paymentEnabled = paymentEnabled;
        settings.activeGateway = activeGateway;
        settings.razorpay = razorpay;
        settings.easebuzz = easebuzz;
        
        await settings.save();
        paymentService.settings = null;
        
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get service configs
router.get('/admin/service-configs', apiAdminAuth, async (req, res) => {
    try {
        const configs = await ServiceConfig.find().sort({ displayOrder: 1 });
        res.json(configs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Create/Update service config
router.post('/admin/service-configs', apiAdminAuth, async (req, res) => {
    try {
        const { serviceName, description, requiredDocuments, processingFee, estimatedDays, isActive, displayOrder } = req.body;
        let config = await ServiceConfig.findOne({ serviceName });
        
        if (config) {
            Object.assign(config, { description, requiredDocuments, processingFee, estimatedDays, isActive, displayOrder });
        } else {
            config = new ServiceConfig({ serviceName, description, requiredDocuments, processingFee, estimatedDays, isActive, displayOrder });
        }
        await config.save();
        res.json({ success: true, config });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Delete service config
router.delete('/admin/service-configs/:id', apiAdminAuth, async (req, res) => {
    try {
        await ServiceConfig.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get stats
router.get('/admin/stats', apiAdminAuth, async (req, res) => {
    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const stats = {
            todayRequests: await Request.countDocuments({ createdAt: { $gte: today } }),
            pendingRequests: await Request.countDocuments({ status: 'pending' }),
            totalUsers: await User.countDocuments({ role: 'user' }),
            totalFiles: await File.countDocuments()
        };
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create notification
router.post('/create-notification', apiAuth, async (req, res) => {
    try {
        const { title, message, type, link } = req.body;
        const notification = new Notification({ userId: req.session.user.id, title, message, type, link });
        await notification.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
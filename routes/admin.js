const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');
const User = require('../models/User');
const File = require('../models/File');
const Request = require('../models/Request');
const Certificate = require('../models/Certificate');
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const multer = require('multer');

// Configure multer for certificate and announcement uploads
const certStorage = multer.memoryStorage();
const certUpload = multer({ 
    storage: certStorage, 
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for certificates
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF and images are allowed.'));
        }
    }
});

// ==================== DASHBOARD ====================
router.get('/dashboard', isAdmin, async (req, res) => {
    try {
        const stats = {
            totalUsers: await User.countDocuments({ role: 'user' }),
            totalRequests: await Request.countDocuments(),
            pendingRequests: await Request.countDocuments({ status: 'pending' }),
            completedRequests: await Request.countDocuments({ status: 'completed' }),
            totalFiles: await File.countDocuments(),
            totalCertificates: await Certificate.countDocuments(),
            recentRequests: await Request.find().sort({ createdAt: -1 }).limit(10).populate('userId', 'fullName email'),
            recentUsers: await User.find({ role: 'user' }).sort({ createdAt: -1 }).limit(5)
        };
        
        const totalRevenue = await Request.aggregate([
            { $match: { paymentStatus: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        res.render('admin/dashboard', { 
            title: 'Admin Dashboard', 
            user: req.session.user, 
            stats, 
            totalRevenue: totalRevenue[0]?.total || 0 
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render('admin/dashboard', { 
            title: 'Admin Dashboard', 
            user: req.session.user, 
            stats: { totalUsers: 0, totalRequests: 0, pendingRequests: 0, completedRequests: 0, totalFiles: 0, totalCertificates: 0, recentRequests: [], recentUsers: [] }, 
            totalRevenue: 0 
        });
    }
});

// ==================== USERS ====================
router.get('/users', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        
        let query = { role: 'user' };
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        const users = await User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
        const total = await User.countDocuments(query);
        
        res.render('admin/users', { 
            title: 'Manage Users', 
            user: req.session.user, 
            users, 
            search,
            pagination: { page, totalPages: Math.ceil(total / limit), total } 
        });
    } catch (error) {
        console.error('Users error:', error);
        res.render('admin/users', { 
            title: 'Manage Users', 
            user: req.session.user, 
            users: [], 
            search: '',
            pagination: { page: 1, totalPages: 1, total: 0 } 
        });
    }
});

router.get('/users/:id', isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.redirect('/admin/users');
        
        const requests = await Request.find({ userId: user._id }).sort({ createdAt: -1 });
        const files = await File.find({ uploaderId: user._id }).sort({ uploadDate: -1 });
        const certificates = await Certificate.find({ userId: user._id }).sort({ issuedDate: -1 });
        
        res.render('admin/user-detail', { 
            title: `User: ${user.fullName}`, 
            adminUser: req.session.user, 
            user, 
            requests, 
            files,
            certificates
        });
    } catch (error) {
        console.error('User detail error:', error);
        res.redirect('/admin/users');
    }
});

// Update user KYC status
router.put('/users/:id/kyc', isAdmin, async (req, res) => {
    try {
        const { kycStatus } = req.body;
        await User.findByIdAndUpdate(req.params.id, { kycStatus });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== REQUESTS ====================
router.get('/requests', isAdmin, async (req, res) => {
    try {
        const filter = req.query.status || 'all';
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        if (filter !== 'all') query.status = filter;
        
        const requests = await Request.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'fullName email');
        
        const total = await Request.countDocuments(query);
        
        const statusCounts = {
            all: await Request.countDocuments(),
            pending: await Request.countDocuments({ status: 'pending' }),
            processing: await Request.countDocuments({ status: 'processing' }),
            completed: await Request.countDocuments({ status: 'completed' }),
            rejected: await Request.countDocuments({ status: 'rejected' })
        };
        
        res.render('admin/requests', { 
            title: 'Manage Requests', 
            user: req.session.user, 
            requests, 
            filter, 
            statusCounts, 
            pagination: { page, totalPages: Math.ceil(total / limit), total } 
        });
    } catch (error) {
        console.error('Requests error:', error);
        res.render('admin/requests', { 
            title: 'Manage Requests', 
            user: req.session.user, 
            requests: [], 
            filter: 'all', 
            statusCounts: {}, 
            pagination: { page: 1, totalPages: 1, total: 0 } 
        });
    }
});

router.get('/requests/:id', isAdmin, async (req, res) => {
    try {
        const request = await Request.findById(req.params.id)
            .populate('userId', 'fullName email mobile')
            .populate('uploadedFiles.fileId');
        
        if (!request) return res.redirect('/admin/requests');
        
        // Check if certificate already issued for this request
        const existingCertificate = await Certificate.findOne({ requestId: request.requestId });
        
        res.render('admin/request-detail', { 
            title: `Request ${request.requestId}`, 
            user: req.session.user, 
            request,
            existingCertificate
        });
    } catch (error) {
        console.error('Request detail error:', error);
        res.redirect('/admin/requests');
    }
});

router.post('/requests/:id/status', isAdmin, async (req, res) => {
    try {
        const { status, adminNote } = req.body;
        const request = await Request.findById(req.params.id);
        
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        request.status = status;
        request.adminNote = adminNote;
        if (status === 'completed' || status === 'rejected') {
            request.processedBy = req.session.user.id;
            request.processedAt = new Date();
        }
        await request.save();
        
        // Notify user
        await Notification.create({
            userId: request.userId,
            title: 'Request Status Updated',
            message: `Your request for ${request.serviceName} is now ${status}.`,
            type: status === 'completed' ? 'success' : 'info',
            link: '/requests'
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Status update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== CERTIFICATES ====================
router.post('/requests/:id/issue-certificate', isAdmin, certUpload.single('certificate'), async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        if (request.status !== 'completed') {
            return res.status(400).json({ error: 'Request must be completed first' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'Certificate file is required' });
        }
        
        // Check if certificate already exists
        const existingCert = await Certificate.findOne({ requestId: request.requestId });
        if (existingCert) {
            return res.status(400).json({ error: 'Certificate already issued for this request' });
        }
        
        // Save certificate file
        const certFile = new File({
            originalName: req.file.originalname,
            uploader: req.session.user.fullName,
            uploaderId: req.session.user.id,
            contentType: req.file.mimetype,
            size: req.file.size,
            data: req.file.buffer,
            category: 'certificate'
        });
        await certFile.save();
        
        // Create certificate record
        const certificateId = await Certificate.generateCertificateId();
        const validUntil = req.body.validUntil ? new Date(req.body.validUntil) : new Date();
        if (!req.body.validUntil) {
            validUntil.setFullYear(validUntil.getFullYear() + 1); // Valid for 1 year
        }
        
        const certificate = new Certificate({
            certificateId,
            requestId: request.requestId,
            userId: request.userId,
            userName: request.userName,
            userEmail: request.userEmail,
            serviceName: request.serviceName,
            fileId: certFile._id,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            issuedBy: req.session.user.id,
            issuedByName: req.session.user.fullName,
            issuedDate: new Date(),
            validUntil: validUntil,
            notes: req.body.notes || ''
        });
        await certificate.save();
        
        // Update request with certificate info
        request.certificateId = certificateId;
        request.certificateIssuedDate = new Date();
        await request.save();
        
        // Send notification to user
        await Notification.create({
            userId: request.userId,
            title: '📜 Certificate Issued',
            message: `Your certificate for ${request.serviceName} has been issued. Download it from My Certificates section.`,
            type: 'success',
            link: '/certificates'
        });
        
        res.json({ 
            success: true, 
            certificateId: certificate.certificateId,
            message: 'Certificate issued successfully' 
        });
        
    } catch (error) {
        console.error('Issue certificate error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/certificates/:id/download', isAdmin, async (req, res) => {
    try {
        const certificate = await Certificate.findById(req.params.id).populate('fileId');
        if (!certificate) {
            return res.status(404).send('Certificate not found');
        }
        
        certificate.downloadCount += 1;
        await certificate.save();
        
        const file = certificate.fileId;
        res.set('Content-Type', file.contentType);
        res.set('Content-Disposition', `attachment; filename="${certificate.fileName}"`);
        res.send(file.data);
    } catch (error) {
        console.error('Certificate download error:', error);
        res.status(404).send('Certificate not found');
    }
});

// ==================== FILES ====================
router.get('/files', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 24;
        const skip = (page - 1) * limit;
        
        const files = await File.find()
            .sort({ uploadDate: -1 })
            .skip(skip)
            .limit(limit)
            .populate('uploaderId', 'fullName email');
        
        const total = await File.countDocuments();
        const users = await User.find({ role: 'user' }).select('fullName email _id');
        
        const stats = { 
            totalFiles: total, 
            totalSize: await File.aggregate([{ $group: { _id: null, total: { $sum: '$size' } } }]) 
        };
        
        res.render('admin/files', { 
            title: 'File Management', 
            user: req.session.user, 
            files, 
            users, 
            stats, 
            pagination: { page, totalPages: Math.ceil(total / limit), total } 
        });
    } catch (error) {
        console.error('Files error:', error);
        res.render('admin/files', { 
            title: 'File Management', 
            user: req.session.user, 
            files: [], 
            users: [], 
            stats: { totalFiles: 0 }, 
            pagination: { page: 1, totalPages: 1, total: 0 } 
        });
    }
});

// ==================== ANNOUNCEMENTS ====================
router.get('/announcements', isAdmin, async (req, res) => {
    try {
        const announcements = await Announcement.find()
            .sort({ createdAt: -1 })
            .populate('createdBy', 'fullName');
        
        res.render('admin/announcements', {
            title: 'Announcements - Admin',
            user: req.session.user,
            announcements
        });
    } catch (error) {
        console.error('Announcements error:', error);
        res.render('admin/announcements', {
            title: 'Announcements - Admin',
            user: req.session.user,
            announcements: []
        });
    }
});

router.post('/announcements', isAdmin, certUpload.single('attachment'), async (req, res) => {
    try {
        const { title, content, type, targetUsers, link, expiresAt } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }
        
        const announcement = new Announcement({
            title,
            content,
            type: type || 'general',
            targetUsers: targetUsers || 'all',
            link: link || null,
            createdBy: req.session.user.id,
            expiresAt: expiresAt || null
        });
        
        // Handle attachment if uploaded
        if (req.file) {
            const attachmentFile = new File({
                originalName: req.file.originalname,
                uploader: req.session.user.fullName,
                uploaderId: req.session.user.id,
                contentType: req.file.mimetype,
                size: req.file.size,
                data: req.file.buffer,
                category: 'announcement'
            });
            await attachmentFile.save();
            
            announcement.attachment = {
                fileName: req.file.originalname,
                fileId: attachmentFile._id
            };
        }
        
        await announcement.save();
        
        // Send notifications to users based on target
        let userQuery = { role: 'user' };
        if (targetUsers === 'active') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            userQuery.lastLogin = { $gte: thirtyDaysAgo };
        } else if (targetUsers === 'new') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            userQuery.createdAt = { $gte: sevenDaysAgo };
        }
        
        const users = await User.find(userQuery).select('_id');
        
        // Create notifications in bulk
        if (users.length > 0) {
            const notifications = users.map(user => ({
                userId: user._id,
                title: `📢 ${title}`,
                message: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
                type: type === 'important' ? 'warning' : 'info',
                link: '/announcements'
            }));
            
            await Notification.insertMany(notifications);
        }
        
        res.json({ 
            success: true, 
            message: `Announcement created and sent to ${users.length} users` 
        });
        
    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/announcements/:id', isAdmin, async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) {
            return res.status(404).json({ error: 'Announcement not found' });
        }
        
        // Delete attachment file if exists
        if (announcement.attachment?.fileId) {
            await File.findByIdAndDelete(announcement.attachment.fileId);
        }
        
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete announcement error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.put('/announcements/:id/toggle', isAdmin, async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) {
            return res.status(404).json({ error: 'Announcement not found' });
        }
        
        announcement.isActive = !announcement.isActive;
        await announcement.save();
        res.json({ success: true, isActive: announcement.isActive });
    } catch (error) {
        console.error('Toggle announcement error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== SERVICES ====================
router.get('/services', isAdmin, (req, res) => {
    res.render('admin/services', { title: 'Service Configuration', user: req.session.user });
});

// ==================== SETTINGS ====================
router.get('/settings', isAdmin, (req, res) => {
    res.render('admin/settings', { title: 'Settings', user: req.session.user });
});
const ContactMessage = require('../models/ContactMessage');

// Messages Page
router.get('/messages', isAdmin, async (req, res) => {
    try {
        const filter = req.query.status || 'all';
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        if (filter !== 'all') query.status = filter;
        
        const messages = await ContactMessage.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'fullName email');
        
        const total = await ContactMessage.countDocuments(query);
        
        const statusCounts = {
            all: await ContactMessage.countDocuments(),
            pending: await ContactMessage.countDocuments({ status: 'pending' }),
            read: await ContactMessage.countDocuments({ status: 'read' }),
            replied: await ContactMessage.countDocuments({ status: 'replied' }),
            resolved: await ContactMessage.countDocuments({ status: 'resolved' })
        };
        
        res.render('admin/messages', {
            title: 'Support Messages - Admin',
            user: req.session.user,
            messages,
            filter,
            statusCounts,
            pagination: { page, totalPages: Math.ceil(total / limit), total }
        });
    } catch (error) {
        console.error('Messages error:', error);
        res.render('admin/messages', {
            title: 'Support Messages - Admin',
            user: req.session.user,
            messages: [],
            filter: 'all',
            statusCounts: {},
            pagination: { page: 1, totalPages: 1, total: 0 }
        });
    }
});

// View Single Message
router.get('/messages/:id', isAdmin, async (req, res) => {
    try {
        const message = await ContactMessage.findById(req.params.id)
            .populate('userId', 'fullName email mobile')
            .populate('repliedBy', 'fullName');
        
        if (!message) {
            return res.redirect('/admin/messages');
        }
        
        // Mark as read if pending
        if (message.status === 'pending') {
            message.status = 'read';
            await message.save();
        }
        
        res.render('admin/message-detail', {
            title: `Message: ${message.subject}`,
            user: req.session.user,
            message
        });
    } catch (error) {
        res.redirect('/admin/messages');
    }
});

// Reply to Message
router.post('/messages/:id/reply', isAdmin, async (req, res) => {
    try {
        const { reply } = req.body;
        
        if (!reply) {
            return res.status(400).json({ success: false, error: 'Reply is required' });
        }
        
        const message = await ContactMessage.findById(req.params.id);
        
        message.adminReply = reply;
        message.status = 'replied';
        message.repliedBy = req.session.user.id;
        message.repliedAt = new Date();
        
        await message.save();
        
        // Notify user
        const Notification = require('../models/Notification');
        // Notify user - This is CORRECT
        await Notification.create({
            userId: message.userId,  // ✅ Only the specific user who sent the message
            title: 'Reply to Your Support Message',
            message: `Admin replied to your message: "${message.subject}"`,
            type: 'success',
            link: '/messages'
        });
        
        res.json({ success: true, message: 'Reply sent successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update Message Status
router.post('/messages/:id/status', isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        
        const message = await ContactMessage.findById(req.params.id);
        message.status = status;
        await message.save();
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete Message
router.delete('/messages/:id', isAdmin, async (req, res) => {
    try {
        await ContactMessage.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
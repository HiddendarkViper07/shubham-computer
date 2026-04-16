const express = require('express');
const router = express.Router();
const multer = require('multer');
const File = require('../models/File');
const { isAuthenticated } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        allowedTypes.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
    }
});

// Upload Page
router.get('/', isAuthenticated, async (req, res) => {
    const Notification = require('../models/Notification');
    const unreadCount = await Notification.countDocuments({ userId: req.session.user.id, isRead: false });
    res.render('upload', { title: 'Upload Documents', user: req.session.user, message: null, error: null, unreadCount });
});

// Handle file upload
router.post('/', isAuthenticated, upload.array('files', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.render('upload', { title: 'Upload', user: req.session.user, message: null, error: 'Please select files', unreadCount: 0 });
        }

        for (const file of req.files) {
            let category = 'other';
            if (file.mimetype.startsWith('image/')) category = 'image';
            else if (file.mimetype === 'application/pdf') category = 'pdf';
            
            const newFile = new File({
                originalName: file.originalname,
                uploader: req.session.user.fullName,
                uploaderId: req.session.user.id,
                contentType: file.mimetype,
                size: file.size,
                data: file.buffer,
                category
            });
            await newFile.save();
        }

        const Notification = require('../models/Notification');
        const unreadCount = await Notification.countDocuments({ userId: req.session.user.id, isRead: false });
        res.render('upload', { title: 'Upload', user: req.session.user, message: `✅ Uploaded ${req.files.length} file(s)!`, error: null, unreadCount });
    } catch (error) {
        res.render('upload', { title: 'Upload', user: req.session.user, message: null, error: 'Upload failed: ' + error.message, unreadCount: 0 });
    }
});

// Single file upload for progress tracking
router.post('/single', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        let category = 'other';
        if (req.file.mimetype.startsWith('image/')) category = 'image';
        else if (req.file.mimetype === 'application/pdf') category = 'pdf';
        
        const newFile = new File({
            originalName: req.file.originalname,
            uploader: req.session.user.fullName,
            uploaderId: req.session.user.id,
            contentType: req.file.mimetype,
            size: req.file.size,
            data: req.file.buffer,
            category
        });
        await newFile.save();
        res.json({ success: true, fileId: newFile._id, fileName: req.file.originalname });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// AJAX upload
router.post('/ajax', isAuthenticated, upload.array('files', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });
        const savedFiles = [];
        for (const file of req.files) {
            let category = 'other';
            if (file.mimetype.startsWith('image/')) category = 'image';
            else if (file.mimetype === 'application/pdf') category = 'pdf';
            
            const newFile = new File({
                originalName: file.originalname,
                uploader: req.session.user.fullName,
                uploaderId: req.session.user.id,
                contentType: file.mimetype,
                size: file.size,
                data: file.buffer,
                category
            });
            await newFile.save();
            savedFiles.push({ id: newFile._id, name: file.originalname });
        }
        res.json({ success: true, message: `Uploaded ${savedFiles.length} file(s)`, files: savedFiles });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// View file
router.get('/file/:id', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).send('File not found');
        file.views += 1;
        await file.save();
        res.set('Content-Type', file.contentType);
        res.set('Content-Disposition', `inline; filename="${file.originalName}"`);
        res.send(file.data);
    } catch (error) {
        res.status(404).send('File not found');
    }
});

// Download file
router.get('/download/:id', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).send('File not found');
        file.downloads += 1;
        await file.save();
        res.set('Content-Type', file.contentType);
        res.set('Content-Disposition', `attachment; filename="${file.originalName}"`);
        res.send(file.data);
    } catch (error) {
        res.status(404).send('File not found');
    }
});

// Delete file
router.delete('/file/:id', isAuthenticated, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ error: 'File not found' });
        if (file.uploaderId.toString() !== req.session.user.id && req.session.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        await File.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'File deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
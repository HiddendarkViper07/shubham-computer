const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
};

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.status(403).render('403', {
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
        user: req.session.user || null
    });
};

const isGuest = (req, res, next) => {
    if (!req.session.user) {
        return next();
    }
    res.redirect('/home');
};

const apiAuth = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
};

const apiAdminAuth = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Forbidden' });
};

module.exports = {
    isAuthenticated,
    isAdmin,
    isGuest,
    apiAuth,
    apiAdminAuth
};
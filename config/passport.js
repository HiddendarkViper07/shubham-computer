const passport = require('passport');
const User = require('../models/User');

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

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const GoogleStrategy = require('passport-google-oauth20').Strategy;
    
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8081/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email found'), null);
            
            let fullName = profile.displayName;
            if (!fullName && profile.name) {
                fullName = `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim();
            }
            if (!fullName) fullName = email.split('@')[0];
            
            let user = await User.findOne({ email });
            
            if (!user) {
                user = new User({
                    fullName,
                    email,
                    profileImage: profile.photos?.[0]?.value || null,
                    googleId: profile.id,
                    isVerified: true,
                    role: 'user',
                    kycStatus: 'pending'
                });
                await user.save();
            } else {
                if (!user.googleId) user.googleId = profile.id;
                if (!user.profileImage) user.profileImage = profile.photos?.[0]?.value;
                await user.save();
            }
            
            return done(null, user);
        } catch (error) {
            return done(error, null);
        }
    }));
    console.log('✅ Google OAuth configured');
}

// Facebook Strategy
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    const FacebookStrategy = require('passport-facebook').Strategy;
    
    passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:8081/auth/facebook/callback',
        profileFields: ['id', 'displayName', 'photos', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value || `${profile.id}@facebook.com`;
            let fullName = profile.displayName || email.split('@')[0];
            
            let user = await User.findOne({ email });
            
            if (!user) {
                user = new User({
                    fullName,
                    email,
                    profileImage: profile.photos?.[0]?.value || null,
                    facebookId: profile.id,
                    isVerified: true,
                    role: 'user',
                    kycStatus: 'pending'
                });
                await user.save();
            } else {
                if (!user.facebookId) user.facebookId = profile.id;
                await user.save();
            }
            
            return done(null, user);
        } catch (error) {
            return done(error, null);
        }
    }));
    console.log('✅ Facebook OAuth configured');
}

// Apple Strategy
if (process.env.APPLE_CLIENT_ID) {
    try {
        const AppleStrategy = require('passport-apple');
        passport.use(new AppleStrategy({
            clientID: process.env.APPLE_CLIENT_ID,
            teamID: process.env.APPLE_TEAM_ID,
            keyID: process.env.APPLE_KEY_ID,
            privateKeyString: process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            callbackURL: process.env.APPLE_CALLBACK_URL || 'http://localhost:8081/auth/apple/callback'
        }, async (accessToken, refreshToken, idToken, profile, done) => {
            try {
                const email = idToken?.email || profile?.email;
                let user = await User.findOne({ email });
                
                if (!user) {
                    user = new User({
                        fullName: profile?.name || 'Apple User',
                        email,
                        appleId: profile?.sub || idToken?.sub,
                        isVerified: true,
                        role: 'user',
                        kycStatus: 'pending'
                    });
                    await user.save();
                } else {
                    user.appleId = profile?.sub || idToken?.sub;
                    await user.save();
                }
                
                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }));
        console.log('✅ Apple OAuth configured');
    } catch (e) {
        console.log('⚠️ Apple OAuth not configured');
    }
}

module.exports = passport;
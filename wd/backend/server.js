
/**
 * server.js - EduManage Application Entry Point
 *
 * Responsibilities:
 * - Load environment variables
 * - Configure Express middleware
 * - Configure persistent MySQL-backed sessions
 * - Mount API routes
 * - Serve frontend assets and SPA routes
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MySQLSessionStore = require('./stores/mysql-session-store');
const path = require('path');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;

// Fail fast if the session secret is missing or too short.
if (
    typeof sessionSecret !== 'string' ||
    sessionSecret.length < 32
) {
    throw new Error(
        'Configuration error: SESSION_SECRET must be set to at least 32 characters in the environment.'
    );
}

// Configure proxy trust deliberately for deployments behind a trusted proxy.
if (isProduction && process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
}

// ==============================================================================
// GLOBAL MIDDLEWARE
// ==============================================================================

app.use(express.json({ limit: '100kb' }));

app.use(express.urlencoded({
    extended: true,
    limit: '100kb'
}));

// Serve static frontend assets.
app.use(express.static(path.join(__dirname, '..', 'public')));

// ==============================================================================
// SESSION CONFIGURATION
// ==============================================================================

const sessionStore = new MySQLSessionStore();

app.use(session({
    name: 'edumanage.sid',
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000
    }
}));

// ==============================================================================
// API ROUTES
// ==============================================================================

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const marksRoutes = require('./routes/marks');

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/marks', marksRoutes);

// ==============================================================================
// API 404 HANDLER
// ==============================================================================

app.use('/api', (req, res, next) => {
    if (res.headersSent) {
        return next();
    }

    return res.status(404).json({
        error: 'API endpoint not found'
    });
});

// ==============================================================================
// FRONTEND SPA FALLBACK
// ==============================================================================

app.get('*', (req, res) => {
    res.sendFile(
        path.join(__dirname, '..', 'public', 'index.html'),
        (err) => {
            if (err && !res.headersSent) {
                console.error('Frontend delivery error:', err);
                res.status(500).send('Unable to load the application.');
            }
        }
    );
});

// ==============================================================================
// ERROR HANDLER
// ==============================================================================

app.use((err, req, res, next) => {
    console.error('Unhandled application error:', err.message);

    if (res.headersSent) {
        return next(err);
    }

    return res.status(500).json({
        error: 'Internal server error'
    });
});

// ==============================================================================
// START SERVER
// ==============================================================================

if (require.main === module) {
    app.listen(PORT, () => {
        console.log('==============================================');
        console.log('EduManage server started');
        console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
        console.log(`Port: ${PORT}`);
        console.log(`Frontend: http://localhost:${PORT}`);
        console.log('==============================================');
    });
}

module.exports = app;

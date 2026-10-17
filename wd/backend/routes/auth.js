// ==============================================================================
// routes/auth.js - Authentication & Authorization Routes
// ==============================================================================
// This file handles user authentication including login, registration, session checks,
// and logout. It also exports role-based access control (RBAC) middleware.
//
// Key Concepts for Viva:
// 1. Password Hashing (bcrypt): Plaintext passwords should NEVER be stored in the database.
//    bcrypt uses a salt and slow hashing algorithm to protect against rainbow table and brute-force attacks.
// 2. Session-Based Authentication: Upon login, user data is stored server-side in the session,
//    and a secure, signed cookie (connect.sid) is sent to the client browser.
// 3. Middleware (requireAuth, requireAdmin): Express middleware functions execute during the lifecycle
//    of an HTTP request to intercept and protect routes based on login status and roles.
// ==============================================================================

const express = require('express');
const router = express.Router();

// Support native bcrypt with fallback to bcryptjs
let bcrypt;
try {
    bcrypt = require('bcrypt');
} catch (e) {
    bcrypt = require('bcryptjs');
}

const pool = require('../db');

// ==============================================================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ==============================================================================

/**
 * Middleware: requireAuth
 * Checks if a user session exists. If not, blocks access and returns 401 Unauthorized.
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            error: 'Unauthorized: Please log in to access this resource'
        });
    }
    next();
}

/**
 * Middleware: requireAdmin
 * Checks if the user is authenticated AND holds the 'admin' role.
 * If not admin, blocks access and returns 403 Forbidden.
 */
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            error: 'Unauthorized: Please log in to access this resource'
        });
    }
    if (req.session.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Forbidden: Administrator privileges required'
        });
    }
    next();
}

// ==============================================================================
// AUTH ROUTES
// ==============================================================================

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user credentials, initiate session, and return user profile
 * @access  Public
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Input validation
        if (!username || !password) {
            return res.status(400).json({
                error: 'Please provide both username and password'
            });
        }

        // Query database for user by username
        // Using parameterized query (?) prevents SQL Injection attacks
        const [users] = await pool.query(
    `SELECT
        u.id,
        u.username,
        u.password,
        u.role,
        s.id AS student_id
     FROM users u
     LEFT JOIN students s ON s.user_id = u.id
     WHERE u.username = ?`,
    [username.trim()]
);

        if (users.length === 0) {
            return res.status(401).json({
                error: 'Invalid username or password'
            });
        }

        const user = users[0];

        // Compare incoming plaintext password against hashed password in database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                error: 'Invalid username or password'
            });
        }

        // Save authenticated user info into the session (excluding sensitive password)
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            student_id: user.student_id
        };

        return res.json({
            message: 'Login successful',
            user: req.session.user
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({
            error: 'Internal server error during login'
        });
    }
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account.
 *          Regular users can register student accounts; only an admin can create admin accounts.
 * @access  Public (Student) / Admin (for Admin accounts)
 */

router.post('/register', requireAdmin, async (req, res) => {
    const {
        username,
        password,
        role = 'student',
        student_id
    } = req.body;

    // Validate the username.
    if (
        typeof username !== 'string' ||
        !/^[a-zA-Z0-9._-]{3,50}$/.test(username.trim())
    ) {
        return res.status(400).json({
            error: 'Username must be 3–50 characters and contain only letters, numbers, dots, underscores, or hyphens'
        });
    }

    // bcrypt safely supports passwords up to 72 UTF-8 bytes.
    if (
        typeof password !== 'string' ||
        password.length < 12 ||
        Buffer.byteLength(password, 'utf8') > 72
    ) {
        return res.status(400).json({
            error: 'Password must be at least 12 characters and no more than 72 UTF-8 bytes'
        });
    }

    if (!['student', 'admin'].includes(role)) {
        return res.status(400).json({
            error: 'Role must be student or admin'
        });
    }

    // Student accounts must link to a valid, unlinked student record.
    if (
        role === 'student' &&
        (!Number.isSafeInteger(Number(student_id)) ||
         Number(student_id) < 1 ||
         String(student_id).trim() !== String(Number(student_id)))
    ) {
        return res.status(400).json({
            error: 'A valid student_id is required for student accounts'
        });
    }

    if (role === 'admin' && student_id != null && student_id !== '') {
        return res.status(400).json({
            error: 'Admin accounts cannot be linked to student records'
        });
    }

    let connection;

    try {
        const cleanUsername = username.trim();
        const hashedPassword = await bcrypt.hash(password, 12);

        connection = await pool.getConnection();
        await connection.beginTransaction();

        if (role === 'student') {
            const [students] = await connection.query(
                'SELECT id, user_id FROM students WHERE id = ? FOR UPDATE',
                [Number(student_id)]
            );

            if (students.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    error: 'Student record not found'
                });
            }

            if (students[0].user_id !== null) {
                await connection.rollback();
                return res.status(409).json({
                    error: 'This student already has a linked account'
                });
            }
        }

        const [result] = await connection.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [cleanUsername, hashedPassword, role]
        );

        if (role === 'student') {
            await connection.query(
                'UPDATE students SET user_id = ? WHERE id = ? AND user_id IS NULL',
                [result.insertId, Number(student_id)]
            );
        }

        await connection.commit();

        return res.status(201).json({
            message: 'Account created successfully',
            user: {
                id: result.insertId,
                username: cleanUsername,
                role,
                student_id: role === 'student' ? Number(student_id) : null
            }
        });
    } catch (err) {
        if (connection) {
            await connection.rollback().catch(() => {});
        }

        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'Username already exists'
            });
        }

        console.error('Registration error:', err);
        return res.status(500).json({
            error: 'Account creation failed'
        });
    } finally {
        if (connection) connection.release();
    }
});


/**
 * @route   GET /api/auth/me
 * @desc    Get currently logged in user session information
 * @access  Public (returns user profile or null)
 */
router.get('/me', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            authenticated: false,
            error: 'Not authenticated',
            user: null
        });
    }

    return res.json({
        authenticated: true,
        user: req.session.user
    });
});

/**
 * @route   POST /api/auth/logout
 * @desc    Destroy current session and clear authentication cookie
 * @access  Public
 */
router.post('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                console.error('Logout session destruction error:', err);
                return res.status(500).json({
                    error: 'Failed to logout, please try again'
                });
            }
            res.clearCookie('edumanage.sid', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
});
            return res.json({
                message: 'Logged out successfully'
            });
        });
    } else {
        return res.json({
            message: 'Logged out successfully'
        });
    }
});

// Export router along with the middleware functions so other routes can use them
router.requireAuth = requireAuth;
router.requireAdmin = requireAdmin;

module.exports = router;
module.exports.router = router;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;

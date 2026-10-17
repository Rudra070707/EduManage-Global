
/**
 * mysql-session-store.js - Persistent Express session storage
 *
 * Features:
 * - Persistent MySQL-backed Express sessions
 * - Compatible with a least-privilege database account
 * - Does not create or modify database tables at runtime
 * - Session expiration and periodic cleanup
 * - Safe parameterized SQL queries
 */

const session = require('express-session');
const pool = require('../db');

class MySQLSessionStore extends session.Store {
    constructor(options = {}) {
        super();

        this.tableName = options.tableName || 'sessions';
        this.cleanupInterval =
            options.cleanupInterval ?? 15 * 60 * 1000;

        if (!/^[a-zA-Z0-9_]+$/.test(this.tableName)) {
            throw new Error('Invalid session table name.');
        }

        if (
            !Number.isFinite(this.cleanupInterval) ||
            this.cleanupInterval < 1000
        ) {
            throw new Error('Invalid session cleanup interval.');
        }

        // Verify that the existing session table is accessible.
        // No CREATE privilege is required.
        this.ready = this.initialize();

        this.cleanupTimer = setInterval(() => {
            this.cleanup().catch(error => {
                console.error(
                    'Session cleanup failed:',
                    error.code || error.message
                );
            });
        }, this.cleanupInterval);

        // Do not keep Node.js running solely for this timer.
        this.cleanupTimer.unref();
    }

    async initialize() {
        try {
            // Verify the table exists without creating or changing it.
            await pool.execute(
                `SELECT session_id
                 FROM \`${this.tableName}\`
                 LIMIT 0`
            );

            // Important: do not call this.cleanup() here.
            // cleanup() awaits this.ready, which is this.initialize()
            // promise. Doing so would cause a circular wait.
            await pool.execute(
                `DELETE FROM \`${this.tableName}\`
                 WHERE expires <= ?`,
                [Date.now()]
            );

            console.log('MySQL session store initialized.');
        } catch (error) {
            console.error(
                'MySQL session store initialization failed:',
                error.code || error.message
            );

            throw new Error(
                `Cannot initialize session store using table "${this.tableName}". ` +
                'Verify that the table exists and the database account has ' +
                'SELECT and DELETE permissions.'
            );
        }
    }

    get(sid, callback) {
        this.getSession(sid)
            .then(data => callback(null, data))
            .catch(error => callback(error));
    }

    async getSession(sid) {
        await this.ready;

        const [rows] = await pool.execute(
            `SELECT data, expires
             FROM \`${this.tableName}\`
             WHERE session_id = ?
             LIMIT 1`,
            [sid]
        );

        if (rows.length === 0) {
            return null;
        }

        if (Number(rows[0].expires) <= Date.now()) {
            await this.destroySession(sid);
            return null;
        }

        return JSON.parse(rows[0].data);
    }

    set(sid, sessionData, callback = () => {}) {
        this.saveSession(sid, sessionData)
            .then(() => callback(null))
            .catch(error => callback(error));
    }

    async saveSession(sid, sessionData) {
        await this.ready;

        const expires = sessionData.cookie?.expires
            ? new Date(sessionData.cookie.expires).getTime()
            : Date.now() + 2 * 60 * 60 * 1000;

        if (!Number.isFinite(expires)) {
            throw new Error('Invalid session expiration time.');
        }

        await pool.execute(
            `INSERT INTO \`${this.tableName}\`
                (session_id, expires, data)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
                expires = VALUES(expires),
                data = VALUES(data)`,
            [sid, expires, JSON.stringify(sessionData)]
        );
    }

    touch(sid, sessionData, callback = () => {}) {
        this.touchSession(sid, sessionData)
            .then(() => callback(null))
            .catch(error => callback(error));
    }

    async touchSession(sid, sessionData) {
        await this.ready;

        const expires = sessionData.cookie?.expires
            ? new Date(sessionData.cookie.expires).getTime()
            : Date.now() + 2 * 60 * 60 * 1000;

        if (!Number.isFinite(expires)) {
            throw new Error('Invalid session expiration time.');
        }

        await pool.execute(
            `UPDATE \`${this.tableName}\`
             SET expires = ?
             WHERE session_id = ?`,
            [expires, sid]
        );
    }

    destroy(sid, callback = () => {}) {
        this.destroySession(sid)
            .then(() => callback(null))
            .catch(error => callback(error));
    }

    async destroySession(sid) {
        await this.ready;

        await pool.execute(
            `DELETE FROM \`${this.tableName}\`
             WHERE session_id = ?`,
            [sid]
        );
    }

    async cleanup() {
        // Safe for periodic calls after initialization.
        await this.ready;

        await pool.execute(
            `DELETE FROM \`${this.tableName}\`
             WHERE expires <= ?`,
            [Date.now()]
        );
    }

    close() {
        clearInterval(this.cleanupTimer);
    }
}

module.exports = MySQLSessionStore;


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

        // Validate the table name before using it in SQL.
        if (!/^[a-zA-Z0-9_]+$/.test(this.tableName)) {
            throw new Error('Invalid session table name.');
        }

        if (
            !Number.isFinite(this.cleanupInterval) ||
            this.cleanupInterval < 1000
        ) {
            throw new Error('Invalid session cleanup interval.');
        }

        // Start initialization once. Other operations wait for this promise.
        this.ready = this.initialize();

        // Periodically remove expired sessions.
        this.cleanupTimer = setInterval(() => {
            this.cleanup().catch(error => {
                console.error(
                    'Session cleanup failed:',
                    error.code || error.message
                );
            });
        }, this.cleanupInterval);

        // Prevent the timer alone from keeping Node.js running.
        this.cleanupTimer.unref();
    }

    /**
     * Verify that the existing sessions table is accessible,
     * then remove expired sessions.
     *
     * Requires SELECT and DELETE permissions.
     * Does not create or alter tables.
     */
    async initialize() {
        try {
            await pool.execute(
                `SELECT session_id
                 FROM \`${this.tableName}\`
                 LIMIT 0`
            );

            await pool.execute(
                `DELETE FROM \`${this.tableName}\`
                 WHERE expires <= ?`,
                [Date.now()]
            );

            console.log('MySQL session store initialized.');
        } catch (error) {
            // Log the underlying MySQL error code for diagnosis.
            console.error(
                'MySQL session store initialization failed:',
                error.code || error.message
            );

            throw new Error(
                `Cannot initialize session store using table "${this.tableName}". ` +
                'Verify the database connection, table existence, and ' +
                'SELECT and DELETE permissions.'
            );
        }
    }

    /**
     * Retrieve a session using the Express Store callback API.
     */
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

    /**
     * Save or update a session.
     */
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

    /**
     * Update the expiration time without rewriting session data.
     */
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

    /**
     * Destroy a session using the Express Store callback API.
     */
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

    /**
     * Remove expired sessions.
     */
    async cleanup() {
        // Wait for initialization before running cleanup.
        await this.ready;

        await pool.execute(
            `DELETE FROM \`${this.tableName}\`
             WHERE expires <= ?`,
            [Date.now()]
        );
    }

    /**
     * Stop the periodic cleanup timer.
     */
    close() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
}

module.exports = MySQLSessionStore;

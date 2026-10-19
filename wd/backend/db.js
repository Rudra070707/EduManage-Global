
/**
 * db.js - EduManage Database Connection Pool
 *
 * Development:
 *   Uses the existing .env configuration with local-only defaults.
 *
 * Production:
 *   Requires explicit database configuration and rejects unsafe defaults.
 *
 * Security:
 *   - Never logs database passwords.
 *   - Validates configuration before creating the pool.
 *   - Uses a reusable mysql2/promise connection pool.
 *   - Exposes an initial connection check for startup verification.
 */

require('dotenv').config();

const mysql = require('mysql2/promise');

const isProduction = process.env.NODE_ENV === 'production';

function getDatabaseConfig() {
    const requiredVariables = [
        'DB_HOST',
        'DB_USER',
        'DB_PASSWORD',
        'DB_NAME'
    ];

    if (isProduction) {
        const missingVariables = requiredVariables.filter(name => {
            const value = process.env[name];
            return !value || value.trim() === '';
        });

        if (missingVariables.length > 0) {
            throw new Error(
                'Production database configuration is incomplete. ' +
                `Set the following environment variables: ${missingVariables.join(', ')}.`
            );
        }

        if (process.env.DB_USER.trim().toLowerCase() === 'root') {
            throw new Error(
                'Production must use a dedicated MySQL application account, not root.'
            );
        }
    }

    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD ?? '';
    const database = process.env.DB_NAME || 'student_management';

    const rawPort = process.env.DB_PORT || '3306';
    const port = Number(rawPort);

    if (
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
    ) {
        throw new Error(
            'Invalid DB_PORT. Specify a valid port between 1 and 65535.'
        );
    }

    if (
        typeof host !== 'string' ||
        host.trim() === '' ||
        typeof user !== 'string' ||
        user.trim() === '' ||
        typeof database !== 'string' ||
        database.trim() === ''
    ) {
        throw new Error(
            'Database host, user, and database name must not be empty.'
        );
    }

    if (
        /[\u0000-\u001f\u007f]/.test(host) ||
        /[\u0000-\u001f\u007f]/.test(user) ||
        /[\u0000-\u001f\u007f]/.test(database)
    ) {
        throw new Error(
            'Database configuration contains invalid control characters.'
        );
    }

    return {
        host: host.trim(),
        port,
        user: user.trim(),
        password,
        database: database.trim(),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };
}

const databaseConfig = getDatabaseConfig();

const pool = mysql.createPool(databaseConfig);

/**
 * Test the database connection.
 *
 * This check does not print credentials or the full connection
 * configuration. The pool remains available to the application.
 */
const connectionCheck = (async () => {
    let connection;

    try {
        connection = await pool.getConnection();

        await connection.query('SELECT 1');

        console.log(
            `Connected to MySQL database successfully (${databaseConfig.database}).`
        );

        return true;
    } catch (error) {
        console.error(
            'Failed to connect to MySQL database. ' +
            'Check the MySQL service and database configuration.'
        );

        // Print only the error code, not credentials or connection details.
        console.error(
            'Database error code:',
            error.code || 'UNKNOWN'
        );

        if (isProduction) {
            throw error;
        }

        return false;
    } finally {
        if (connection) {
            connection.release();
        }
    }
})();

module.exports = pool;
module.exports.connectionCheck = connectionCheck;

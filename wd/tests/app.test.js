
jest.mock('../backend/db', () => ({
    query: jest.fn(),
    execute: jest.fn(),
    getConnection: jest.fn()
}));

jest.mock('../backend/stores/mysql-session-store', () => {
    const session = require('express-session');

    return class MockSessionStore extends session.Store {
        constructor() {
            super();
        }

        get(sid, callback) {
            callback(null, null);
        }

        set(sid, sessionData, callback) {
            callback(null);
        }

        destroy(sid, callback) {
            callback(null);
        }

        touch(sid, sessionData, callback) {
            callback(null);
        }
    };
});

process.env.SESSION_SECRET =
    'test-only-session-secret-at-least-32-characters-long';

const request = require('supertest');
const app = require('../backend/server');
const pool = require('../backend/db');

describe('EduManage application', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==========================================
    // 1. APPLICATION AND FRONTEND TESTS
    // ==========================================

    test('serves the frontend for the root URL', async () => {
        const response = await request(app).get('/');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/html/);
    });

    test('returns 404 JSON for an unknown API endpoint', async () => {
        const response = await request(app).get('/api/not-a-real-route');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            error: 'API endpoint not found'
        });
    });

    // ==========================================
    // 2. AUTHENTICATION TESTS
    // ==========================================

    test('rejects unauthenticated requests for the current user', async () => {
        const response = await request(app).get('/api/auth/me');

        expect(response.status).toBe(401);
        expect(response.body.authenticated).toBe(false);
        expect(response.body.user).toBeNull();
    });

    test('rejects login when username and password are missing', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(
            /provide both username and password/i
        );

        expect(pool.query).not.toHaveBeenCalled();
    });

    test('rejects login when the password is missing', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'teststudent'
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(
            /provide both username and password/i
        );

        expect(pool.query).not.toHaveBeenCalled();
    });

    test('rejects login when the username does not exist', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'missingstudent',
                password: 'WrongPassword123!'
            });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe(
            'Invalid username or password'
        );
    });

    // ==========================================
    // 3. STUDENT ACCESS-CONTROL TESTS
    // ==========================================

    test('rejects unauthenticated access to student records', async () => {
        const response = await request(app).get('/api/students');

        expect(response.status).toBe(401);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('rejects unauthenticated access to individual student profiles', async () => {
        const response = await request(app).get('/api/students/10');

        expect(response.status).toBe(401);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('rejects unauthenticated access to marks', async () => {
        const response = await request(app).get('/api/marks');

        expect(response.status).toBe(401);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('rejects unauthenticated access to individual student marks', async () => {
        const response = await request(app)
            .get('/api/marks/student/10');

        expect(response.status).toBe(401);
        expect(pool.query).not.toHaveBeenCalled();
    });
});


jest.mock('../backend/db', () => ({
    query: jest.fn(),
    execute: jest.fn(),
    getConnection: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const pool = require('../backend/db');

const studentRoutes = require('../backend/routes/students');
const marksRoutes = require('../backend/routes/marks');

// This is an isolated test app, not the production server.
// Test headers simulate identities only inside this test app.
const app = express();

app.use(express.json());

app.use((req, res, next) => {
    const role = req.headers['x-test-role'];
    const studentId = req.headers['x-test-student-id'];

    if (role === 'student' || role === 'admin') {
        req.session = {
            user: {
                id: role === 'admin' ? 1 : 2,
                username: role === 'admin' ? 'testadmin' : 'teststudent',
                role,
                student_id: role === 'student'
                    ? Number(studentId || 10)
                    : null
            }
        };
    } else {
        req.session = {};
    }

    next();
});

app.use('/api/students', studentRoutes);
app.use('/api/marks', marksRoutes);

describe('EduManage authorization tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('allows a student to view their own profile', async () => {
        pool.query.mockResolvedValueOnce([[
            {
                id: 10,
                name: 'Test Student',
                roll_number: 'TEST10'
            }
        ]]);

        const response = await request(app)
            .get('/api/students/10')
            .set('x-test-role', 'student')
            .set('x-test-student-id', '10');

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(10);
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('prevents a student from viewing another student profile', async () => {
        const response = await request(app)
            .get('/api/students/20')
            .set('x-test-role', 'student')
            .set('x-test-student-id', '10');

        expect(response.status).toBe(403);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('prevents students from listing all student records', async () => {
        const response = await request(app)
            .get('/api/students')
            .set('x-test-role', 'student')
            .set('x-test-student-id', '10');

        expect(response.status).toBe(403);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('allows an administrator to list student records', async () => {
        pool.query.mockResolvedValueOnce([[
            {
                id: 10,
                name: 'Test Student',
                roll_number: 'TEST10'
            }
        ]]);

        const response = await request(app)
            .get('/api/students')
            .set('x-test-role', 'admin');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('allows a student to request their own marks', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
            .get('/api/marks/student/10')
            .set('x-test-role', 'student')
            .set('x-test-student-id', '10');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(pool.query.mock.calls[0][1]).toEqual([10]);
    });

    test('prevents a student from viewing another student marks', async () => {
        const response = await request(app)
            .get('/api/marks/student/20')
            .set('x-test-role', 'student')
            .set('x-test-student-id', '10');

        expect(response.status).toBe(403);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('prevents students from listing all marks', async () => {
        const response = await request(app)
            .get('/api/marks')
            .set('x-test-role', 'student')
            .set('x-test-student-id', '10');

        expect(response.status).toBe(403);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('allows an administrator to list all marks', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
            .get('/api/marks')
            .set('x-test-role', 'admin');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('rejects invalid student IDs', async () => {
        const response = await request(app)
            .get('/api/students/abc')
            .set('x-test-role', 'student')
            .set('x-test-student-id', '10');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid student ID');
        expect(pool.query).not.toHaveBeenCalled();
    });
});

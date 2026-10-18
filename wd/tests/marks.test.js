
jest.mock('../backend/db', () => ({
    query: jest.fn(),
    execute: jest.fn(),
    getConnection: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const pool = require('../backend/db');
const marksRoutes = require('../backend/routes/marks');

const app = express();
app.use(express.json());

// Test-only identity simulation.
// These headers exist only in this isolated test app.
app.use((req, res, next) => {
    const role = req.headers['x-test-role'];

    if (role === 'admin' || role === 'student') {
        req.session = {
            user: {
                id: role === 'admin' ? 1 : 2,
                username: role === 'admin' ? 'testadmin' : 'teststudent',
                role,
                student_id: role === 'student' ? 10 : null
            }
        };
    } else {
        req.session = {};
    }

    next();
});

app.use('/api/marks', marksRoutes);

describe('EduManage marks validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const adminRequest = () =>
        request(app)
            .post('/api/marks')
            .set('x-test-role', 'admin');

    test('rejects marks creation without a student ID', async () => {
        const response = await adminRequest().send({
            semester: 3,
            subject1: 80
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/student id and semester are required/i);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('rejects marks creation without a semester', async () => {
        const response = await adminRequest().send({
            student_id: 10,
            subject1: 80
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/student id and semester are required/i);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test.each([-1, 101, 'not-a-number'])(
        'rejects invalid subject mark: %s',
        async (invalidMark) => {
            const response = await adminRequest().send({
                student_id: 10,
                semester: 3,
                subject1: invalidMark
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(
                /each subject mark must be between 0 and 100/i
            );
            expect(pool.query).not.toHaveBeenCalled();
        }
    );

    test('rejects marks for a student that does not exist', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await adminRequest().send({
            student_id: 9999,
            semester: 3,
            subject1: 80,
            subject2: 80,
            subject3: 80,
            subject4: 80,
            subject5: 80
        });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Student not found');
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('rejects a semester that does not match the student record', async () => {
        pool.query.mockResolvedValueOnce([[
            { id: 10, semester: 4 }
        ]]);

        const response = await adminRequest().send({
            student_id: 10,
            semester: 3,
            subject1: 80,
            subject2: 80,
            subject3: 80,
            subject4: 80,
            subject5: 80
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/semester does not match/i);
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('rejects marks when a record already exists', async () => {
        pool.query
            .mockResolvedValueOnce([[
                { id: 10, semester: 3 }
            ]])
            .mockResolvedValueOnce([[
                { id: 25 }
            ]]);

        const response = await adminRequest().send({
            student_id: 10,
            semester: 3,
            subject1: 80,
            subject2: 80,
            subject3: 80,
            subject4: 80,
            subject5: 80
        });

        expect(response.status).toBe(409);
        expect(response.body.error).toMatch(/marks already exist/i);
        expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('rejects student attempts to create marks', async () => {
        const response = await request(app)
            .post('/api/marks')
            .set('x-test-role', 'student')
            .send({
                student_id: 10,
                semester: 3,
                subject1: 80
            });

        expect(response.status).toBe(403);
        expect(pool.query).not.toHaveBeenCalled();
    });
});


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

// Test-only authentication; not used by the production server.
app.use((req, res, next) => {
    const role = req.headers['x-test-role'];

    if (role === 'admin') {
        req.session = {
            user: {
                id: 1,
                username: 'testadmin',
                role: 'admin',
                student_id: null
            }
        };
    } else {
        req.session = {};
    }

    next();
});

app.use('/api/marks', marksRoutes);

describe('EduManage grade calculation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const gradeCases = [
        [0, 'F'],
        [39, 'F'],
        [40, 'E'],
        [49, 'E'],
        [50, 'D'],
        [59, 'D'],
        [60, 'C'],
        [69, 'C'],
        [70, 'B'],
        [79, 'B'],
        [80, 'A'],
        [89, 'A'],
        [90, 'A+'],
        [100, 'A+']
    ];

    test.each(gradeCases)(
        'assigns grade %s-average boundary correctly: expected %s',
        async (score, expectedGrade) => {
            pool.query
                .mockResolvedValueOnce([[
                    { id: 10, semester: 3 }
                ]])
                .mockResolvedValueOnce([[]])
                .mockResolvedValueOnce([{
                    insertId: 77,
                    affectedRows: 1
                }])
                .mockResolvedValueOnce([[
                    {
                        id: 77,
                        student_id: 10,
                        grade: expectedGrade
                    }
                ]]);

            const response = await request(app)
                .post('/api/marks')
                .set('x-test-role', 'admin')
                .send({
                    student_id: 10,
                    semester: 3,
                    subject1: score,
                    subject2: score,
                    subject3: score,
                    subject4: score,
                    subject5: score
                });

            expect(response.status).toBe(201);
            expect(response.body.marks.grade).toBe(expectedGrade);

            // Verify the route calculated the expected grade
            // and included it in the INSERT parameters.
            expect(pool.query.mock.calls[2][1]).toEqual([
                10,
                score,
                score,
                score,
                score,
                score,
                expectedGrade
            ]);
        }
    );
});

describe('EduManage marks update validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns 404 when the marks record does not exist', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
            .put('/api/marks/9999')
            .set('x-test-role', 'admin')
            .send({
                subject1: 80
            });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Marks record not found');
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test.each([-1, 101, 'invalid'])(
        'rejects an invalid updated mark: %s',
        async invalidScore => {
            pool.query.mockResolvedValueOnce([[
                {
                    id: 5,
                    student_id: 10,
                    subject1: 70,
                    subject2: 70,
                    subject3: 70,
                    subject4: 70,
                    subject5: 70
                }
            ]]);

            const response = await request(app)
                .put('/api/marks/5')
                .set('x-test-role', 'admin')
                .send({
                    subject1: invalidScore
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(
                /each subject mark must be between 0 and 100/i
            );

            // Only the initial SELECT should run.
            expect(pool.query).toHaveBeenCalledTimes(1);
        }
    );

    test('updates marks and recalculates the grade', async () => {
        pool.query
            .mockResolvedValueOnce([[
                {
                    id: 5,
                    student_id: 10,
                    subject1: 60,
                    subject2: 60,
                    subject3: 60,
                    subject4: 60,
                    subject5: 60
                }
            ]])
            .mockResolvedValueOnce([{
                affectedRows: 1
            }])
            .mockResolvedValueOnce([[
                {
                    id: 5,
                    student_id: 10,
                    subject1: 80,
                    subject2: 80,
                    subject3: 80,
                    subject4: 80,
                    subject5: 80,
                    grade: 'A'
                }
            ]]);

        const response = await request(app)
            .put('/api/marks/5')
            .set('x-test-role', 'admin')
            .send({
                subject1: 80,
                subject2: 80,
                subject3: 80,
                subject4: 80,
                subject5: 80
            });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Marks updated successfully');
        expect(response.body.marks.grade).toBe('A');

        // UPDATE parameters: five subject scores, grade, record ID.
        expect(pool.query.mock.calls[1][1]).toEqual([
            80, 80, 80, 80, 80, 'A', '5'
        ]);
    });
});

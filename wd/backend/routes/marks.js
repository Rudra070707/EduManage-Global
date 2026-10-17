
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireAdmin } = require('./auth');

// Calculate letter grade from percentage.
// These thresholds preserve grade A at 80%, as shown in your UI.
function calculateGrade(percentage) {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    if (percentage >= 40) return 'E';
    return 'F';
}

// Semester is stored on the student record in the current schema.
const marksSelect = `
    SELECT
        m.id,
        m.student_id,
        s.semester,
        m.subject1,
        m.subject2,
        m.subject3,
        m.subject4,
        m.subject5,
        m.total,
        m.percentage,
        m.grade,
        m.created_at,
        CONCAT_WS(' ', s.first_name, s.last_name) AS student_name,
        s.roll_no AS roll_number,
        s.course AS department
    FROM marks m
    JOIN students s ON m.student_id = s.id
`;

router.get('/', requireAuth, async (req, res) => {
    try {
        const currentUser = req.session.user;

        if (currentUser.role !== 'admin') {
            return res.status(403).json({
                error: 'Forbidden: Administrator privileges required'
            });
        }

        const [rows] = await pool.query(
            marksSelect + ' ORDER BY s.roll_no ASC, s.semester ASC'
        );

        return res.json(rows);
    } catch (err) {
        console.error('Error retrieving marks:', err);
        return res.status(500).json({
            error: 'Failed to retrieve marks'
        });
    }
});

// GET /api/marks/student/:studentId

 // GET /api/marks/student/:studentId
router.get('/student/:studentId', requireAuth, async (req, res) => {
    try {
        const requestedStudentId = Number(req.params.studentId);
        const currentUser = req.session.user;

        if (!Number.isInteger(requestedStudentId) || requestedStudentId <= 0) {
            return res.status(400).json({
                error: 'Invalid student ID'
            });
        }

        // Students may access only their own marks.
        if (currentUser.role !== 'admin') {
            const linkedStudentId = Number(currentUser.student_id);

            if (
                !currentUser.student_id ||
                !Number.isInteger(linkedStudentId) ||
                linkedStudentId !== requestedStudentId
            ) {
                return res.status(403).json({
                    error: 'You can only view your own marks'
                });
            }
        }

        const [rows] = await pool.query(
            marksSelect + ' WHERE m.student_id = ? ORDER BY s.semester ASC',
            [requestedStudentId]
        );

        return res.json(rows);
    } catch (err) {
        console.error('Error retrieving student marks:', err);
        return res.status(500).json({
            error: 'Failed to retrieve marks for student'
        });
    }
});


// POST /api/marks - Create a marks record.
router.post('/', requireAdmin, async (req, res) => {
    try {
        const {
            student_id,
            semester,
            subject1 = 0,
            subject2 = 0,
            subject3 = 0,
            subject4 = 0,
            subject5 = 0
        } = req.body;

        if (
            !student_id ||
            semester === undefined ||
            semester === null ||
            semester === ''
        ) {
            return res.status(400).json({
                error: 'Student ID and semester are required'
            });
        }

        const scores = [
            subject1,
            subject2,
            subject3,
            subject4,
            subject5
        ].map(Number);

        if (
            scores.some(
                score =>
                    !Number.isFinite(score) ||
                    score < 0 ||
                    score > 100
            )
        ) {
            return res.status(400).json({
                error: 'Each subject mark must be between 0 and 100'
            });
        }

        // Verify that the student exists and the semester matches.
        const [students] = await pool.query(
            'SELECT id, semester FROM students WHERE id = ?',
            [student_id]
        );

        if (!students.length) {
            return res.status(404).json({
                error: 'Student not found'
            });
        }

        if (
            Number(students[0].semester) !== Number(semester)
        ) {
            return res.status(400).json({
                error: 'Selected semester does not match the student record. Update the student semester first.'
            });
        }

        // This schema allows one marks record per student.
        const [existing] = await pool.query(
            'SELECT id FROM marks WHERE student_id = ?',
            [student_id]
        );

        if (existing.length) {
            return res.status(409).json({
                error: 'Marks already exist for this student. Use Edit to update them.'
            });
        }

        // MySQL generates total and percentage automatically.
        // Calculate the percentage here only to determine the grade.
        const total = scores.reduce((sum, score) => sum + score, 0);
        const percentage = total / 5;
        const grade = calculateGrade(percentage);

        const [result] = await pool.query(
            `INSERT INTO marks
                (
                    student_id,
                    subject1,
                    subject2,
                    subject3,
                    subject4,
                    subject5,
                    grade
                )
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [student_id, ...scores, grade]
        );

        const [rows] = await pool.query(
            marksSelect + ' WHERE m.id = ?',
            [result.insertId]
        );

        return res.status(201).json({
            message: 'Marks recorded successfully',
            marks: rows[0]
        });
    } catch (err) {
        console.error('Error adding marks:', err);
        return res.status(500).json({
            error: 'Failed to record marks'
        });
    }
});

// PUT /api/marks/:id - Update an existing marks record.
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const fields = [
            'subject1',
            'subject2',
            'subject3',
            'subject4',
            'subject5'
        ];

        const [existing] = await pool.query(
            'SELECT * FROM marks WHERE id = ?',
            [id]
        );

        if (!existing.length) {
            return res.status(404).json({
                error: 'Marks record not found'
            });
        }

        const old = existing[0];

        const scores = fields.map(field => {
            const value = req.body[field];

            return value === undefined
                ? Number(old[field])
                : Number(value);
        });

        if (
            scores.some(
                score =>
                    !Number.isFinite(score) ||
                    score < 0 ||
                    score > 100
            )
        ) {
            return res.status(400).json({
                error: 'Each subject mark must be between 0 and 100'
            });
        }

        // Recalculate and persist the grade after editing marks.
        const total = scores.reduce((sum, score) => sum + score, 0);
        const percentage = total / 5;
        const grade = calculateGrade(percentage);

        await pool.query(
            `UPDATE marks
             SET
                subject1 = ?,
                subject2 = ?,
                subject3 = ?,
                subject4 = ?,
                subject5 = ?,
                grade = ?
             WHERE id = ?`,
            [...scores, grade, id]
        );

        const [rows] = await pool.query(
            marksSelect + ' WHERE m.id = ?',
            [id]
        );

        return res.json({
            message: 'Marks updated successfully',
            marks: rows[0]
        });
    } catch (err) {
        console.error('Error updating marks:', err);
        return res.status(500).json({
            error: 'Failed to update marks'
        });
    }
});

// DELETE /api/marks/:id - Delete a marks record.
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await pool.query(
            'SELECT id FROM marks WHERE id = ?',
            [id]
        );

        if (!existing.length) {
            return res.status(404).json({
                error: 'Marks record not found'
            });
        }

        await pool.query(
            'DELETE FROM marks WHERE id = ?',
            [id]
        );

        return res.json({
            message: 'Marks record deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting marks:', err);
        return res.status(500).json({
            error: 'Failed to delete marks record'
        });
    }
});

module.exports = router;

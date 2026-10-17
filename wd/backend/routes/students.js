
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireAdmin } = require('./auth');

// Return database columns using the names expected by the frontend.
const studentSelect = `
    SELECT
        id,
        user_id,
        roll_no AS roll_number,
        CONCAT_WS(' ', first_name, last_name) AS name,
        first_name,
        last_name,
        email,
        phone,
        course AS department,
        academic_year AS year,
        semester,
        gender,
        dob,
        address,
        created_at,
        updated_at
    FROM students
`;

// GET /api/students
// Only administrators may list, search, and filter all students.
router.get('/', requireAdmin, async (req, res) => {
    try {
        const { search, department, year } = req.query;

        let sql = studentSelect + ' WHERE 1=1';
        const params = [];

        if (search && String(search).trim()) {
            const term = `%${String(search).trim()}%`;

            sql += ` AND (
                CONCAT_WS(' ', first_name, last_name) LIKE ?
                OR roll_no LIKE ?
                OR email LIKE ?
            )`;

            params.push(term, term, term);
        }

        if (department && String(department).trim()) {
            sql += ' AND course = ?';
            params.push(String(department).trim());
        }

        if (
            year !== undefined &&
            String(year).trim() !== '' &&
            !isNaN(year)
        ) {
            sql += ' AND academic_year = ?';
            params.push(parseInt(year, 10));
        }

        sql += ' ORDER BY id DESC';

        const [students] = await pool.query(sql, params);

        return res.json(students);
    } catch (err) {
        console.error('Error fetching students:', err);

        return res.status(500).json({
            error: 'Failed to retrieve students'
        });
    }
});

// GET /api/students/:id
// Administrators may view any student.
// Students may view only their own linked profile.
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const requestedId = String(req.params.id);
        const user = req.session.user;

        // Validate the requested ID.
        if (!/^\d+$/.test(requestedId)) {
            return res.status(400).json({
                error: 'Invalid student ID'
            });
        }

        // Enforce student-level authorization before querying the profile.
        if (user.role !== 'admin') {
            if (
                user.role !== 'student' ||
                user.student_id == null ||
                String(user.student_id) !== requestedId
            ) {
                return res.status(403).json({
                    error: 'Forbidden: You can access only your own student profile'
                });
            }
        }

        const [rows] = await pool.query(
            studentSelect + ' WHERE id = ?',
            [requestedId]
        );

        if (!rows.length) {
            return res.status(404).json({
                error: 'Student not found'
            });
        }

        return res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching student:', err);

        return res.status(500).json({
            error: 'Failed to retrieve student details'
        });
    }
});

// POST /api/students
// Only administrators may create student profiles.
router.post('/', requireAdmin, async (req, res) => {
    try {
        const {
            roll_number,
            name,
            email,
            phone,
            department,
            year,
            address
        } = req.body;

        if (
            typeof roll_number !== 'string' ||
            !roll_number.trim() ||
            typeof name !== 'string' ||
            !name.trim() ||
            typeof email !== 'string' ||
            !email.trim() ||
            typeof phone !== 'string' ||
            !phone.trim() ||
            typeof department !== 'string' ||
            !department.trim() ||
            year === undefined ||
            year === null ||
            String(year).trim() === ''
        ) {
            return res.status(400).json({
                error: 'Please fill in all required student fields'
            });
        }

        const parsedYear = Number(year);

        if (
            !Number.isInteger(parsedYear) ||
            parsedYear < 1 ||
            parsedYear > 10
        ) {
            return res.status(400).json({
                error: 'Academic year must be a valid integer between 1 and 10'
            });
        }

        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts.shift();
        const lastName = nameParts.join(' ');

        const [result] = await pool.query(
            `INSERT INTO students
                (
                    roll_no,
                    first_name,
                    last_name,
                    email,
                    phone,
                    course,
                    academic_year,
                    address
                )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                roll_number.trim(),
                firstName,
                lastName,
                email.trim(),
                phone.trim(),
                department.trim(),
                parsedYear,
                typeof address === 'string' && address.trim()
                    ? address.trim()
                    : null
            ]
        );

        const [rows] = await pool.query(
            studentSelect + ' WHERE id = ?',
            [result.insertId]
        );

        return res.status(201).json({
            message: 'Student created successfully',
            student: rows[0]
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'Roll number or email already exists'
            });
        }

        console.error('Error creating student:', err);

        return res.status(500).json({
            error: 'Failed to create student record'
        });
    }
});

// PUT /api/students/:id
// Only administrators may update student profiles.
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^\d+$/.test(String(id))) {
            return res.status(400).json({
                error: 'Invalid student ID'
            });
        }

        const [existingRows] = await pool.query(
            studentSelect + ' WHERE id = ?',
            [id]
        );

        if (!existingRows.length) {
            return res.status(404).json({
                error: 'Student not found'
            });
        }

        const old = existingRows[0];
        const body = req.body;

        const roll = body.roll_number ?? old.roll_number;
        const fullName = body.name ?? old.name;
        const email = body.email ?? old.email;
        const phone = body.phone ?? old.phone;
        const department = body.department ?? old.department;
        const year = body.year ?? old.year;
        const address = body.address ?? old.address;

        if (
            typeof roll !== 'string' ||
            !roll.trim() ||
            typeof fullName !== 'string' ||
            !fullName.trim() ||
            typeof email !== 'string' ||
            !email.trim() ||
            typeof department !== 'string' ||
            !department.trim()
        ) {
            return res.status(400).json({
                error: 'Roll number, name, email, and department are required'
            });
        }

        let parsedYear = null;

        if (year !== null && year !== undefined && String(year).trim() !== '') {
            parsedYear = Number(year);

            if (
                !Number.isInteger(parsedYear) ||
                parsedYear < 1 ||
                parsedYear > 10
            ) {
                return res.status(400).json({
                    error: 'Academic year must be a valid integer between 1 and 10'
                });
            }
        }

        const parts = fullName.trim().split(/\s+/);
        const firstName = parts.shift();
        const lastName = parts.join(' ');

        await pool.query(
            `UPDATE students
             SET
                roll_no = ?,
                first_name = ?,
                last_name = ?,
                email = ?,
                phone = ?,
                course = ?,
                academic_year = ?,
                address = ?,
                updated_at = NOW()
             WHERE id = ?`,
            [
                roll.trim(),
                firstName,
                lastName,
                email.trim(),
                phone || null,
                department.trim(),
                parsedYear,
                typeof address === 'string' && address.trim()
                    ? address.trim()
                    : null,
                id
            ]
        );

        const [updatedRows] = await pool.query(
            studentSelect + ' WHERE id = ?',
            [id]
        );

        return res.json({
            message: 'Student updated successfully',
            student: updatedRows[0]
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'Roll number or email already exists'
            });
        }

        console.error('Error updating student:', err);

        return res.status(500).json({
            error: 'Failed to update student record'
        });
    }
});

// DELETE /api/students/:id
// Only administrators may delete student profiles.
// Associated marks are deleted through the database foreign key.
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^\d+$/.test(String(id))) {
            return res.status(400).json({
                error: 'Invalid student ID'
            });
        }

        const [rows] = await pool.query(
            'SELECT id FROM students WHERE id = ?',
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({
                error: 'Student not found'
            });
        }

        await pool.query(
            'DELETE FROM students WHERE id = ?',
            [id]
        );

        return res.json({
            message: 'Student and associated marks deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting student:', err);

        return res.status(500).json({
            error: 'Failed to delete student record'
        });
    }
});

module.exports = router;

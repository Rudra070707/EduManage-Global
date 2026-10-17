
-- ============================================================================
-- EduManage - Sample Data
-- MySQL 8.4
-- For a fresh demo installation only
-- ============================================================================

USE student_management;

-- ============================================================================
-- 1. Default Administrator
-- Username: admin
-- Password: admin123
-- Change this password before any real deployment.
-- ============================================================================
INSERT IGNORE INTO users (id, username, password, role)
VALUES (
    1,
    'admin',
    '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkVnUMode5lGNUhGcZ1hYa7mAU0Yy',
    'admin'
);

-- ============================================================================
-- 2. Sample Students
-- ============================================================================
INSERT IGNORE INTO students (
    id, user_id, roll_no, first_name, last_name, email,
    phone, course, academic_year, semester, address
)
VALUES
(1, NULL, 'CS2024001', 'Aarav', 'Sharma',
 'aarav.sharma@example.com', '9876543210',
 'Computer Science', 3, 1, 'Mumbai, Maharashtra'),

(2, NULL, 'IT2024002', 'Diya', 'Patel',
 'diya.patel@example.com', '9876543211',
 'Information Technology', 3, 1, 'Pune, Maharashtra'),

(3, NULL, 'CS2024003', 'Rohan', 'Verma',
 'rohan.verma@example.com', '9876543212',
 'Computer Science', 2, 1, 'Bengaluru, Karnataka'),

(4, NULL, 'EC2024004', 'Ananya', 'Iyer',
 'ananya.iyer@example.com', '9876543213',
 'Electronics & Communication', 4, 1, 'Chennai, Tamil Nadu'),

(5, NULL, 'ME2024005', 'Vikram', 'Singh',
 'vikram.singh@example.com', '9876543214',
 'Mechanical Engineering', 1, 1, 'New Delhi, Delhi');

-- ============================================================================
-- 3. Sample Student Login Accounts
-- Password for each demo account: admin123
-- ============================================================================
INSERT IGNORE INTO users (id, username, password, role)
VALUES
(2, 'CS2024001',
 '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkVnUMode5lGNUhGcZ1hYa7mAU0Yy',
 'student'),

(3, 'IT2024002',
 '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkVnUMode5lGNUhGcZ1hYa7mAU0Yy',
 'student'),

(4, 'CS2024003',
 '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkVnUMode5lGNUhGcZ1hYa7mAU0Yy',
 'student'),

(5, 'EC2024004',
 '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkVnUMode5lGNUhGcZ1hYa7mAU0Yy',
 'student'),

(6, 'ME2024005',
 '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkVnUMode5lGNUhGcZ1hYa7mAU0Yy',
 'student');

-- Link demo accounts to their corresponding student records.
UPDATE students SET user_id = 2 WHERE id = 1 AND user_id IS NULL;
UPDATE students SET user_id = 3 WHERE id = 2 AND user_id IS NULL;
UPDATE students SET user_id = 4 WHERE id = 3 AND user_id IS NULL;
UPDATE students SET user_id = 5 WHERE id = 4 AND user_id IS NULL;
UPDATE students SET user_id = 6 WHERE id = 5 AND user_id IS NULL;

-- ============================================================================
-- 4. Sample Marks
-- MySQL calculates total and percentage automatically.
-- Semester is stored in students.semester.
-- ============================================================================
INSERT INTO marks (
    student_id, subject1, subject2, subject3, subject4, subject5, grade
)
SELECT sample.student_id,
       sample.subject1, sample.subject2, sample.subject3,
       sample.subject4, sample.subject5, sample.grade
FROM (
    SELECT 1 AS student_id, 85.00 AS subject1, 90.00 AS subject2,
           88.50 AS subject3, 92.00 AS subject4, 89.50 AS subject5,
           'A' AS grade
    UNION ALL
    SELECT 2, 75.00, 78.50, 82.00, 70.00, 74.50, 'B'
    UNION ALL
    SELECT 3, 92.00, 95.00, 94.50, 91.00, 96.50, 'A+'
    UNION ALL
    SELECT 4, 62.00, 65.50, 58.00, 60.50, 64.00, 'C'
    UNION ALL
    SELECT 5, 52.00, 55.00, 48.50, 58.00, 51.50, 'D'
) AS sample
WHERE NOT EXISTS (
    SELECT 1
    FROM marks existing
    WHERE existing.student_id = sample.student_id
);


-- ============================================================================
-- EduManage - Student Management System
-- MySQL 8.4 compatible
-- Matches the current Node.js / Express application schema
-- ============================================================================

CREATE DATABASE IF NOT EXISTS student_management
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE student_management;

-- ============================================================================
-- USERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'student') NOT NULL DEFAULT 'student',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY username (username)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- STUDENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS students (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT DEFAULT NULL,
    roll_no VARCHAR(20) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(15) DEFAULT NULL,
    course VARCHAR(100) DEFAULT NULL,
    academic_year TINYINT DEFAULT NULL,
    semester INT DEFAULT NULL,
    gender ENUM('Male', 'Female', 'Other') DEFAULT NULL,
    dob DATE DEFAULT NULL,
    address VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY roll_no (roll_no),
    UNIQUE KEY email (email),
    KEY fk_student_user (user_id),
    CONSTRAINT fk_student_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- MARKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS marks (
    id INT NOT NULL AUTO_INCREMENT,
    student_id INT NOT NULL,
    subject1 DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    subject2 DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    subject3 DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    subject4 DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    subject5 DECIMAL(5,2) NOT NULL DEFAULT 0.00,

    total DECIMAL(6,2)
        GENERATED ALWAYS AS (
            subject1 + subject2 + subject3 + subject4 + subject5
        ) STORED,

    percentage DECIMAL(5,2)
        GENERATED ALWAYS AS (
            (subject1 + subject2 + subject3 + subject4 + subject5) / 5
        ) STORED,

    grade VARCHAR(5) DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY fk_marks_student (student_id),
    CONSTRAINT fk_marks_student
        FOREIGN KEY (student_id)
        REFERENCES students (id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

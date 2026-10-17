📘 Student Management System — Setup & Architecture Guide
This guide explains the Student Management System college project, its Web Designing (WD) and Full Stack Java Programming (FSJP) components, their shared MySQL database, and how to configure and run the applications on Windows.
Project status: Academic/demo project. Review the security checklist before exposing it to the internet. Commands and examples below reflect the currently documented project layout; if a file differs in your checkout, follow the actual source file.

Table of Contents
1. Architecture
2. Prerequisites
3. Database setup
4. Web application setup
5. Java application setup
6. Authentication overview
7. Frontend/backend request flow
8. JDBC architecture
9. Troubleshooting
10. Pre-viva checklist
1. High-Level Architecture
The project contains two applications intended to connect to the same MySQL database.
Browser
  | HTTP / fetch
  v
Node.js + Express web server
  | mysql2
  v
MySQL: student_management
  ^
  | JDBC / MySQL Connector-J
Java console application
Main components
- WD web application: HTML, CSS, vanilla JavaScript, Node.js, Express and mysql2.
- FSJP console application: Java 21, JDBC, MySQL Connector/J and DAO classes.
- Database: MySQL schema student_management, with users, students and marks tables.
Both applications can share data when they connect to the same database and operate on the same records. Always back up the database before schema changes or test-data operations.
Database calculations and relationships
- marks.total is generated from the five subject scores.
- marks.percentage is generated as the average of the five subject scores.
- marks.grade is a writable column in the current schema; MySQL does not generate it.
- students.user_id references users.id and is set to NULL if the linked user is deleted.
- marks.student_id references students.id; deleting a student cascades to their marks.
- The current marks table does not contain a semester column or a unique student/semester constraint. Semester is stored in students.semester.
2. Prerequisites
Verify tools in PowerShell:
Node.js and npm
node --version
npm.cmd --version
Java 21
java -version
javac -version
MySQL
If mysql is not on PATH, use its full path. For example, this installation has used:
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" --version
Check MySQL services:
Get-Service -Name "*mysql*"
The Java module also needs a MySQL Connector/J JAR. Use the JAR version and path actually present in fsjp/lib/.
3. Database Initialization
Database scripts are in database/:
- schema.sql creates the database and tables.
- sample-data.sql contains demonstration accounts and records for a demo setup.
Important safety warning
A database backup exists in the project folder. Keep it safe, and never publish it because it can contain personal records and password hashes. Do not run sample data against the working database without reviewing fixed IDs, existing usernames, and existing records. INSERT IGNORE does not make fixed-ID seed data universally safe.
Create or inspect the schema
Open MySQL Command Line Client or MySQL Workbench. Example:
SOURCE C:/path/to/Student-Management-System/database/schema.sql;
Replace the path with the actual location on your computer. Do not run schema changes on a populated database until you have reviewed their effect and made a backup.
Verify current tables and columns
USE student_management;
SHOW TABLES;
DESCRIBE users;
DESCRIBE students;
DESCRIBE marks;
Expected important columns in the current schema:
- users: id, username, password, role, created_at
- students: id, user_id, roll_no, first_name, last_name, email, phone, course, academic_year, semester, gender, dob, address, created_at, updated_at
- marks: id, student_id, subject1, subject2, subject3, subject4, subject5, generated total, generated percentage, writable grade, created_at, updated_at
Example read-only verification queries:
SELECT id, username, role FROM users;
SELECT id, user_id, roll_no, first_name, last_name, email FROM students;
SELECT id, student_id, subject1, subject2, subject3, subject4, subject5,
       total, percentage, grade
FROM marks;
Use the actual schema as the source of truth if any local database differs.
4. Web Designing Module (WD)
The web application is inside wd/. The current entry point is backend/server.js, and the frontend assets are served from public/.
Start the application
In PowerShell:
cd "$HOME\OneDrive\Desktop\Student-Management-System\wd"
npm.cmd install
npm.cmd run dev
The package.json scripts currently define:
- npm.cmd start — runs node backend/server.js
- npm.cmd run dev — runs node --watch backend/server.js
Open:
http://localhost:3000
Environment configuration
Configure the .env file expected by the backend. Use .env.example if present and keep .env private. The following names are examples; confirm them against backend/config and the server configuration:
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=student_management
PORT=3000
SESSION_SECRET=replace_with_a_long_random_secret
Do not paste database passwords or session secrets into chat, screenshots, public repositories or documentation. Do not use a production MySQL root account for the application.
Login
Use only accounts that exist in your local database. Demo credentials documented by the seed script are not proof that those accounts exist in the current database. For student login, verify the relationship between users.id and students.user_id.
5. Full Stack Java Programming Module (FSJP)
The Java console app uses JDBC. Review fsjp/README.md, fsjp/db.properties.example, and the actual files in fsjp/src/ for the current commands and configuration names.
Typical setup:
1. Ensure MySQL is running and the student_management database exists.
2. Copy db.properties.example to db.properties if needed.
3. Set the local database URL, username and password in db.properties.
4. Ensure the Connector/J JAR is in the configured lib/ directory.
5. Compile and run using the project's Java instructions.
Typical Windows JDBC URL:
db.url=jdbc:mysql://localhost:3306/student_management
db.user=your_database_user
db.password=your_database_password
Use the exact property names required by DatabaseConnection.java. Keep db.properties private and out of version control.
6. Authentication Overview
The web application uses session-based authentication and bcrypt password verification.
A typical login flow is:
1. The browser submits credentials to POST /api/auth/login.
2. The server retrieves the account by username.
3. The server verifies the submitted password against the stored bcrypt hash.
4. On success, the server establishes a session.
5. Subsequent API requests include the session cookie.
6. Authentication and role middleware decide whether the request is allowed.
Important implementation details must be confirmed in the current code. In particular, do not assume that the default in-memory session store, cookie configuration, CSRF protection, registration flow or all API routes are production-safe without auditing them.
Students should only be able to access their own linked academic records. Administrative routes must enforce administrator authorization on the server, not merely hide controls in the browser.
7. Frontend-to-Backend Communication
The frontend uses the browser fetch API to send requests to the Express routes. For example, a student form may send a JSON payload to POST /api/students, and the backend validates it before running a parameterized SQL query.
The current database columns differ from older examples. The backend maps frontend fields to the actual database schema, including:
- Frontend roll number → students.roll_no
- Frontend full name → students.first_name and students.last_name
- Frontend department/course → students.course
- Frontend year → students.academic_year
Do not use old SQL examples containing roll_number, name, department, year, or users.student_id against the current schema.
8. Java JDBC Architecture
The Java application uses JDBC to communicate with MySQL through Connector/J. The DAO pattern keeps database operations separate from the menu/interface logic.
Common JDBC practices include:
- Using PreparedStatement for values supplied by users.
- Using try-with-resources to close JDBC connections, statements and result sets.
- Keeping database credentials in a local properties file rather than hard-coding them into Java source.
- Handling SQL exceptions without exposing credentials.
Check the Java source code to confirm which of these practices are implemented in each operation.
9. Troubleshooting
ECONNREFUSED 127.0.0.1:3306
MySQL may not be running or may be listening on another port.
Get-Service -Name "*mysql*"
Test-NetConnection -ComputerName localhost -Port 3306
Start the actual MySQL service name shown on your computer if it is stopped.
ER_ACCESS_DENIED_ERROR
Check the local .env or db.properties credentials. Test them privately with the MySQL client. Never share the password in a screenshot or chat.
EADDRINUSE on port 3000
Another process may be using the port:
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
Identify the owning process before stopping anything. Do not terminate an unknown process blindly.
ClassNotFoundException: com.mysql.cj.jdbc.Driver
Check that the Connector/J JAR exists in the expected fsjp/lib/ directory and that the Java classpath includes it.
Student login has no linked profile
Verify the student account link:
SELECT u.id, u.username, u.role, s.id AS student_id, s.roll_no
FROM users AS u
LEFT JOIN students AS s ON s.user_id = u.id;
Marks are missing
Verify the marks.student_id value refers to the correct students.id.
npm is blocked in PowerShell
Use npm.cmd rather than npm.
Sample-data script fails
Do not repeatedly run fixed-ID sample data against a populated database. Inspect conflicting IDs, usernames and foreign-key links first.
10. Pre-Viva Verification Checklist
- [ ] MySQL is running.
- [ ] student_management exists.
- [ ] users, students and marks match the documented schema.
- [ ] The WD application starts with npm.cmd run dev.
- [ ] The browser opens http://localhost:3000.
- [ ] Administrator login and role restrictions work.
- [ ] Student login opens only the linked student's records.
- [ ] Student profile and marks pages load.
- [ ] The Java application connects using JDBC.
- [ ] A test record created in one application is visible in the other when both use the same database and supported operation.
- [ ] A recent database backup is available.
- [ ] No secrets or real database credentials are committed to the repository.
For oral examination preparation, consult docs/viva-questions.md.
🎓 Student Management System
A college project combining Web Designing (WD) and Full Stack Java Programming (FSJP). The web application and Java console application are designed to use a shared MySQL 8.4 database.
Project status: Academic/demo project. It is not yet production-ready. Review the security checklist before deploying it publicly.

Project Overview
WD — Web Application
- HTML, CSS and vanilla JavaScript frontend
- Node.js and Express backend
- MySQL access through mysql2
- Login sessions for administrator and student roles
- Student records, profile views, marks and dashboard summaries
FSJP — Java Console Application
- Java 21
- JDBC and MySQL Connector/J
- DAO-based separation of database access
- Menu-driven student and marks workflows
Both applications are intended to use the student_management database. Changes made by one application may be visible in the other when they operate on the same database records.
Main Features
Web Application
- Administrator and student login
- Role-based access to student records
- Student profile and directory views
- Create, view, update and delete student records (administrator permissions apply)
- Marks entry and marks viewing
- Dashboard statistics
- Responsive HTML/CSS interface
Java Console Application
- Menu-driven interface
- Student record operations
- Marks management
- JDBC database connectivity
The exact features available depend on the current source code and database configuration.
Technology Stack
Area	Technology
Frontend	HTML5, CSS3, vanilla JavaScript
Web server	Node.js, Express.js
Web database driver	mysql2
Authentication	bcrypt, express-session
Database	MySQL Server 8.4
Java runtime	JDK 21
Java database access	JDBC, MySQL Connector/J


Requirements
- Node.js and npm
- MySQL Server 8.4
- JDK 21
- MySQL Connector/J JAR for the Java application
- PowerShell or Command Prompt on Windows
Database Setup
Back up any existing database before making schema changes. The sample-data script is intended for a demo setup and should not be run blindly against an existing working database.
1. Start MySQL Server.
2. Open MySQL Command Line Client or MySQL Workbench.
3. Run database/schema.sql to create the database and tables.
Example from the MySQL client (change the path to your actual project location):
SOURCE C:/path/to/Student-Management-System/database/schema.sql;
To load demonstration data, only use database/sample-data.sql in a fresh/demo database after checking that its fixed IDs and usernames will not conflict with existing records:
SOURCE C:/path/to/Student-Management-System/database/sample-data.sql;
Verify the tables:
USE student_management;
SHOW TABLES;
DESCRIBE users;
DESCRIBE students;
DESCRIBE marks;
Current database structure
- users: id, username, password, role, created_at
- students: id, user_id, roll_no, first_name, last_name, email, phone, course, academic_year, semester, gender, dob, address, timestamps
- marks: id, student_id, subject1 through subject5, generated total and percentage, writable grade, timestamps
students.user_id links a student login to a student record. marks.student_id links marks to a student. The current marks table does not contain a semester column; the student's semester is stored in students.semester.
Run the Web Application (WD)
1. Open PowerShell and navigate to the web project directory. In this project, backend files are under wd/backend and frontend files are under wd/public:
cd "C:\path\to\Student-Management-System\wd"
2. Install dependencies if needed:
npm.cmd install
3. Configure the environment variables in the .env file used by the backend. Use .env.example as a template if present. Set the correct MySQL host, port, database name, username, password, application port and a strong session secret. Do not commit .env or share its contents.
Typical settings have this shape; use the variable names expected by your actual backend configuration:
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=student_management
PORT=3000
SESSION_SECRET=replace_with_a_long_random_secret
4. Start the development server:
npm.cmd run dev
5. Open http://localhost:3000 in your browser. If the project uses a different script, check the scripts section of wd/package.json.
Run the Java Application (FSJP)
The Java application uses JDBC configuration. Check fsjp/README.md and fsjp/db.properties.example for the exact classpath, configuration keys and run commands in the current project.
1. Ensure MySQL is running and the student_management schema exists.
2. Copy the example properties file to db.properties if required.
3. Enter your own database username and password in the local properties file.
4. Ensure the MySQL Connector/J JAR is available in the configured lib directory.
5. Compile and run using the commands documented in fsjp/README.md.
Do not commit a properties file containing a real password.
Login Accounts
Use only accounts that actually exist in your local database. The current database may differ from the demo data, so do not assume the sample usernames are present.
For a fresh demo setup, the sample script documents admin / admin123 and sample student accounts. These are demonstration credentials only. Change them before any public deployment. If login fails, check the account in users, confirm its password hash, and for student logins confirm the matching students.user_id relationship.
Database Relationships and Calculated Fields
- students.user_id references users.id; deleting a user sets the student link to NULL.
- marks.student_id references students.id; deleting a student cascades to related marks.
- marks.total is generated from the five subject scores.
- marks.percentage is generated as the average of the five subject scores.
- marks.grade is a normal writable column in the current schema; it is not generated by MySQL.
- The current schema does not enforce one marks record per student per semester because the marks table has no semester field or student/semester unique key.
Security Checklist Before Public Deployment
This is an educational project and needs additional hardening before it is exposed to the internet:
- Replace all demo passwords and use strong, unique credentials.
- Use a dedicated MySQL application user with only the required permissions; avoid using root.
- Set a long, random SESSION_SECRET and fail startup if it is missing.
- Configure secure cookies and HTTPS correctly for production.
- Replace the default in-memory Express session store with a persistent production session store.
- Add login rate limiting and CSRF protections where appropriate.
- Validate authorization for every API route and ensure students can only access their own records.
- Review registration, password-reset and account-linking flows before enabling public sign-up.
- Keep .env, db.properties, backups and database credentials out of public repositories.
- Test database restore and application recovery from backups.
Troubleshooting
- Database connection fails: confirm MySQL is running, port 3306 is listening, and the credentials and database name are correct.
- npm is blocked in PowerShell: use npm.cmd instead of npm.
- Student login succeeds but profile is missing: verify the student's users.id is linked from students.user_id.
- Marks are missing: verify the marks.student_id references the correct students.id.
- Sample data fails: do not repeatedly run fixed-ID seed data against a populated database; inspect conflicts first.
- Java cannot find the JDBC driver: verify the Connector/J JAR path and classpath in the Java setup instructions.
Project Documentation
Check these files if present in the repository:
- database/schema.sql — database schema
- database/sample-data.sql — demonstration records
- wd/package.json — web scripts and dependencies
- fsjp/README.md — Java application instructions
Academic Note
This project was developed for academic learning and demonstration across Web Designing (WD) and Full Stack Java Programming (FSJP). Verify all features and security controls against the current source code before presenting the application as production-ready.
package com.studentmgmt;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Scanner;

/**
 * App - Main Console Application for Student Management System
 *
 * Demonstrates:
 * 1. JDBC connection lifecycle and configuration management.
 * 2. Clean separation of concerns using Data Access Objects (DAO).
 * 3. Formatted tabular CLI outputs for college presentation/viva.
 * 4. Safe user input parsing and exception handling.
 */
public class App {

    private static final StudentDAO studentDAO = new StudentDAO();
    private static final MarksDAO marksDAO = new MarksDAO();

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        printWelcomeBanner();

        // Step 1: Test database connectivity
        testDatabaseConnection();

        // Step 2: Main application menu loop
        boolean running = true;
        while (running) {
            printMainMenu();
            int choice = readInt(scanner, "Enter your choice (0-3): ");

            switch (choice) {
                case 1:
                    handleStudentMenu(scanner);
                    break;
                case 2:
                    handleMarksMenu(scanner);
                    break;
                case 3:
                    handleSearchStudents(scanner);
                    break;
                case 0:
                    running = false;
                    System.out.println("\nExiting Student Management System. Goodbye!");
                    break;
                default:
                    System.out.println("Invalid option. Please select a valid menu choice (0-3).");
            }
        }

        scanner.close();
    }

    // =========================================================================
    // MENU RENDERING
    // =========================================================================

    private static void printWelcomeBanner() {
        System.out.println("===============================================================");
        System.out.println("          STUDENT MANAGEMENT SYSTEM (Java / JDBC)");
        System.out.println("===============================================================");
        System.out.println("  A Full-Stack Java Project demonstrating MySQL JDBC operations");
        System.out.println("  Features: Model-DAO architecture, Generated Columns, Safe SQL");
        System.out.println("===============================================================\n");
    }

    private static void testDatabaseConnection() {
        System.out.print("[System] Connecting to MySQL database... ");
        try (Connection conn = DBConnection.getConnection()) {
            if (conn != null && !conn.isClosed()) {
                System.out.println("SUCCESS!");
                System.out.println("[System] Connected to: " + conn.getMetaData().getURL());
                System.out.println("[System] Database Version: " + conn.getMetaData().getDatabaseProductVersion() + "\n");
            }
        } catch (SQLException e) {
            System.out.println("FAILED!");
            System.err.println("\n[!] Connection Error: " + e.getMessage());
            System.err.println("Please check:");
            System.err.println(" 1. MySQL service is running on localhost:3306");
            System.err.println(" 2. 'student_management' database has been created and schema imported");
            System.err.println(" 3. 'db.properties' exists in the project root with the correct password");
            System.err.println(" 4. 'lib/mysql-connector-j-*.jar' is in the classpath\n");
        }
    }

    private static void printMainMenu() {
        System.out.println("\n========================================");
        System.out.println("               MAIN MENU                ");
        System.out.println("========================================");
        System.out.println("  1. Student Management");
        System.out.println("  2. Marks Management");
        System.out.println("  3. Search Students");
        System.out.println("  0. Exit");
        System.out.println("========================================");
    }

    private static void printStudentMenu() {
        System.out.println("\n----------------------------------------");
        System.out.println("        STUDENT MANAGEMENT MENU         ");
        System.out.println("----------------------------------------");
        System.out.println("  1. Add Student");
        System.out.println("  2. View All Students");
        System.out.println("  3. View Student by ID");
        System.out.println("  4. Update Student");
        System.out.println("  5. Delete Student");
        System.out.println("  0. Back to Main Menu");
        System.out.println("----------------------------------------");
    }

    private static void printMarksMenu() {
        System.out.println("\n----------------------------------------");
        System.out.println("         MARKS MANAGEMENT MENU          ");
        System.out.println("----------------------------------------");
        System.out.println("  1. Add Marks");
        System.out.println("  2. View Marks by Student");
        System.out.println("  3. View All Marks");
        System.out.println("  4. Update Marks");
        System.out.println("  5. Delete Marks");
        System.out.println("  0. Back to Main Menu");
        System.out.println("----------------------------------------");
    }

    // =========================================================================
    // STUDENT MANAGEMENT HANDLERS
    // =========================================================================

    private static void handleStudentMenu(Scanner scanner) {
        boolean inMenu = true;
        while (inMenu) {
            printStudentMenu();
            int choice = readInt(scanner, "Enter your choice (0-5): ");

            switch (choice) {
                case 1:
                    addStudent(scanner);
                    break;
                case 2:
                    viewAllStudents();
                    break;
                case 3:
                    viewStudentById(scanner);
                    break;
                case 4:
                    updateStudent(scanner);
                    break;
                case 5:
                    deleteStudent(scanner);
                    break;
                case 0:
                    inMenu = false;
                    break;
                default:
                    System.out.println("Invalid option. Please enter 0-5.");
            }
        }
    }

    private static void addStudent(Scanner scanner) {
        System.out.println("\n--- Add New Student ---");

        String rollNumber;
        while (true) {
            rollNumber = readString(scanner, "Enter Roll Number (e.g. CS2024001): ");
            if (studentDAO.getStudentByRollNumber(rollNumber) != null) {
                System.out.println("Warning: A student with Roll Number '" + rollNumber + "' already exists! Try another.");
            } else {
                break;
            }
        }

        String name = readString(scanner, "Enter Full Name: ");
        String email = readString(scanner, "Enter Email: ");
        String phone = readString(scanner, "Enter Phone (10 digits): ");
        String dept = readString(scanner, "Enter Department (e.g. Computer Science, IT, Mechanical): ");
        int year = readIntInRange(scanner, "Enter Year of Study (1-4): ", 1, 4);
        String address = readString(scanner, "Enter Address / City: ");

        Student s = new Student(rollNumber, name, email, phone, dept, year, address);
        boolean success = studentDAO.addStudent(s);

        if (success) {
            System.out.println("\n>>> SUCCESS: Student added successfully with ID: " + s.getId() + " <<<");
        } else {
            System.out.println("\n>>> ERROR: Could not add student. Check database logs. <<<");
        }
    }

    private static void viewAllStudents() {
        System.out.println("\n--- All Enrolled Students ---");
        List<Student> students = studentDAO.getAllStudents();
        displayStudentsTable(students);
    }

    private static void viewStudentById(Scanner scanner) {
        System.out.println("\n--- View Student by ID ---");
        int id = readInt(scanner, "Enter Student ID: ");
        Student s = studentDAO.getStudentById(id);

        if (s == null) {
            System.out.println("Student with ID " + id + " not found.");
            return;
        }

        System.out.println("\n========================================");
        System.out.println("           STUDENT DETAILS              ");
        System.out.println("========================================");
        System.out.println(" ID          : " + s.getId());
        System.out.println(" Roll Number : " + s.getRollNumber());
        System.out.println(" Name        : " + s.getName());
        System.out.println(" Email       : " + s.getEmail());
        System.out.println(" Phone       : " + s.getPhone());
        System.out.println(" Department  : " + s.getDepartment());
        System.out.println(" Year        : " + s.getYear());
        System.out.println(" Address     : " + s.getAddress());
        System.out.println(" Created At  : " + s.getCreatedAt());
        System.out.println(" Updated At  : " + s.getUpdatedAt());
        System.out.println("========================================");

        // Also fetch and display marks for this student
        List<Marks> marksList = marksDAO.getMarksByStudentId(id);
        if (!marksList.isEmpty()) {
            System.out.println("\nAcademic Records for " + s.getName() + ":");
            displayMarksTable(marksList, false);
        } else {
            System.out.println("\nNo marks recorded yet for this student.");
        }
    }

    private static void updateStudent(Scanner scanner) {
        System.out.println("\n--- Update Student ---");
        int id = readInt(scanner, "Enter Student ID to update: ");
        Student existing = studentDAO.getStudentById(id);

        if (existing == null) {
            System.out.println("Student with ID " + id + " not found.");
            return;
        }

        System.out.println("Updating record for: " + existing.getName() + " (" + existing.getRollNumber() + ")");
        System.out.println("(Press [ENTER] without typing anything to keep existing value)");

        String roll = readOptionalString(scanner, "Roll Number [" + existing.getRollNumber() + "]: ", existing.getRollNumber());
        String name = readOptionalString(scanner, "Name [" + existing.getName() + "]: ", existing.getName());
        String email = readOptionalString(scanner, "Email [" + existing.getEmail() + "]: ", existing.getEmail());
        String phone = readOptionalString(scanner, "Phone [" + existing.getPhone() + "]: ", existing.getPhone());
        String dept = readOptionalString(scanner, "Department [" + existing.getDepartment() + "]: ", existing.getDepartment());
        int year = readOptionalIntInRange(scanner, "Year (1-4) [" + existing.getYear() + "]: ", existing.getYear(), 1, 4);
        String address = readOptionalString(scanner, "Address [" + existing.getAddress() + "]: ", existing.getAddress());

        existing.setRollNumber(roll);
        existing.setName(name);
        existing.setEmail(email);
        existing.setPhone(phone);
        existing.setDepartment(dept);
        existing.setYear(year);
        existing.setAddress(address);

        boolean ok = studentDAO.updateStudent(existing);
        if (ok) {
            System.out.println("\n>>> SUCCESS: Student ID " + id + " updated successfully. <<<");
        } else {
            System.out.println("\n>>> ERROR: Failed to update student. <<<");
        }
    }

    private static void deleteStudent(Scanner scanner) {
        System.out.println("\n--- Delete Student ---");
        int id = readInt(scanner, "Enter Student ID to delete: ");
        Student s = studentDAO.getStudentById(id);

        if (s == null) {
            System.out.println("Student with ID " + id + " not found.");
            return;
        }

        System.out.println("WARNING: Deleting student '" + s.getName() + "' (Roll: " + s.getRollNumber() +
                           ") will ALSO delete all associated marks due to CASCADE constraint.");
        String confirm = readString(scanner, "Are you sure you want to permanently delete this student? (y/N): ");

        if (confirm.equalsIgnoreCase("y") || confirm.equalsIgnoreCase("yes")) {
            boolean ok = studentDAO.deleteStudent(id);
            if (ok) {
                System.out.println("\n>>> SUCCESS: Student and associated marks deleted successfully. <<<");
            } else {
                System.out.println("\n>>> ERROR: Could not delete student. <<<");
            }
        } else {
            System.out.println("Deletion cancelled by user.");
        }
    }

    private static void handleSearchStudents(Scanner scanner) {
        System.out.println("\n--- Search Students ---");
        String keyword = readString(scanner, "Enter keyword (name, roll number, or department): ");
        List<Student> results = studentDAO.searchStudents(keyword);

        System.out.println("\nSearch results for: '" + keyword + "'");
        displayStudentsTable(results);
    }

    // =========================================================================
    // MARKS MANAGEMENT HANDLERS
    // =========================================================================

    private static void handleMarksMenu(Scanner scanner) {
        boolean inMenu = true;
        while (inMenu) {
            printMarksMenu();
            int choice = readInt(scanner, "Enter your choice (0-5): ");

            switch (choice) {
                case 1:
                    addMarks(scanner);
                    break;
                case 2:
                    viewMarksByStudent(scanner);
                    break;
                case 3:
                    viewAllMarks();
                    break;
                case 4:
                    updateMarks(scanner);
                    break;
                case 5:
                    deleteMarks(scanner);
                    break;
                case 0:
                    inMenu = false;
                    break;
                default:
                    System.out.println("Invalid option. Please enter 0-5.");
            }
        }
    }

    private static void addMarks(Scanner scanner) {
        System.out.println("\n--- Add Semester Marks ---");
        int studentId = readInt(scanner, "Enter Student ID: ");
        Student s = studentDAO.getStudentById(studentId);

        if (s == null) {
            System.out.println("ERROR: Student with ID " + studentId + " does not exist!");
            System.out.println("Please add the student first or check the ID.");
            return;
        }

        System.out.println("Adding marks for: " + s.getName() + " (Roll: " + s.getRollNumber() + ")");
        int sem = readIntInRange(scanner, "Enter Semester (1-8): ", 1, 8);

        System.out.println("\nEnter marks between 0.0 and 100.0 for 5 subjects:");
        double s1 = readDoubleInRange(scanner, "Subject 1: ", 0.0, 100.0);
        double s2 = readDoubleInRange(scanner, "Subject 2: ", 0.0, 100.0);
        double s3 = readDoubleInRange(scanner, "Subject 3: ", 0.0, 100.0);
        double s4 = readDoubleInRange(scanner, "Subject 4: ", 0.0, 100.0);
        double s5 = readDoubleInRange(scanner, "Subject 5: ", 0.0, 100.0);

        // Note: total, percentage, grade are NOT sent. MySQL generates them automatically!
        boolean ok = marksDAO.addMarks(studentId, sem, s1, s2, s3, s4, s5);
        if (ok) {
            System.out.println("\n>>> SUCCESS: Marks added successfully! <<<");
            System.out.println("[Note] Total, Percentage, and Grade were computed automatically by MySQL Generated Columns.");

            // Display the newly computed marks row
            List<Marks> list = marksDAO.getMarksByStudentId(studentId);
            if (!list.isEmpty()) {
                Marks latest = list.get(list.size() - 1);
                System.out.printf("Summary -> Total: %.1f | Percentage: %.2f%% | Grade: %s\n",
                                  latest.getTotal(), latest.getPercentage(), latest.getGrade());
            }
        } else {
            System.out.println("\n>>> ERROR: Could not add marks. Check if semester marks already exist for this student. <<<");
        }
    }

    private static void viewMarksByStudent(Scanner scanner) {
        System.out.println("\n--- View Marks by Student ---");
        int studentId = readInt(scanner, "Enter Student ID: ");
        Student s = studentDAO.getStudentById(studentId);

        if (s == null) {
            System.out.println("Student with ID " + studentId + " not found.");
            return;
        }

        System.out.println("Marks report for: " + s.getName() + " (" + s.getRollNumber() + ")");
        List<Marks> marksList = marksDAO.getMarksByStudentId(studentId);
        displayMarksTable(marksList, false);
    }

    private static void viewAllMarks() {
        System.out.println("\n--- All Marks Records ---");
        List<Marks> marksList = marksDAO.getAllMarks();
        displayMarksTable(marksList, true);
    }

    private static void updateMarks(Scanner scanner) {
        System.out.println("\n--- Update Subject Marks ---");
        int markId = readInt(scanner, "Enter Marks Record ID to update: ");
        Marks existing = marksDAO.getMarksById(markId);

        if (existing == null) {
            System.out.println("Marks record with ID " + markId + " not found.");
            return;
        }

        System.out.printf("Existing Scores for %s (Sem %d): S1=%.1f, S2=%.1f, S3=%.1f, S4=%.1f, S5=%.1f\n",
                existing.getStudentName() != null ? existing.getStudentName() : "Student #" + existing.getStudentId(),
                existing.getSemester(),
                existing.getSubject1(), existing.getSubject2(), existing.getSubject3(),
                existing.getSubject4(), existing.getSubject5());
        System.out.println("(Press [ENTER] without typing anything to keep existing mark)");

        double s1 = readOptionalDoubleInRange(scanner, "Subject 1 [" + existing.getSubject1() + "]: ", existing.getSubject1(), 0.0, 100.0);
        double s2 = readOptionalDoubleInRange(scanner, "Subject 2 [" + existing.getSubject2() + "]: ", existing.getSubject2(), 0.0, 100.0);
        double s3 = readOptionalDoubleInRange(scanner, "Subject 3 [" + existing.getSubject3() + "]: ", existing.getSubject3(), 0.0, 100.0);
        double s4 = readOptionalDoubleInRange(scanner, "Subject 4 [" + existing.getSubject4() + "]: ", existing.getSubject4(), 0.0, 100.0);
        double s5 = readOptionalDoubleInRange(scanner, "Subject 5 [" + existing.getSubject5() + "]: ", existing.getSubject5(), 0.0, 100.0);

        boolean ok = marksDAO.updateMarks(markId, s1, s2, s3, s4, s5);
        if (ok) {
            System.out.println("\n>>> SUCCESS: Marks updated successfully! <<<");
            Marks updated = marksDAO.getMarksById(markId);
            if (updated != null) {
                System.out.printf("Recalculated by MySQL -> Total: %.1f | Percentage: %.2f%% | Grade: %s\n",
                        updated.getTotal(), updated.getPercentage(), updated.getGrade());
            }
        } else {
            System.out.println("\n>>> ERROR: Could not update marks. <<<");
        }
    }

    private static void deleteMarks(Scanner scanner) {
        System.out.println("\n--- Delete Marks Record ---");
        int markId = readInt(scanner, "Enter Marks Record ID to delete: ");
        Marks m = marksDAO.getMarksById(markId);

        if (m == null) {
            System.out.println("Marks record with ID " + markId + " not found.");
            return;
        }

        String confirm = readString(scanner, "Are you sure you want to delete Marks record ID " + markId + "? (y/N): ");
        if (confirm.equalsIgnoreCase("y") || confirm.equalsIgnoreCase("yes")) {
            boolean ok = marksDAO.deleteMarks(markId);
            if (ok) {
                System.out.println("\n>>> SUCCESS: Marks record deleted. <<<");
            } else {
                System.out.println("\n>>> ERROR: Could not delete marks record. <<<");
            }
        } else {
            System.out.println("Deletion cancelled.");
        }
    }

    // =========================================================================
    // TABLE FORMATTERS (PRINTF)
    // =========================================================================

    private static void displayStudentsTable(List<Student> students) {
        if (students == null || students.isEmpty()) {
            System.out.println("No student records found.");
            return;
        }

        String line = "+-----+------------+----------------------+--------------------------+--------------+------------------+------+----------------------+";
        System.out.println(line);
        System.out.printf("| %-3s | %-10s | %-20s | %-24s | %-12s | %-16s | %-4s | %-20s |\n",
                "ID", "Roll No", "Name", "Email", "Phone", "Department", "Year", "Address");
        System.out.println(line);

        for (Student s : students) {
            System.out.printf("| %-3d | %-10s | %-20s | %-24s | %-12s | %-16s | %-4d | %-20s |\n",
                    s.getId(),
                    truncate(s.getRollNumber(), 10),
                    truncate(s.getName(), 20),
                    truncate(s.getEmail(), 24),
                    truncate(s.getPhone(), 12),
                    truncate(s.getDepartment(), 16),
                    s.getYear(),
                    truncate(s.getAddress(), 20)
            );
        }
        System.out.println(line);
        System.out.println("Total: " + students.size() + " student(s)\n");
    }

    private static void displayMarksTable(List<Marks> marks, boolean includeStudentCol) {
        if (marks == null || marks.isEmpty()) {
            System.out.println("No marks records found.");
            return;
        }

        if (includeStudentCol) {
            String line = "+-----+------------+----------------------+-----+-------+-------+-------+-------+-------+--------+--------+-------+";
            System.out.println(line);
            System.out.printf("| %-3s | %-10s | %-20s | %-3s | %-5s | %-5s | %-5s | %-5s | %-5s | %-6s | %-6s | %-5s |\n",
                    "ID", "Roll No", "Student Name", "Sem", "Sub1", "Sub2", "Sub3", "Sub4", "Sub5", "Total", "%", "Grade");
            System.out.println(line);

            for (Marks m : marks) {
                System.out.printf("| %-3d | %-10s | %-20s | %-3d | %-5.1f | %-5.1f | %-5.1f | %-5.1f | %-5.1f | %-6.1f | %-5.1f%% | %-5s |\n",
                        m.getId(),
                        truncate(m.getStudentRollNumber() != null ? m.getStudentRollNumber() : "-", 10),
                        truncate(m.getStudentName() != null ? m.getStudentName() : "-", 20),
                        m.getSemester(),
                        m.getSubject1(), m.getSubject2(), m.getSubject3(), m.getSubject4(), m.getSubject5(),
                        m.getTotal(), m.getPercentage(), m.getGrade()
                );
            }
            System.out.println(line);
        } else {
            String line = "+-----+-----+-------+-------+-------+-------+-------+--------+--------+-------+";
            System.out.println(line);
            System.out.printf("| %-3s | %-3s | %-5s | %-5s | %-5s | %-5s | %-5s | %-6s | %-6s | %-5s |\n",
                    "ID", "Sem", "Sub1", "Sub2", "Sub3", "Sub4", "Sub5", "Total", "%", "Grade");
            System.out.println(line);

            for (Marks m : marks) {
                System.out.printf("| %-3d | %-3d | %-5.1f | %-5.1f | %-5.1f | %-5.1f | %-5.1f | %-6.1f | %-5.1f%% | %-5s |\n",
                        m.getId(),
                        m.getSemester(),
                        m.getSubject1(), m.getSubject2(), m.getSubject3(), m.getSubject4(), m.getSubject5(),
                        m.getTotal(), m.getPercentage(), m.getGrade()
                );
            }
            System.out.println(line);
        }
        System.out.println("Total: " + marks.size() + " marks entry/entries\n");
    }

    private static String truncate(String val, int maxLen) {
        if (val == null) return "-";
        if (val.length() <= maxLen) return val;
        return val.substring(0, maxLen - 2) + "..";
    }

    // =========================================================================
    // SAFE CONSOLE INPUT HELPERS
    // =========================================================================

    private static int readInt(Scanner scanner, String prompt) {
        while (true) {
            System.out.print(prompt);
            String input = scanner.nextLine().trim();
            try {
                return Integer.parseInt(input);
            } catch (NumberFormatException e) {
                System.out.println("Invalid number format. Please enter an integer.");
            }
        }
    }

    private static int readIntInRange(Scanner scanner, String prompt, int min, int max) {
        while (true) {
            int val = readInt(scanner, prompt);
            if (val >= min && val <= max) {
                return val;
            }
            System.out.println("Please enter a number between " + min + " and " + max + ".");
        }
    }

    private static double readDoubleInRange(Scanner scanner, String prompt, double min, double max) {
        while (true) {
            System.out.print(prompt);
            String input = scanner.nextLine().trim();
            try {
                double val = Double.parseDouble(input);
                if (val >= min && val <= max) {
                    return val;
                }
                System.out.printf("Please enter a value between %.1f and %.1f.\n", min, max);
            } catch (NumberFormatException e) {
                System.out.println("Invalid numeric format. Please enter a valid decimal number.");
            }
        }
    }

    private static String readString(Scanner scanner, String prompt) {
        while (true) {
            System.out.print(prompt);
            String line = scanner.nextLine().trim();
            if (!line.isEmpty()) {
                return line;
            }
            System.out.println("Input cannot be empty. Please try again.");
        }
    }

    private static String readOptionalString(Scanner scanner, String prompt, String defaultVal) {
        System.out.print(prompt);
        String line = scanner.nextLine().trim();
        return line.isEmpty() ? defaultVal : line;
    }

    private static int readOptionalIntInRange(Scanner scanner, String prompt, int defaultVal, int min, int max) {
        while (true) {
            System.out.print(prompt);
            String line = scanner.nextLine().trim();
            if (line.isEmpty()) {
                return defaultVal;
            }
            try {
                int val = Integer.parseInt(line);
                if (val >= min && val <= max) {
                    return val;
                }
                System.out.println("Please enter an integer between " + min + " and " + max + ".");
            } catch (NumberFormatException e) {
                System.out.println("Invalid number format.");
            }
        }
    }

    private static double readOptionalDoubleInRange(Scanner scanner, String prompt, double defaultVal, double min, double max) {
        while (true) {
            System.out.print(prompt);
            String line = scanner.nextLine().trim();
            if (line.isEmpty()) {
                return defaultVal;
            }
            try {
                double val = Double.parseDouble(line);
                if (val >= min && val <= max) {
                    return val;
                }
                System.out.printf("Please enter a value between %.1f and %.1f.\n", min, max);
            } catch (NumberFormatException e) {
                System.out.println("Invalid decimal number format.");
            }
        }
    }
}

package com.studentmgmt;

import java.sql.Timestamp;

/**
 * Marks - Model / Entity Class (POJO)
 *
 * Maps directly to the 'marks' table in MySQL.
 *
 * IMPORTANT VIVA POINT:
 * In MySQL, `total`, `percentage`, and `grade` are GENERATED ALWAYS columns.
 * - They are computed automatically by MySQL on INSERT or UPDATE.
 * - They should NEVER be included in INSERT or UPDATE SQL statements!
 * - When performing a SELECT query, JDBC reads these generated values just like regular columns.
 */
public class Marks {
    private int id;
    private int studentId;
    private String studentName;       // Populated when joining with students table
    private String studentRollNumber; // Populated when joining with students table
    private int semester;
    private double subject1;
    private double subject2;
    private double subject3;
    private double subject4;
    private double subject5;

    // Generated columns (read-only from database)
    private double total;
    private double percentage;
    private String grade;
    private Timestamp createdAt;

    // Default constructor
    public Marks() {
    }

    // Constructor for inserting new marks (before DB computes total, percentage, grade)
    public Marks(int studentId, int semester, double subject1, double subject2,
                 double subject3, double subject4, double subject5) {
        this.studentId = studentId;
        this.semester = semester;
        this.subject1 = subject1;
        this.subject2 = subject2;
        this.subject3 = subject3;
        this.subject4 = subject4;
        this.subject5 = subject5;
    }

    // Full constructor when reading from database
    public Marks(int id, int studentId, int semester, double subject1, double subject2,
                 double subject3, double subject4, double subject5, double total,
                 double percentage, String grade, Timestamp createdAt) {
        this.id = id;
        this.studentId = studentId;
        this.semester = semester;
        this.subject1 = subject1;
        this.subject2 = subject2;
        this.subject3 = subject3;
        this.subject4 = subject4;
        this.subject5 = subject5;
        this.total = total;
        this.percentage = percentage;
        this.grade = grade;
        this.createdAt = createdAt;
    }

    // --- Getters and Setters ---

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public int getStudentId() {
        return studentId;
    }

    public void setStudentId(int studentId) {
        this.studentId = studentId;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public String getStudentRollNumber() {
        return studentRollNumber;
    }

    public void setStudentRollNumber(String studentRollNumber) {
        this.studentRollNumber = studentRollNumber;
    }

    public int getSemester() {
        return semester;
    }

    public void setSemester(int semester) {
        this.semester = semester;
    }

    public double getSubject1() {
        return subject1;
    }

    public void setSubject1(double subject1) {
        this.subject1 = subject1;
    }

    public double getSubject2() {
        return subject2;
    }

    public void setSubject2(double subject2) {
        this.subject2 = subject2;
    }

    public double getSubject3() {
        return subject3;
    }

    public void setSubject3(double subject3) {
        this.subject3 = subject3;
    }

    public double getSubject4() {
        return subject4;
    }

    public void setSubject4(double subject4) {
        this.subject4 = subject4;
    }

    public double getSubject5() {
        return subject5;
    }

    public void setSubject5(double subject5) {
        this.subject5 = subject5;
    }

    public double getTotal() {
        return total;
    }

    public void setTotal(double total) {
        this.total = total;
    }

    public double getPercentage() {
        return percentage;
    }

    public void setPercentage(double percentage) {
        this.percentage = percentage;
    }

    public String getGrade() {
        return grade;
    }

    public void setGrade(String grade) {
        this.grade = grade;
    }

    public Timestamp getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Timestamp createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public String toString() {
        return String.format(
            "Marks [ID=%d, StudentID=%d, Sem=%d, S1=%.1f, S2=%.1f, S3=%.1f, S4=%.1f, S5=%.1f | Total=%.1f, %% = %.2f%%, Grade=%s]",
            id, studentId, semester, subject1, subject2, subject3, subject4, subject5, total, percentage, grade
        );
    }
}

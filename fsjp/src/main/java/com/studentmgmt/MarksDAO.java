
package com.studentmgmt;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class MarksDAO {

    private static final String SELECT_COLUMNS =
        "SELECT m.id, m.student_id, " +
        "COALESCE(s.semester, 0) AS semester, " +
        "m.subject1, m.subject2, m.subject3, m.subject4, m.subject5, " +
        "m.total, m.percentage, m.grade, m.created_at, " +
        "CONCAT_WS(' ', s.first_name, s.last_name) AS student_name, " +
        "s.roll_no AS student_roll " +
        "FROM marks m JOIN students s ON m.student_id = s.id ";

    public boolean addMarks(int studentId, int semester,
                            double s1, double s2, double s3,
                            double s4, double s5) {

        String sql = "INSERT INTO marks " +
            "(student_id, subject1, subject2, subject3, subject4, subject5, grade) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?)";

        double percentage = (s1 + s2 + s3 + s4 + s5) / 5.0;

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            // Semester belongs to the students table in this schema.
            try (PreparedStatement check = conn.prepareStatement(
                    "SELECT semester FROM students WHERE id = ?")) {
                check.setInt(1, studentId);
                try (ResultSet rs = check.executeQuery()) {
                    if (!rs.next()) {
                        System.err.println("Student not found.");
                        return false;
                    }

                    int storedSemester = rs.getInt("semester");
                    if (rs.wasNull() || storedSemester != semester) {
                        System.err.println(
                            "Semester does not match the student's stored semester.");
                        return false;
                    }
                }
            }

            pstmt.setInt(1, studentId);
            pstmt.setDouble(2, s1);
            pstmt.setDouble(3, s2);
            pstmt.setDouble(4, s3);
            pstmt.setDouble(5, s4);
            pstmt.setDouble(6, s5);
            pstmt.setString(7, calculateGrade(percentage));

            return pstmt.executeUpdate() > 0;

        } catch (SQLException e) {
            System.err.println("Database Error [addMarks]: " + e.getMessage());
        }
        return false;
    }

    public List<Marks> getMarksByStudentId(int studentId) {
        List<Marks> list = new ArrayList<>();
        String sql = SELECT_COLUMNS +
            "WHERE m.student_id = ? ORDER BY m.id ASC";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, studentId);

            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    list.add(extractMarksFromResultSet(rs));
                }
            }
        } catch (SQLException e) {
            System.err.println(
                "Database Error [getMarksByStudentId]: " + e.getMessage());
        }
        return list;
    }

    public List<Marks> getAllMarks() {
        List<Marks> list = new ArrayList<>();
        String sql = SELECT_COLUMNS + "ORDER BY s.roll_no ASC, m.id ASC";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql);
             ResultSet rs = pstmt.executeQuery()) {

            while (rs.next()) {
                list.add(extractMarksFromResultSet(rs));
            }
        } catch (SQLException e) {
            System.err.println("Database Error [getAllMarks]: " + e.getMessage());
        }
        return list;
    }

    public Marks getMarksById(int markId) {
        String sql = SELECT_COLUMNS + "WHERE m.id = ?";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, markId);

            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return extractMarksFromResultSet(rs);
                }
            }
        } catch (SQLException e) {
            System.err.println("Database Error [getMarksById]: " + e.getMessage());
        }
        return null;
    }

    public boolean updateMarks(int markId, double s1, double s2,
                               double s3, double s4, double s5) {

        String sql = "UPDATE marks SET subject1 = ?, subject2 = ?, " +
            "subject3 = ?, subject4 = ?, subject5 = ?, grade = ? WHERE id = ?";

        double percentage = (s1 + s2 + s3 + s4 + s5) / 5.0;

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setDouble(1, s1);
            pstmt.setDouble(2, s2);
            pstmt.setDouble(3, s3);
            pstmt.setDouble(4, s4);
            pstmt.setDouble(5, s5);
            pstmt.setString(6, calculateGrade(percentage));
            pstmt.setInt(7, markId);

            return pstmt.executeUpdate() > 0;

        } catch (SQLException e) {
            System.err.println("Database Error [updateMarks]: " + e.getMessage());
        }
        return false;
    }

    public boolean deleteMarks(int markId) {
        String sql = "DELETE FROM marks WHERE id = ?";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, markId);
            return pstmt.executeUpdate() > 0;

        } catch (SQLException e) {
            System.err.println("Database Error [deleteMarks]: " + e.getMessage());
        }
        return false;
    }

    private String calculateGrade(double percentage) {
        if (percentage >= 90) return "A+";
        if (percentage >= 80) return "A";
        if (percentage >= 70) return "B";
        if (percentage >= 60) return "C";
        if (percentage >= 50) return "D";
        if (percentage >= 40) return "E";
        return "F";
    }

    private Marks extractMarksFromResultSet(ResultSet rs) throws SQLException {
        Marks m = new Marks();

        m.setId(rs.getInt("id"));
        m.setStudentId(rs.getInt("student_id"));
        m.setSemester(rs.getInt("semester"));
        m.setSubject1(rs.getDouble("subject1"));
        m.setSubject2(rs.getDouble("subject2"));
        m.setSubject3(rs.getDouble("subject3"));
        m.setSubject4(rs.getDouble("subject4"));
        m.setSubject5(rs.getDouble("subject5"));
        m.setTotal(rs.getDouble("total"));
        m.setPercentage(rs.getDouble("percentage"));
        m.setGrade(rs.getString("grade"));
        m.setCreatedAt(rs.getTimestamp("created_at"));
        m.setStudentName(rs.getString("student_name"));
        m.setStudentRollNumber(rs.getString("student_roll"));

        return m;
    }
}

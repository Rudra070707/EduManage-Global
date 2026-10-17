
package com.studentmgmt;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public class StudentDAO {

    private static final String SELECT_COLUMNS =
        "SELECT id, roll_no AS roll_number, " +
        "CONCAT_WS(' ', first_name, last_name) AS name, " +
        "email, phone, course AS department, " +
        "COALESCE(academic_year, 0) AS year, " +
        "address, created_at, updated_at FROM students ";

    public boolean addStudent(Student s) {
        String sql = "INSERT INTO students " +
            "(roll_no, first_name, last_name, email, phone, course, academic_year, address) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        String[] nameParts = splitName(s.getName());

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(
                 sql, Statement.RETURN_GENERATED_KEYS)) {

            pstmt.setString(1, s.getRollNumber());
            pstmt.setString(2, nameParts[0]);
            pstmt.setString(3, nameParts[1]);
            pstmt.setString(4, s.getEmail());
            pstmt.setString(5, s.getPhone());
            pstmt.setString(6, s.getDepartment());

            if (s.getYear() > 0) {
                pstmt.setInt(7, s.getYear());
            } else {
                pstmt.setNull(7, java.sql.Types.TINYINT);
            }

            pstmt.setString(8, s.getAddress());

            if (pstmt.executeUpdate() > 0) {
                try (ResultSet keys = pstmt.getGeneratedKeys()) {
                    if (keys.next()) {
                        s.setId(keys.getInt(1));
                    }
                }
                return true;
            }
        } catch (SQLException e) {
            System.err.println("Database Error [addStudent]: " + e.getMessage());
        }
        return false;
    }

    public List<Student> getAllStudents() {
        List<Student> list = new ArrayList<>();
        String sql = SELECT_COLUMNS + "ORDER BY roll_no ASC";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql);
             ResultSet rs = pstmt.executeQuery()) {

            while (rs.next()) {
                list.add(extractStudentFromResultSet(rs));
            }
        } catch (SQLException e) {
            System.err.println("Database Error [getAllStudents]: " + e.getMessage());
        }
        return list;
    }

    public Student getStudentById(int id) {
        String sql = SELECT_COLUMNS + "WHERE id = ?";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, id);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return extractStudentFromResultSet(rs);
                }
            }
        } catch (SQLException e) {
            System.err.println("Database Error [getStudentById]: " + e.getMessage());
        }
        return null;
    }

    public Student getStudentByRollNumber(String rollNumber) {
        String sql = SELECT_COLUMNS + "WHERE roll_no = ?";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setString(1, rollNumber);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return extractStudentFromResultSet(rs);
                }
            }
        } catch (SQLException e) {
            System.err.println("Database Error [getStudentByRollNumber]: " + e.getMessage());
        }
        return null;
    }

    public boolean updateStudent(Student s) {
        String sql = "UPDATE students SET roll_no = ?, first_name = ?, " +
            "last_name = ?, email = ?, phone = ?, course = ?, " +
            "academic_year = ?, address = ? WHERE id = ?";

        String[] nameParts = splitName(s.getName());

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setString(1, s.getRollNumber());
            pstmt.setString(2, nameParts[0]);
            pstmt.setString(3, nameParts[1]);
            pstmt.setString(4, s.getEmail());
            pstmt.setString(5, s.getPhone());
            pstmt.setString(6, s.getDepartment());

            if (s.getYear() > 0) {
                pstmt.setInt(7, s.getYear());
            } else {
                pstmt.setNull(7, java.sql.Types.TINYINT);
            }

            pstmt.setString(8, s.getAddress());
            pstmt.setInt(9, s.getId());

            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Database Error [updateStudent]: " + e.getMessage());
        }
        return false;
    }

    public boolean deleteStudent(int id) {
        String sql = "DELETE FROM students WHERE id = ?";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, id);
            return pstmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Database Error [deleteStudent]: " + e.getMessage());
        }
        return false;
    }

    public List<Student> searchStudents(String keyword) {
        List<Student> list = new ArrayList<>();
        String sql = SELECT_COLUMNS +
            "WHERE CONCAT_WS(' ', first_name, last_name) LIKE ? " +
            "OR roll_no LIKE ? OR course LIKE ? ORDER BY roll_no ASC";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            String pattern = "%" + keyword + "%";
            pstmt.setString(1, pattern);
            pstmt.setString(2, pattern);
            pstmt.setString(3, pattern);

            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    list.add(extractStudentFromResultSet(rs));
                }
            }
        } catch (SQLException e) {
            System.err.println("Database Error [searchStudents]: " + e.getMessage());
        }
        return list;
    }

    private Student extractStudentFromResultSet(ResultSet rs) throws SQLException {
        return new Student(
            rs.getInt("id"),
            rs.getString("roll_number"),
            rs.getString("name"),
            rs.getString("email"),
            rs.getString("phone"),
            rs.getString("department"),
            rs.getInt("year"),
            rs.getString("address"),
            rs.getTimestamp("created_at"),
            rs.getTimestamp("updated_at")
        );
    }

    private String[] splitName(String fullName) {
        if (fullName == null || fullName.trim().isEmpty()) {
            return new String[]{"", ""};
        }

        String trimmed = fullName.trim();
        int separator = trimmed.indexOf(' ');

        if (separator < 0) {
            return new String[]{trimmed, ""};
        }

        return new String[]{
            trimmed.substring(0, separator).trim(),
            trimmed.substring(separator + 1).trim()
        };
    }
}

package com.studentmgmt;

import java.io.FileInputStream;
import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

/**
 * DBConnection - Database Connection Utility
 *
 * Provides a centralized way to load database credentials from 'db.properties'
 * and establish JDBC connections to the MySQL database.
 *
 * Viva points:
 * 1. DriverManager: Factory class that manages a list of database drivers.
 * 2. db.properties: External configuration prevents hardcoding credentials in source code.
 * 3. Static initialization block: Executes once when the class is loaded into JVM memory.
 */
public class DBConnection {
    private static final Properties props = new Properties();
    private static boolean isLoaded = false;

    // Static initializer block: runs once when DBConnection class is loaded
    static {
        try (FileInputStream fis = new FileInputStream("db.properties")) {
            props.load(fis);
            isLoaded = true;
        } catch (IOException e) {
            System.err.println("==================================================================");
            System.err.println("  ERROR: Could not load db.properties file.");
            System.err.println("  Make sure db.properties exists in the project root folder.");
            System.err.println("  Copy db.properties.example -> db.properties and set your password.");
            System.err.println("==================================================================");
            // In case user hasn't created db.properties yet, allow application to report gracefully
        }
    }

    /**
     * Checks if db.properties was successfully loaded.
     * @return true if properties are loaded, false otherwise
     */
    public static boolean isConfigLoaded() {
        return isLoaded;
    }

    /**
     * Establishes and returns a new JDBC Connection using credentials in db.properties.
     *
     * @return java.sql.Connection instance
     * @throws SQLException if a database access error occurs or url/credentials are invalid
     */
    public static Connection getConnection() throws SQLException {
        if (!isLoaded) {
            throw new SQLException("db.properties is not loaded. Please create db.properties in the project root.");
        }

        return DriverManager.getConnection(
            props.getProperty("db.url"),
            props.getProperty("db.user"),
            props.getProperty("db.password")
        );
    }

    /**
     * Tests whether the database connection can be established.
     *
     * @return true if connection succeeds, false otherwise
     */
    public static boolean testConnection() {
        try (Connection conn = getConnection()) {
            return conn != null && !conn.isClosed();
        } catch (SQLException e) {
            return false;
        }
    }
}

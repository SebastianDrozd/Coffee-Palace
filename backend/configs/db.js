import mysql from "mysql2/promise";
import { config } from "./config.js";

// One shared connection pool. Works with MariaDB (XAMPP) and MySQL 8.
export const pool = mysql.createPool({
  ...config.db,
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "Z", // JS Dates are written and read as UTC
  decimalNumbers: true, // DECIMAL columns come back as numbers, not strings
  dateStrings: ["DATE"], // DATE columns come back as "YYYY-MM-DD"
});

// Keep the database session in UTC too, so CURRENT_TIMESTAMP matches.
pool.pool.on("connection", (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

// Runs fn(conn) inside a transaction; rolls back if it throws.
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

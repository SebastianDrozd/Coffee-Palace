import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// The backend folder, wherever it's started from (Terminal, pm2, ...)
export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({ path: path.join(rootDir, ".env"), quiet: true });

const env = process.env;
const num = (value, fallback) => (value === undefined || value === "" ? fallback : Number(value));

export const config = {
  port: num(env.PORT, 4000),

  db: {
    host: env.DB_HOST || "127.0.0.1",
    port: num(env.DB_PORT, 3306),
    user: env.DB_USER || "root",
    password: env.DB_PASSWORD ?? "",
    database: env.DB_NAME || "coffee_palace",
  },

  // Only needed when the website is served from a different address than this API
  corsOrigins: (env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean),

  uploadsDir: path.resolve(rootDir, env.UPLOADS_DIR || "uploads"),
  maxPhotoBytes: 10 * 1024 * 1024,

  // The tablet + dashboard website (built from the frontend project), served at /
  publicDir: path.resolve(rootDir, env.PUBLIC_DIR || "public"),

  timezone: env.BUSINESS_TIMEZONE || "America/Caracas",

  bcv: {
    enabled: env.BCV_ENABLED !== "false",
    checkEveryMinutes: num(env.BCV_CHECK_MINUTES, 60),
    retryMinutes: num(env.BCV_RETRY_MINUTES, 10),
  },
};

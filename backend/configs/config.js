import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

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

  corsOrigins: (env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean),

  uploadsDir: path.resolve(env.UPLOADS_DIR || "./uploads"),
  maxPhotoBytes: 10 * 1024 * 1024,

  timezone: env.BUSINESS_TIMEZONE || "America/Caracas",

  bcv: {
    enabled: env.BCV_ENABLED !== "false",
    checkEveryMinutes: num(env.BCV_CHECK_MINUTES, 60),
    retryMinutes: num(env.BCV_RETRY_MINUTES, 10),
  },
};

import fs from "node:fs";
import { createApp } from "./app.js";
import { config } from "./configs/config.js";
import { pool } from "./configs/db.js";
import { startScheduler, stopScheduler } from "./services/rateService.js";

fs.mkdirSync(config.uploadsDir, { recursive: true });

const server = createApp().listen(config.port, async () => {
  console.log(`Coffee Palace API en http://localhost:${config.port}/api`);
  console.log(`Frontend permitido (CORS): ${config.corsOrigins.join(", ")}`);
  try {
    await pool.query("SELECT 1");
    console.log(`Base de datos: ${config.db.database} en ${config.db.host}:${config.db.port}`);
  } catch (err) {
    console.error(
      `No se pudo conectar a MySQL (${err.code}). Revisa que esté encendido en XAMPP y los datos en .env.`
    );
  }
  startScheduler();
});

function shutdown() {
  stopScheduler();
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

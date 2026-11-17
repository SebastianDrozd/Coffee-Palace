import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app.js";
import { config } from "./configs/config.js";
import { pool } from "./configs/db.js";
import { startScheduler, stopScheduler } from "./services/rateService.js";

fs.mkdirSync(config.uploadsDir, { recursive: true });

// This computer's addresses on the shop network (what the tablet opens)
function networkAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a.address);
}

const server = createApp().listen(config.port, async () => {
  const hasWebsite = fs.existsSync(path.join(config.publicDir, "index.html"));
  console.log(`Coffee Palace en http://localhost:${config.port}`);
  if (hasWebsite) {
    for (const ip of networkAddresses()) {
      console.log(`  Tablet:     http://${ip}:${config.port}`);
      console.log(`  Dashboard:  http://${ip}:${config.port}/dashboard`);
    }
  } else {
    console.log(`  Solo API (no hay sitio en ${config.publicDir})`);
  }
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

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`El puerto ${config.port} ya está en uso. ¿Ya está abierto Coffee Palace en otra ventana o en pm2?`);
    process.exit(1);
  }
  throw err;
});

function shutdown() {
  stopScheduler();
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

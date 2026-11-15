import multer from "multer";
import { HttpError } from "../utils/httpError.js";

const DB_DOWN = new Set(["ECONNREFUSED", "PROTOCOL_CONNECTION_LOST", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR", "ETIMEDOUT"]);

export function notFoundHandler(req, res) {
  res.status(404).json({ error: "No encontrado." });
}

// Every error leaves as { error: "mensaje en español" }. The screens show it as-is.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la solicitud debe ser JSON." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "La solicitud es demasiado grande." });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "La foto debe pesar 10 MB o menos." });
    return res.status(400).json({ error: 'Envía una sola foto en el campo "image".' });
  }
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "Ese registro ya existe." });
  }
  if (DB_DOWN.has(err.code)) {
    console.error("[db]", err.code, err.message);
    return res.status(503).json({ error: "No hay conexión con la base de datos. Revisa que MySQL esté encendido." });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: "Ocurrió un error en el servidor." });
}

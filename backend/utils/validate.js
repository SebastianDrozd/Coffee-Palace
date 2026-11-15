import { HttpError } from "./httpError.js";

export function cleanText(value, field, { required = false, max = 120 } = {}) {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) throw new HttpError(400, `Falta: ${field.toLowerCase()}.`);
  if (text.length > max) throw new HttpError(400, `${field}: máximo ${max} caracteres.`);
  return text;
}

// Dollar price: null/"" = no price
export function cleanPrice(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 99_999_999) {
    throw new HttpError(400, "El precio debe ser un número positivo.");
  }
  return Math.round(n * 100) / 100;
}

export function idParam(req, name = "id") {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Id no válido.");
  return n;
}

export function requireBody(req) {
  if (!req.body || typeof req.body !== "object") {
    throw new HttpError(400, "El cuerpo de la solicitud debe ser JSON.");
  }
  return req.body;
}

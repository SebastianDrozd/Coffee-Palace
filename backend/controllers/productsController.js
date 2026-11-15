import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../configs/config.js";
import * as categoriesRepo from "../databaseRepos/categoriesRepo.js";
import * as productsRepo from "../databaseRepos/productsRepo.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { cleanPrice, cleanText, idParam, requireBody } from "../utils/validate.js";

// Never send the on-disk file name to the client
const publicProduct = ({ imagePath, ...p }) => p;

// PUT sends the full product, but missing fields keep their current value.
async function productFields(body, existing = {}) {
  const merged = { ...existing, ...body };
  const categoryId = Number(merged.categoryId);
  if (!Number.isInteger(categoryId) || !(await categoriesRepo.getById(categoryId))) {
    throw new HttpError(400, "Elige una categoría.");
  }
  return {
    name: cleanText(merged.name, "Nombre", { required: true, max: 80 }),
    description: cleanText(merged.description ?? "", "Descripción", { max: 200 }),
    priceUsd: cleanPrice(merged.priceUsd),
    categoryId,
    isAvailable: merged.isAvailable !== false,
  };
}

async function deleteFile(fileName) {
  if (!fileName) return;
  await fs.unlink(path.join(config.uploadsDir, fileName)).catch((err) => {
    if (err.code !== "ENOENT") console.error("[fotos] no se pudo borrar", fileName, err.message);
  });
}

export async function list(req, res) {
  const products = await productsRepo.getAll();
  res.json(products.map(publicProduct));
}

export async function create(req, res) {
  const fields = await productFields(requireBody(req));
  const product = await productsRepo.create(fields);
  res.status(201).json(publicProduct(product));
}

export async function update(req, res) {
  const id = idParam(req);
  const existing = await productsRepo.getById(id);
  if (!existing) throw notFound("el producto");
  const fields = await productFields(requireBody(req), existing);
  res.json(publicProduct(await productsRepo.update(id, fields)));
}

export async function remove(req, res) {
  const id = idParam(req);
  const existing = await productsRepo.getById(id);
  if (!existing) throw notFound("el producto");
  await productsRepo.remove(id); // past orders keep their copy (product_id becomes NULL)
  await deleteFile(existing.imagePath);
  res.status(204).end();
}

/* ---------------- photos ---------------- */

// Check the file's first bytes, not just what the browser claims it is
function detectImageType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.toString("ascii", 0, 6) === "GIF87a" || buf.toString("ascii", 0, 6) === "GIF89a") return "gif";
  return null;
}

// multipart/form-data with the file in a field named "image"
export async function uploadImage(req, res) {
  const id = idParam(req);
  const existing = await productsRepo.getById(id);
  if (!existing) throw notFound("el producto");
  if (!req.file) throw new HttpError(400, 'Envía la foto en un campo del formulario llamado "image".');

  const ext = detectImageType(req.file.buffer);
  if (!ext) throw new HttpError(415, "La foto debe ser JPG, PNG, WebP o GIF.");

  await fs.mkdir(config.uploadsDir, { recursive: true });
  const fileName = `product-${id}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(config.uploadsDir, fileName), req.file.buffer);

  const product = await productsRepo.setImagePath(id, fileName);
  await deleteFile(existing.imagePath);
  res.status(201).json(publicProduct(product));
}

export async function deleteImage(req, res) {
  const id = idParam(req);
  const existing = await productsRepo.getById(id);
  if (!existing) throw notFound("el producto");
  const product = await productsRepo.setImagePath(id, null);
  await deleteFile(existing.imagePath);
  res.json(publicProduct(product));
}

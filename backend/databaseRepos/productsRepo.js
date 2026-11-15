import { pool } from "../configs/db.js";
import { iso } from "../utils/dates.js";

const COLUMNS =
  "id, category_id, name, description, price_usd, image_path, is_available, created_at, updated_at";

const toProduct = (r) => ({
  id: r.id,
  categoryId: r.category_id,
  name: r.name,
  description: r.description,
  priceUsd: r.price_usd,
  imageUrl: r.image_path ? `/uploads/${r.image_path}` : null,
  imagePath: r.image_path, // file name on disk; removed before sending to the client
  isAvailable: r.is_available === 1,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

export async function getAll(db = pool) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM products ORDER BY name, id`);
  return rows.map(toProduct);
}

export async function getById(id, db = pool) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM products WHERE id = ?`, [id]);
  return rows[0] ? toProduct(rows[0]) : null;
}

export async function getByIds(ids, db = pool) {
  if (ids.length === 0) return [];
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM products WHERE id IN (?)`, [ids]);
  return rows.map(toProduct);
}

export async function create(p, db = pool) {
  const now = new Date();
  const [result] = await db.query(
    `INSERT INTO products (category_id, name, description, price_usd, is_available, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p.categoryId, p.name, p.description, p.priceUsd, p.isAvailable ? 1 : 0, now, now]
  );
  return getById(result.insertId, db);
}

export async function update(id, p, db = pool) {
  await db.query(
    `UPDATE products
     SET category_id = ?, name = ?, description = ?, price_usd = ?, is_available = ?, updated_at = ?
     WHERE id = ?`,
    [p.categoryId, p.name, p.description, p.priceUsd, p.isAvailable ? 1 : 0, new Date(), id]
  );
  return getById(id, db);
}

export async function setImagePath(id, imagePath, db = pool) {
  await db.query("UPDATE products SET image_path = ?, updated_at = ? WHERE id = ?", [imagePath, new Date(), id]);
  return getById(id, db);
}

export async function remove(id, db = pool) {
  const [result] = await db.query("DELETE FROM products WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

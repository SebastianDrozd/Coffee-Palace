import { pool } from "../configs/db.js";

const toCategory = (r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order });

export async function getAll(db = pool) {
  const [rows] = await db.query("SELECT id, name, sort_order FROM categories ORDER BY sort_order, id");
  return rows.map(toCategory);
}

export async function getById(id, db = pool) {
  const [rows] = await db.query("SELECT id, name, sort_order FROM categories WHERE id = ?", [id]);
  return rows[0] ? toCategory(rows[0]) : null;
}

export async function existsByName(name, excludeId = 0, db = pool) {
  const [rows] = await db.query("SELECT id FROM categories WHERE name = ? AND id <> ? LIMIT 1", [name, excludeId]);
  return rows.length > 0;
}

// New categories go to the end of the list
export async function create(name, db = pool) {
  const [result] = await db.query(
    `INSERT INTO categories (name, sort_order)
     SELECT ?, COALESCE(MAX(sort_order), 0) + 1 FROM categories`,
    [name]
  );
  return getById(result.insertId, db);
}

export async function rename(id, name, db = pool) {
  await db.query("UPDATE categories SET name = ? WHERE id = ?", [name, id]);
  return getById(id, db);
}

export async function countProducts(id, db = pool) {
  const [rows] = await db.query("SELECT COUNT(*) AS n FROM products WHERE category_id = ?", [id]);
  return Number(rows[0].n);
}

export async function remove(id, db = pool) {
  const [result] = await db.query("DELETE FROM categories WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function allIds(db = pool) {
  const [rows] = await db.query("SELECT id FROM categories");
  return rows.map((r) => r.id);
}

// ids: every category id in the new order (run inside a transaction)
export async function setOrder(ids, conn) {
  for (const [index, id] of ids.entries()) {
    await conn.query("UPDATE categories SET sort_order = ? WHERE id = ?", [index + 1, id]);
  }
}

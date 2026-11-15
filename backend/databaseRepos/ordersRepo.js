import { pool } from "../configs/db.js";
import { iso } from "../utils/dates.js";

const ORDER_COLUMNS = `id, order_date, order_number, customer_name, note, status, total_usd, total_bs,
  exchange_rate, exchange_rate_source, created_at, updated_at`;

const toOrder = (r, items) => ({
  id: r.id,
  orderNumber: r.order_number,
  orderDate: r.order_date,
  customerName: r.customer_name,
  note: r.note,
  status: r.status,
  totalUsd: r.total_usd,
  totalBs: r.total_bs,
  exchangeRate: r.exchange_rate,
  exchangeRateSource: r.exchange_rate_source,
  items,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

const toItem = (r) => ({
  id: r.id,
  productId: r.product_id,
  name: r.name,
  priceUsd: r.price_usd,
  priceBs: r.price_bs,
  quantity: r.quantity,
});

async function attachItems(rows, db) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [itemRows] = await db.query(
    `SELECT id, order_id, product_id, name, price_usd, price_bs, quantity
     FROM order_items WHERE order_id IN (?) ORDER BY id`,
    [ids]
  );
  const byOrder = new Map(ids.map((id) => [id, []]));
  for (const item of itemRows) byOrder.get(item.order_id).push(toItem(item));
  return rows.map((r) => toOrder(r, byOrder.get(r.id)));
}

// statuses: ["new", "preparing"]; date: "YYYY-MM-DD" business day
export async function list({ statuses, date } = {}, db = pool) {
  const where = [];
  const params = [];
  if (statuses?.length) {
    where.push("status IN (?)");
    params.push(statuses);
  }
  if (date) {
    where.push("order_date = ?");
    params.push(date);
  }
  const [rows] = await db.query(
    `SELECT ${ORDER_COLUMNS} FROM orders
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at, id
     LIMIT 1000`,
    params
  );
  return attachItems(rows, db);
}

export async function getById(id, db = pool) {
  const [rows] = await db.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ?`, [id]);
  const [order] = await attachItems(rows, db);
  return order ?? null;
}

// Next customer-facing number for the day. Atomic, so two tablets never get the same number.
export async function nextOrderNumber(orderDate, conn) {
  await conn.query(
    `INSERT INTO order_counters (order_date, last_number) VALUES (?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`,
    [orderDate]
  );
  const [[row]] = await conn.query("SELECT LAST_INSERT_ID() AS n");
  return Number(row.n);
}

export async function insert(order, conn) {
  const now = new Date();
  const [result] = await conn.query(
    `INSERT INTO orders (order_date, order_number, customer_name, note, status, total_usd, total_bs,
       exchange_rate, exchange_rate_source, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)`,
    [
      order.orderDate,
      order.orderNumber,
      order.customerName,
      order.note,
      order.totalUsd,
      order.totalBs,
      order.exchangeRate,
      order.exchangeRateSource,
      now,
      now,
    ]
  );
  const orderId = result.insertId;
  await conn.query(
    "INSERT INTO order_items (order_id, product_id, name, price_usd, price_bs, quantity) VALUES ?",
    [order.items.map((i) => [orderId, i.productId, i.name, i.priceUsd, i.priceBs, i.quantity])]
  );
  return orderId;
}

export async function setStatus(id, status, db = pool) {
  const [result] = await db.query("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", [
    status,
    new Date(),
    id,
  ]);
  return result.affectedRows > 0;
}

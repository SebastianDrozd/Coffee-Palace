import { pool } from "../configs/db.js";
import { iso } from "../utils/dates.js";

const toRate = (r) => (r ? { rate: r.rate, valueDate: r.value_date, fetchedAt: iso(r.fetched_at) } : null);

// Save a BCV rate (one per fecha valor; a re-read of the same day updates it)
export async function saveBcvRate({ valueDate, rate, fetchedAt }, db = pool) {
  await db.query(
    `INSERT INTO exchange_rates (value_date, rate, fetched_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE rate = VALUES(rate), fetched_at = VALUES(fetched_at)`,
    [valueDate, rate, new Date(fetchedAt)]
  );
}

// The BCV rate that applies on `date` (latest fecha valor on or before it)
export async function getRateFor(date, db = pool) {
  const [rows] = await db.query(
    `SELECT value_date, rate, fetched_at FROM exchange_rates
     WHERE value_date <= ? ORDER BY value_date DESC LIMIT 1`,
    [date]
  );
  return toRate(rows[0]);
}

// Earliest rate published for after `date` (BCV posts tomorrow's rate in the afternoon)
export async function getUpcoming(date, db = pool) {
  const [rows] = await db.query(
    `SELECT value_date, rate, fetched_at FROM exchange_rates
     WHERE value_date > ? ORDER BY value_date ASC LIMIT 1`,
    [date]
  );
  return toRate(rows[0]);
}

export async function getState(db = pool) {
  const [rows] = await db.query(
    "SELECT manual_rate, manual_set_at, last_check_at, last_error FROM exchange_rate_state WHERE id = 1"
  );
  const r = rows[0] ?? {};
  return {
    manualRate: r.manual_rate ?? null,
    manualSetAt: iso(r.manual_set_at),
    lastCheckAt: iso(r.last_check_at),
    lastError: r.last_error ?? null,
  };
}

export async function setManualRate(rate, db = pool) {
  await db.query(
    `INSERT INTO exchange_rate_state (id, manual_rate, manual_set_at) VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE manual_rate = VALUES(manual_rate), manual_set_at = VALUES(manual_set_at)`,
    [rate, new Date()]
  );
}

export async function clearManualRate(db = pool) {
  await db.query("UPDATE exchange_rate_state SET manual_rate = NULL, manual_set_at = NULL WHERE id = 1");
}

export async function recordCheck(error, db = pool) {
  await db.query(
    `INSERT INTO exchange_rate_state (id, last_check_at, last_error) VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE last_check_at = VALUES(last_check_at), last_error = VALUES(last_error)`,
    [new Date(), error ? String(error).slice(0, 300) : null]
  );
}

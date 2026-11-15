import { withTransaction } from "../configs/db.js";
import * as ordersRepo from "../databaseRepos/ordersRepo.js";
import * as productsRepo from "../databaseRepos/productsRepo.js";
import { getEffectiveRate } from "../services/rateService.js";
import { round2, todayInBusinessTz } from "../utils/dates.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { cleanText, idParam, requireBody } from "../utils/validate.js";

export const STATUSES = ["new", "preparing", "ready", "completed", "cancelled"];
const MAX_QTY = 20;

// GET /orders?status=new,preparing,ready&date=2026-11-03
export async function list(req, res) {
  const statuses = String(req.query.status ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (statuses.some((s) => !STATUSES.includes(s))) throw new HttpError(400, "Estado desconocido.");

  const date = req.query.date ? String(req.query.date) : undefined;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "La fecha debe ser AAAA-MM-DD.");

  res.json(await ordersRepo.list({ statuses, date }));
}

// Body: { customerName, note, items: [{ productId, quantity }] }
// Names and prices come from the database, never from the tablet.
export async function create(req, res) {
  const body = requireBody(req);
  const customerName = cleanText(body.customerName, "Nombre", { required: true, max: 40 });
  const note = cleanText(body.note ?? "", "Nota", { max: 200 });

  const lines = Array.isArray(body.items) ? body.items : [];
  if (lines.length === 0) throw new HttpError(400, "Agrega al menos un producto al pedido.");
  if (lines.length > 50) throw new HttpError(400, "El pedido tiene demasiados productos.");

  // Merge repeated products: { productId -> quantity }
  const quantities = new Map();
  for (const line of lines) {
    const productId = Number(line?.productId);
    const quantity = Number(line?.quantity);
    if (!Number.isInteger(productId) || productId <= 0) throw new HttpError(400, "Producto no válido.");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
      throw new HttpError(400, `La cantidad debe estar entre 1 y ${MAX_QTY}.`);
    }
    quantities.set(productId, Math.min(MAX_QTY, (quantities.get(productId) ?? 0) + quantity));
  }

  const order = await withTransaction(async (conn) => {
    const ids = [...quantities.keys()];
    const products = new Map((await productsRepo.getByIds(ids, conn)).map((p) => [p.id, p]));
    const unavailable = ids.filter((id) => !products.get(id)?.isAvailable);
    if (unavailable.length) {
      throw new HttpError(409, "Algunos productos ya no están disponibles.", { unavailable });
    }

    // Bolívares are fixed at the rate in force right now
    const rate = await getEffectiveRate(conn);
    const items = ids.map((id) => {
      const p = products.get(id);
      return {
        productId: id,
        name: p.name,
        priceUsd: p.priceUsd,
        priceBs: rate && p.priceUsd != null ? round2(p.priceUsd * rate.rate) : null,
        quantity: quantities.get(id),
      };
    });

    const orderDate = todayInBusinessTz();
    const orderId = await ordersRepo.insert(
      {
        orderDate,
        orderNumber: await ordersRepo.nextOrderNumber(orderDate, conn),
        customerName,
        note,
        totalUsd: round2(items.reduce((s, i) => s + (i.priceUsd ?? 0) * i.quantity, 0)),
        totalBs: rate ? round2(items.reduce((s, i) => s + (i.priceBs ?? 0) * i.quantity, 0)) : null,
        exchangeRate: rate?.rate ?? null,
        exchangeRateSource: rate?.source ?? null,
        items,
      },
      conn
    );
    return ordersRepo.getById(orderId, conn);
  });

  res.status(201).json(order);
}

// Body: { status }
export async function setStatus(req, res) {
  const id = idParam(req);
  const status = requireBody(req).status;
  if (!STATUSES.includes(status)) throw new HttpError(400, "Estado desconocido.");
  if (!(await ordersRepo.setStatus(id, status))) throw notFound("el pedido");
  res.json(await ordersRepo.getById(id));
}

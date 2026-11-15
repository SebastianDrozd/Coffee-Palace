// ------------------------------------------------------------------
// STAND-IN BACKEND (temporary)
// An in-memory store used by the route handlers in app/api/* so the
// tablet and dashboard work before the Node/MySQL backend exists.
// Data resets whenever the Next.js server restarts.
// Delete this file and app/api/ once NEXT_PUBLIC_API_URL points at
// the real backend.
// ------------------------------------------------------------------

import { getEffectiveRate } from "@/lib/mockRates";

const SEED_CATEGORIES = ["Cafés calientes", "Cafés fríos", "Té y más", "Panadería"];

// Sample prices in US dollars. Bolívares are calculated with the BCV rate.
const SEED_PRODUCTS = [
  ["Cafés calientes", "Guayoyo", 2.0, "Café colado suave, como en casa."],
  ["Cafés calientes", "Espresso", 2.5, "Un shot doble, corto e intenso."],
  ["Cafés calientes", "Marrón", 2.75, "Espresso con un poco de leche espumada."],
  ["Cafés calientes", "Capuchino", 4.0, "Espresso con mucha espuma de leche."],
  ["Cafés calientes", "Latte", 4.75, "Espresso con leche cremosa."],
  ["Cafés calientes", "Moca", 5.25, "Latte con chocolate oscuro."],
  ["Cafés calientes", "Latte Rosa Palace", 5.75, "Nuestro latte de la casa con rosa y vainilla."],
  ["Cafés fríos", "Latte frío", 5.0, "Espresso y leche fría con hielo."],
  ["Cafés fríos", "Cold brew", 4.5, "Reposado en frío por 18 horas, suave y con cuerpo."],
  ["Cafés fríos", "Frappé de caramelo", 5.5, "Café, leche, hielo y caramelo."],
  ["Té y más", "Chai latte", 4.75, "Té negro con especias y leche."],
  ["Té y más", "Matcha latte", 5.25, "Matcha y leche cremosa."],
  ["Té y más", "Matcha de fresa", 5.75, "Matcha frío sobre leche de fresa."],
  ["Té y más", "Chocolate caliente", 4.0, "Chocolate venezolano con leche caliente."],
  ["Panadería", "Cachito de jamón", 3.0, "Pan suave relleno de jamón."],
  ["Panadería", "Croissant de mantequilla", 3.75, ""],
  ["Panadería", "Golfeado", 3.25, "Pan dulce con papelón, anís y queso."],
  ["Panadería", "Galleta con chispas de chocolate", 2.5, ""],
  ["Panadería", "Pan de cambur", 3.25, "Una rebanada gruesa, ligeramente tostada."],
];

function seed() {
  const now = new Date().toISOString();
  const categories = SEED_CATEGORIES.map((name, i) => ({ id: i + 1, name, sortOrder: i + 1 }));
  const products = SEED_PRODUCTS.map(([cat, name, priceUsd, description], i) => ({
    id: i + 1,
    categoryId: categories.find((c) => c.name === cat).id,
    name,
    description,
    priceUsd,
    imageUrl: null,
    isAvailable: true,
    createdAt: now,
    updatedAt: now,
  }));

  return {
    categories,
    products,
    orders: [],
    images: new Map(), // filename -> { buffer, contentType }
    nextId: { category: categories.length + 1, product: products.length + 1, order: 1, orderItem: 1 },
    orderCounter: { date: null, value: 0 },
  };
}

// Kept on globalThis so every route handler (and dev hot-reloads) share one store.
const db = (globalThis.__coffeePalaceDb ??= seed());

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const clone = (v) => structuredClone(v);
const nowIso = () => new Date().toISOString();
const localDateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function cleanText(value, field, { required = false, max = 120 } = {}) {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) throw new HttpError(400, `Falta: ${field.toLowerCase()}.`);
  if (text.length > max) throw new HttpError(400, `${field}: máximo ${max} caracteres.`);
  return text;
}

function cleanPrice(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, "El precio debe ser un número positivo.");
  return Math.round(n * 100) / 100;
}

/* ---------------- categories ---------------- */

export function listCategories() {
  return clone([...db.categories].sort((a, b) => a.sortOrder - b.sortOrder));
}

export function addCategory(body) {
  const name = cleanText(body?.name, "Nombre", { required: true, max: 60 });
  if (db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    throw new HttpError(409, `Ya existe una categoría llamada "${name}".`);
  }
  const sortOrder = Math.max(0, ...db.categories.map((c) => c.sortOrder)) + 1;
  const category = { id: db.nextId.category++, name, sortOrder };
  db.categories.push(category);
  return clone(category);
}

export function editCategory(id, body) {
  const category = db.categories.find((c) => c.id === id);
  if (!category) throw new HttpError(404, "No se encontró la categoría.");
  if (body?.name !== undefined) {
    const name = cleanText(body.name, "Nombre", { required: true, max: 60 });
    if (db.categories.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
      throw new HttpError(409, `Ya existe una categoría llamada "${name}".`);
    }
    category.name = name;
  }
  return clone(category);
}

export function removeCategory(id) {
  const index = db.categories.findIndex((c) => c.id === id);
  if (index === -1) throw new HttpError(404, "No se encontró la categoría.");
  const count = db.products.filter((p) => p.categoryId === id).length;
  if (count > 0) {
    throw new HttpError(409, `Primero mueve o elimina ${count === 1 ? "su producto" : `sus ${count} productos`}.`);
  }
  db.categories.splice(index, 1);
}

export function reorderCategoryList(body) {
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number) : null;
  if (!ids || ids.length !== db.categories.length || !db.categories.every((c) => ids.includes(c.id))) {
    throw new HttpError(400, "Envía todos los id de categoría en el nuevo orden.");
  }
  ids.forEach((id, i) => {
    db.categories.find((c) => c.id === id).sortOrder = i + 1;
  });
  return listCategories();
}

/* ---------------- products ---------------- */

export function listProducts() {
  return clone([...db.products].sort((a, b) => a.name.localeCompare(b.name)));
}

function productFields(body, existing) {
  const merged = { ...existing, ...body };
  const categoryId = Number(merged.categoryId);
  if (!db.categories.some((c) => c.id === categoryId)) {
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

export function addProduct(body) {
  const product = {
    id: db.nextId.product++,
    ...productFields(body, {}),
    imageUrl: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.products.push(product);
  return clone(product);
}

export function editProduct(id, body) {
  const product = db.products.find((p) => p.id === id);
  if (!product) throw new HttpError(404, "No se encontró el producto.");
  Object.assign(product, productFields(body, product), { updatedAt: nowIso() });
  return clone(product);
}

export function removeProduct(id) {
  const index = db.products.findIndex((p) => p.id === id);
  if (index === -1) throw new HttpError(404, "No se encontró el producto.");
  dropImage(db.products[index]);
  db.products.splice(index, 1);
}

function dropImage(product) {
  if (product.imageUrl) db.images.delete(product.imageUrl.split("/").pop());
  product.imageUrl = null;
}

const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export async function setProductImage(id, file) {
  const product = db.products.find((p) => p.id === id);
  if (!product) throw new HttpError(404, "No se encontró el producto.");
  if (!file || typeof file === "string") throw new HttpError(400, 'Envía la foto en un campo del formulario llamado "image".');
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new HttpError(415, "La foto debe ser JPG, PNG, WebP o GIF.");
  if (file.size > 10 * 1024 * 1024) throw new HttpError(413, "La foto debe pesar 10 MB o menos.");

  dropImage(product);
  const filename = `product-${id}-${Date.now()}.${ext}`;
  db.images.set(filename, { buffer: Buffer.from(await file.arrayBuffer()), contentType: file.type });
  product.imageUrl = `/uploads/${filename}`;
  product.updatedAt = nowIso();
  return clone(product);
}

export function clearProductImage(id) {
  const product = db.products.find((p) => p.id === id);
  if (!product) throw new HttpError(404, "No se encontró el producto.");
  dropImage(product);
  product.updatedAt = nowIso();
  return clone(product);
}

export function getImage(filename) {
  return db.images.get(filename) || null;
}

/* ---------------- orders ---------------- */

export function listOrders({ statuses, date } = {}) {
  let orders = db.orders;
  if (statuses?.length) orders = orders.filter((o) => statuses.includes(o.status));
  if (date) orders = orders.filter((o) => localDateKey(new Date(o.createdAt)) === date);
  return clone([...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
}

const round2 = (n) => Math.round(n * 100) / 100;

export async function placeOrder(body) {
  const customerName = cleanText(body?.customerName, "Nombre", { required: true, max: 40 });
  const note = cleanText(body?.note ?? "", "Nota", { max: 200 });
  const lines = Array.isArray(body?.items) ? body.items : [];
  if (lines.length === 0) throw new HttpError(400, "Agrega al menos un producto al pedido.");

  const unavailable = [];
  const items = lines.map((line) => {
    const product = db.products.find((p) => p.id === Number(line.productId));
    const quantity = Math.floor(Number(line.quantity));
    if (!product || !product.isAvailable) {
      unavailable.push(Number(line.productId));
      return null;
    }
    if (!(quantity >= 1 && quantity <= 20)) throw new HttpError(400, "La cantidad debe estar entre 1 y 20.");
    return {
      id: db.nextId.orderItem++,
      productId: product.id,
      name: product.name,
      priceUsd: product.priceUsd,
      quantity,
    };
  });
  if (unavailable.length) {
    throw new HttpError(409, "Algunos productos ya no están disponibles.", { unavailable });
  }

  // Bolívares are fixed at the rate in force when the order is placed.
  const rate = await getEffectiveRate();
  for (const item of items) {
    item.priceBs = rate && item.priceUsd != null ? round2(item.priceUsd * rate.rate) : null;
  }

  const today = localDateKey();
  if (db.orderCounter.date !== today) db.orderCounter = { date: today, value: 0 };

  const order = {
    id: db.nextId.order++,
    orderNumber: ++db.orderCounter.value,
    customerName,
    note,
    status: "new",
    totalUsd: round2(items.reduce((s, i) => s + (i.priceUsd || 0) * i.quantity, 0)),
    totalBs: rate ? round2(items.reduce((s, i) => s + (i.priceBs || 0) * i.quantity, 0)) : null,
    exchangeRate: rate?.rate ?? null,
    exchangeRateSource: rate?.source ?? null,
    items,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.orders.push(order);
  return clone(order);
}

const STATUSES = ["new", "preparing", "ready", "completed", "cancelled"];

export function setOrderStatus(id, body) {
  const order = db.orders.find((o) => o.id === id);
  if (!order) throw new HttpError(404, "No se encontró el pedido.");
  if (!STATUSES.includes(body?.status)) throw new HttpError(400, "Estado desconocido.");
  order.status = body.status;
  order.updatedAt = nowIso();
  return clone(order);
}

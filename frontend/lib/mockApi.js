// ------------------------------------------------------------------
// STAND-IN BACKEND (temporary): every /api/* call in one route handler.
// Used when NEXT_PUBLIC_API_URL isn't set, e.g. the Vercel demo.
//
// Why one handler: serverless hosts like Vercel may run separate route
// files in separate functions, each with its own memory. Routing
// everything through app/api/[...path]/route.js keeps the menu, orders
// and rate in one shared in-memory store.
// ------------------------------------------------------------------
import { connection } from "next/server";
import {
  HttpError,
  addCategory,
  addProduct,
  clearProductImage,
  editCategory,
  editProduct,
  getImage,
  listCategories,
  listOrders,
  listProducts,
  placeOrder,
  removeCategory,
  removeProduct,
  reorderCategoryList,
  setOrderStatus,
  setProductImage,
} from "@/lib/mockDb";
import { clearManualRate, getRateStatus, rateStatus, refreshFromBcv, setManualRate } from "@/lib/mockRates";

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "El cuerpo de la solicitud debe ser JSON.");
  }
}

function id(params) {
  const n = Number(params.id);
  if (!Number.isInteger(n)) throw new HttpError(400, "Id no válido.");
  return n;
}

// [method, path pattern, handler(request, params)]
// A handler's return value is sent as JSON; undefined = 204; a Response is sent as-is.
const ROUTES = [
  ["GET", "categories", () => listCategories()],
  ["POST", "categories", async (req) => addCategory(await readJson(req))],
  ["PUT", "categories/reorder", async (req) => reorderCategoryList(await readJson(req))],
  ["PUT", "categories/:id", async (req, p) => editCategory(id(p), await readJson(req))],
  ["DELETE", "categories/:id", (req, p) => void removeCategory(id(p))],

  ["GET", "products", () => listProducts()],
  ["POST", "products", async (req) => addProduct(await readJson(req))],
  ["PUT", "products/:id", async (req, p) => editProduct(id(p), await readJson(req))],
  ["DELETE", "products/:id", (req, p) => void removeProduct(id(p))],
  ["POST", "products/:id/image", async (req, p) => setProductImage(id(p), (await req.formData()).get("image"))],
  ["DELETE", "products/:id/image", (req, p) => clearProductImage(id(p))],
  ["GET", "uploads/:file", (req, p) => servePhoto(p.file)],

  ["GET", "orders", (req) => ordersQuery(req)],
  ["POST", "orders", async (req) => placeOrder(await readJson(req))],
  ["PATCH", "orders/:id/status", async (req, p) => setOrderStatus(id(p), await readJson(req))],

  ["GET", "exchange-rate", () => getRateStatus()],
  ["POST", "exchange-rate/refresh", async () => (await refreshFromBcv(), rateStatus())],
  ["PUT", "exchange-rate/manual", async (req) => manualRate(await readJson(req))],
  ["DELETE", "exchange-rate/manual", async () => (clearManualRate(), await refreshFromBcv(), rateStatus())],
];

// GET /api/orders?status=new,preparing,ready&date=2026-11-03
function ordersQuery(req) {
  const params = req.nextUrl.searchParams;
  const statuses = params.get("status")?.split(",").filter(Boolean);
  const date = params.get("date") || undefined;
  return listOrders({ statuses, date });
}

function manualRate(body) {
  const rate = Number(body?.rate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1e9) {
    throw new HttpError(400, "Escribe una tasa válida, por ejemplo 891,1054.");
  }
  return setManualRate(Math.round(rate * 1e8) / 1e8);
}

function servePhoto(file) {
  const image = getImage(file);
  if (!image) return new Response("No encontrado", { status: 404 });
  return new Response(image.buffer, {
    headers: { "Content-Type": image.contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

function match(method, segments) {
  for (const [m, pattern, handler] of ROUTES) {
    if (m !== method) continue;
    const parts = pattern.split("/");
    if (parts.length !== segments.length) continue;
    const params = {};
    const ok = parts.every((part, i) => {
      if (part.startsWith(":")) {
        params[part.slice(1)] = decodeURIComponent(segments[i]);
        return true;
      }
      return part === segments[i];
    });
    if (ok) return { handler, params };
  }
  return null;
}

export async function handleApi(request, { params }) {
  await connection();
  const { path = [] } = await params;
  const found = match(request.method, path);
  if (!found) return Response.json({ error: "No encontrado." }, { status: 404 });

  try {
    const result = await found.handler(request, found.params);
    if (result instanceof Response) return result;
    if (result === undefined) return new Response(null, { status: 204 });
    return Response.json(result, { status: request.method === "POST" ? 201 : 200 });
  } catch (err) {
    if (err instanceof HttpError) {
      return Response.json({ error: err.message, ...err.extra }, { status: err.status });
    }
    console.error(err);
    return Response.json({ error: "Ocurrió un error en el servidor." }, { status: 500 });
  }
}

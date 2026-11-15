// End-to-end API tests against a real MySQL/MariaDB database.
//   Needs a user that can create the database `coffee_palace_test` (it's dropped and rebuilt).
//   Uses DB_HOST / DB_PORT / DB_USER / DB_PASSWORD from the environment or .env.
//   Run: npm test
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import mysql from "mysql2/promise";

const here = path.dirname(new URL(import.meta.url).pathname);
const TEST_DB = "coffee_palace_test";
const ORIGIN = "http://localhost:3000";

let api; // base URL of the running API
let server;
let bcvServer;
let bcvMode = "today";
let pool;
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-uploads-"));

// 1×1 PNG and a text file pretending to be one
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function call(method, url, body, headers = {}) {
  const init = { method, headers: { Origin: ORIGIN, ...headers } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(api + url, init);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

function photoForm(buffer, name = "foto.png", type = "image/png") {
  const form = new FormData();
  form.append("image", new Blob([buffer], { type }), name);
  return form;
}

before(async () => {
  // Fake bcv.org.ve serving the real page captured on 2026-11-03
  const page = fs.readFileSync(path.join(here, "fixtures/bcv-2026-11-03.html"), "utf8");
  bcvServer = http
    .createServer((req, res) => {
      if (bcvMode === "down") return req.socket.destroy();
      let html = page;
      if (bcvMode === "tomorrow") {
        html = page
          .replace("891,10540000", "900,50000000")
          .replace('content="2026-11-03T00:00:00-04:00"', 'content="2999-01-01T00:00:00-04:00"');
      }
      if (bcvMode === "broken") html = "<html><body>Sitio en mantenimiento</body></html>";
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html);
    })
    .listen(0);
  await new Promise((r) => bcvServer.once("listening", r));

  Object.assign(process.env, {
    DB_NAME: TEST_DB,
    BCV_URL: `http://127.0.0.1:${bcvServer.address().port}/`,
    BCV_ENABLED: "false",
    UPLOADS_DIR: uploadsDir,
    CORS_ORIGIN: ORIGIN,
  });

  // Fresh test database from the real schema.sql + seed.sql
  const { config } = await import("../configs/config.js");
  const admin = await mysql.createConnection({ ...config.db, database: undefined, multipleStatements: true });
  const sql = (file) =>
    fs.readFileSync(path.join(here, "../database", file), "utf8").replaceAll("coffee_palace", TEST_DB);
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await admin.query(sql("schema.sql"));
  await admin.query(sql("seed.sql"));
  await admin.end();

  ({ pool } = await import("../configs/db.js"));
  const { createApp } = await import("../app.js");
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  api = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  bcvServer?.close();
  await pool?.end();
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});

describe("basics", () => {
  test("health check", async () => {
    const r = await call("GET", "/health");
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, { ok: true });
  });

  test("unknown route is JSON 404", async () => {
    const r = await call("GET", "/nope");
    assert.equal(r.status, 404);
    assert.equal(r.data.error, "No encontrado.");
  });

  test("bad JSON is a 400 in Spanish", async () => {
    const r = await call("POST", "/categories", "{oops");
    assert.equal(r.status, 400);
    assert.equal(r.data.error, "El cuerpo de la solicitud debe ser JSON.");
  });

  test("CORS allows only the frontend", async () => {
    const ok = await call("GET", "/categories");
    assert.equal(ok.headers.get("access-control-allow-origin"), ORIGIN);
    const other = await call("GET", "/categories", undefined, { Origin: "http://evil.example" });
    assert.equal(other.headers.get("access-control-allow-origin"), null);
  });
});

describe("categories", () => {
  test("seeded in order", async () => {
    const r = await call("GET", "/categories");
    assert.deepEqual(
      r.data.map((c) => c.name),
      ["Cafés calientes", "Cafés fríos", "Té y más", "Panadería"]
    );
  });

  test("create, duplicate, rename", async () => {
    const created = await call("POST", "/categories", { name: "  Especiales  " });
    assert.equal(created.status, 201);
    assert.equal(created.data.name, "Especiales");
    assert.equal(created.data.sortOrder, 5);

    const dup = await call("POST", "/categories", { name: "cafes calientes" }); // case/accent-insensitive
    assert.equal(dup.status, 409);

    const empty = await call("POST", "/categories", { name: "   " });
    assert.equal(empty.status, 400);
    assert.equal(empty.data.error, "Falta: nombre.");

    const renamed = await call("PUT", `/categories/${created.data.id}`, { name: "De temporada" });
    assert.equal(renamed.data.name, "De temporada");

    const missing = await call("PUT", "/categories/9999", { name: "X" });
    assert.equal(missing.status, 404);
  });

  test("reorder needs every id", async () => {
    const { data: cats } = await call("GET", "/categories");
    const partial = await call("PUT", "/categories/reorder", { ids: [cats[0].id] });
    assert.equal(partial.status, 400);

    const ids = cats.map((c) => c.id).reverse();
    const r = await call("PUT", "/categories/reorder", { ids });
    assert.deepEqual(
      r.data.map((c) => c.id),
      ids
    );
    await call("PUT", "/categories/reorder", { ids: [...ids].reverse() });
  });

  test("delete only when empty", async () => {
    const { data: cats } = await call("GET", "/categories");
    const bakery = cats.find((c) => c.name === "Panadería");
    const blocked = await call("DELETE", `/categories/${bakery.id}`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.data.error, "Primero mueve o elimina sus 5 productos.");

    const seasonal = cats.find((c) => c.name === "De temporada");
    assert.equal((await call("DELETE", `/categories/${seasonal.id}`)).status, 204);
  });
});

describe("products", () => {
  let teaId;
  let productId;

  test("seeded menu in dollars", async () => {
    const r = await call("GET", "/products");
    assert.equal(r.data.length, 19);
    const latte = r.data.find((p) => p.name === "Latte");
    assert.equal(latte.priceUsd, 4.75);
    assert.equal(latte.isAvailable, true);
    assert.equal(latte.imageUrl, null);
    assert.equal("imagePath" in latte, false);
  });

  test("create and validate", async () => {
    const { data: cats } = await call("GET", "/categories");
    teaId = cats.find((c) => c.name === "Té y más").id;

    const bad = await call("POST", "/products", { name: "X", categoryId: 9999 });
    assert.equal(bad.status, 400);
    assert.equal(bad.data.error, "Elige una categoría.");

    const badPrice = await call("POST", "/products", { name: "X", categoryId: teaId, priceUsd: -1 });
    assert.equal(badPrice.status, 400);

    const r = await call("POST", "/products", {
      name: "Papelón con limón",
      categoryId: teaId,
      priceUsd: 3.456,
      description: "Bien frío",
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.priceUsd, 3.46);
    productId = r.data.id;
  });

  test("update keeps fields that aren't sent", async () => {
    const r = await call("PUT", `/products/${productId}`, { isAvailable: false });
    assert.equal(r.data.isAvailable, false);
    assert.equal(r.data.name, "Papelón con limón");
    assert.equal(r.data.priceUsd, 3.46);
  });

  test("photo upload, replace, remove", async () => {
    const wrong = await call("POST", `/products/${productId}/image`, photoForm(Buffer.from("not an image at all"), "x.png"));
    assert.equal(wrong.status, 415);

    const up = await call("POST", `/products/${productId}/image`, photoForm(PNG));
    assert.equal(up.status, 201);
    assert.match(up.data.imageUrl, /^\/uploads\/product-\d+-\d+\.png$/);
    const file1 = path.join(uploadsDir, path.basename(up.data.imageUrl));
    assert.ok(fs.existsSync(file1));

    const served = await fetch(api + up.data.imageUrl);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("content-type"), "image/png");

    await new Promise((r) => setTimeout(r, 5));
    const again = await call("POST", `/products/${productId}/image`, photoForm(PNG));
    assert.notEqual(again.data.imageUrl, up.data.imageUrl);
    assert.ok(!fs.existsSync(file1), "old photo is deleted");

    const removed = await call("DELETE", `/products/${productId}/image`);
    assert.equal(removed.data.imageUrl, null);
    assert.equal(fs.readdirSync(uploadsDir).length, 0);
  });

  test("delete", async () => {
    assert.equal((await call("DELETE", `/products/${productId}`)).status, 204);
    assert.equal((await call("DELETE", `/products/${productId}`)).status, 404);
  });
});

describe("exchange rate", () => {
  test("no rate before the first check", async () => {
    const r = await call("GET", "/exchange-rate");
    assert.equal(r.data.rate, null);
  });

  test("reads the real BCV page", async () => {
    bcvMode = "today";
    const r = await call("POST", "/exchange-rate/refresh");
    assert.equal(r.data.rate, 891.1054);
    assert.equal(r.data.source, "bcv");
    assert.equal(r.data.lastError, null);
    assert.ok(r.data.lastCheckAt);
  });

  test("a later fecha valor waits for its day", async () => {
    bcvMode = "tomorrow";
    const r = await call("POST", "/exchange-rate/refresh");
    assert.equal(r.data.rate, 891.1054);
    assert.deepEqual(r.data.upcoming, { rate: 900.5, valueDate: "2999-01-01" });
  });

  test("BCV down or changed: keeps the last rate", async () => {
    bcvMode = "down";
    let r = await call("POST", "/exchange-rate/refresh");
    assert.equal(r.data.rate, 891.1054);
    assert.equal(r.data.lastError, "No se pudo conectar con la página del BCV.");

    bcvMode = "broken";
    r = await call("POST", "/exchange-rate/refresh");
    assert.equal(r.data.lastError, "La página del BCV cambió: no se encontró la tasa del dólar.");
  });

  test("manual rate and back", async () => {
    const bad = await call("PUT", "/exchange-rate/manual", { rate: "abc" });
    assert.equal(bad.status, 400);

    let r = await call("PUT", "/exchange-rate/manual", { rate: 905.25 });
    assert.equal(r.data.rate, 905.25);
    assert.equal(r.data.source, "manual");
    assert.equal(r.data.bcvRate.rate, 891.1054);

    bcvMode = "today";
    r = await call("DELETE", "/exchange-rate/manual");
    assert.equal(r.data.source, "bcv");
    assert.equal(r.data.rate, 891.1054);
    assert.equal(r.data.lastError, null);
  });
});

describe("orders", () => {
  let products;
  const byName = (n) => products.find((p) => p.name === n);

  before(async () => {
    products = (await call("GET", "/products")).data;
  });

  test("validation", async () => {
    let r = await call("POST", "/orders", { customerName: "", items: [{ productId: 1, quantity: 1 }] });
    assert.equal(r.status, 400);
    r = await call("POST", "/orders", { customerName: "Ana", items: [] });
    assert.equal(r.data.error, "Agrega al menos un producto al pedido.");
    r = await call("POST", "/orders", { customerName: "Ana", items: [{ productId: byName("Latte").id, quantity: 21 }] });
    assert.equal(r.data.error, "La cantidad debe estar entre 1 y 20.");
  });

  test("hidden or missing products are 409 with their ids", async () => {
    const bread = byName("Pan de cambur");
    await call("PUT", `/products/${bread.id}`, { isAvailable: false });
    const r = await call("POST", "/orders", {
      customerName: "Ana",
      items: [
        { productId: bread.id, quantity: 1 },
        { productId: 99999, quantity: 1 },
        { productId: byName("Latte").id, quantity: 1 },
      ],
    });
    assert.equal(r.status, 409);
    assert.deepEqual(r.data.unavailable.sort(), [bread.id, 99999].sort());
    await call("PUT", `/products/${bread.id}`, { isAvailable: true });
  });

  test("prices come from the database at the BCV rate", async () => {
    const r = await call("POST", "/orders", {
      customerName: "María José",
      note: "Leche deslactosada",
      items: [
        { productId: byName("Latte").id, quantity: 2, priceUsd: 0.01 }, // client prices are ignored
        { productId: byName("Cachito de jamón").id, quantity: 1 },
      ],
    });
    assert.equal(r.status, 201);
    const o = r.data;
    assert.equal(o.orderNumber, 1);
    assert.equal(o.status, "new");
    assert.equal(o.customerName, "María José");
    assert.equal(o.exchangeRate, 891.1054);
    assert.equal(o.exchangeRateSource, "bcv");
    assert.equal(o.totalUsd, 12.5);
    assert.equal(o.items[0].priceBs, 4232.75);
    assert.equal(o.items[1].priceBs, 2673.32);
    assert.equal(o.totalBs, 11138.82);
  });

  test("repeated products are merged", async () => {
    const latte = byName("Latte").id;
    const r = await call("POST", "/orders", {
      customerName: "Luis",
      items: [
        { productId: latte, quantity: 1 },
        { productId: latte, quantity: 2 },
      ],
    });
    assert.equal(r.data.items.length, 1);
    assert.equal(r.data.items[0].quantity, 3);
    assert.equal(r.data.orderNumber, 2);
  });

  test("10 tablets ordering at once get unique numbers", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        call("POST", "/orders", { customerName: `Cliente ${i}`, items: [{ productId: byName("Guayoyo").id, quantity: 1 }] })
      )
    );
    assert.ok(results.every((r) => r.status === 201));
    const numbers = results.map((r) => r.data.orderNumber).sort((a, b) => a - b);
    assert.deepEqual(numbers, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test("manual rate is saved on the order", async () => {
    await call("PUT", "/exchange-rate/manual", { rate: 905.25 });
    const r = await call("POST", "/orders", { customerName: "Pedro", items: [{ productId: byName("Latte").id, quantity: 1 }] });
    assert.equal(r.data.exchangeRate, 905.25);
    assert.equal(r.data.exchangeRateSource, "manual");
    assert.equal(r.data.totalBs, 4299.94);
    await call("DELETE", "/exchange-rate/manual");
  });

  test("status flow, board and history", async () => {
    const { data: active } = await call("GET", "/orders?status=new,preparing,ready");
    assert.equal(active.length, 13); // 1 + 1 + 10 tablets + 1 manual-rate order
    assert.equal(active[0].orderNumber, 1, "oldest first");

    const first = active[0];
    assert.equal((await call("PATCH", `/orders/${first.id}/status`, { status: "bogus" })).status, 400);
    assert.equal((await call("PATCH", "/orders/99999/status", { status: "ready" })).status, 404);
    for (const status of ["preparing", "ready", "completed"]) {
      const r = await call("PATCH", `/orders/${first.id}/status`, { status });
      assert.equal(r.data.status, status);
    }
    await call("PATCH", `/orders/${active[1].id}/status`, { status: "cancelled" });

    const { data: stillOpen } = await call("GET", "/orders?status=new,preparing,ready");
    assert.equal(stillOpen.length, 11);

    const today = first.orderDate;
    const { data: history } = await call("GET", `/orders?status=completed,cancelled&date=${today}`);
    assert.deepEqual(
      history.map((o) => o.status),
      ["completed", "cancelled"]
    );
    const { data: otherDay } = await call("GET", "/orders?status=completed,cancelled&date=2000-01-01");
    assert.equal(otherDay.length, 0);
    assert.equal((await call("GET", "/orders?date=03-11-2026")).status, 400);
  });

  test("deleting a product keeps past orders intact", async () => {
    const cachito = byName("Cachito de jamón");
    assert.equal((await call("DELETE", `/products/${cachito.id}`)).status, 204);
    const { data: history } = await call("GET", "/orders?status=completed");
    const item = history[0].items.find((i) => i.name === "Cachito de jamón");
    assert.equal(item.productId, null);
    assert.equal(item.priceUsd, 3);
    assert.equal(item.priceBs, 2673.32);
  });
});

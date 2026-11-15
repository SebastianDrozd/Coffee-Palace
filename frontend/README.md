# Coffee Palace — frontend

Next.js app with two parts:

| Screen | URL | Runs on |
| --- | --- | --- |
| Start screen | `/` | Tablet |
| Menu (categories + items + your order) | `/order` | Tablet |
| Review and place order | `/order/review` | Tablet |
| Order placed (order number, returns to start) | `/order/done` | Tablet |
| Orders board (New → Making → Ready, finished today) | `/dashboard` | Counter computer |
| Products (add, edit, delete, photos, hide from tablet) | `/dashboard/products` | Counter computer |
| Categories (add, rename, reorder, delete) | `/dashboard/categories` | Counter computer |
| Dollar rate (BCV rate, update now, manual rate) | `/dashboard/tasa` | Counter computer |

Products without a photo show their name on the tablet instead of a picture.

## Language and currency

- All screens are in Spanish (Venezuela), using "tú".
- Prices are **saved in US dollars** and shown in both currencies: `$4,75` with `Bs. 4.232,75` underneath.
- Bolívares = dollar price × the official BCV rate, rounded to 2 decimals per unit (same on tablet and server).
- Numbers use the Venezuelan format (dot for thousands, comma for decimals). It's built by hand in
  `lib/format.js` because browsers still label VES as "Bs.S".
- Staff type dollar prices as `4,75` or `4.75`. To show bolívares first, set `primaryCurrency: "VES"` in `lib/config.js`.
- If no rate is known yet, every screen shows dollars only (never a stale or made-up bolívar price).

## BCV exchange rate

The server reads the official dollar rate from https://www.bcv.org.ve/ (the BCV has no API, so it reads the page):

```html
<div id="dolar"> … <strong class="strong-tb">891,10540000</strong> …
Fecha Valor: <span … content="2026-11-03T00:00:00-04:00">Martes, 03 Noviembre 2026</span>
```

- **`lib/bcv.js`** does the fetching and parsing. It's plain Node.js with no dependencies, so it can be
  copied into the Express backend as-is (it's an ES module: use `"type": "module"` or rename it `bcv.mjs`).
- **Hourly check.** BCV publishes once per business day, usually in the afternoon. After a failure it retries every 10 minutes.
- **Fecha valor.** BCV often publishes tomorrow's rate today. It's saved as "upcoming" and only used from that date
  (Caracas time), so prices don't jump early.
- **If BCV is down or the page changes**, the last good rate keeps being used and the dashboard shows the error.
  Staff can set a manual rate on **Tasa del dólar** until BCV is back.
- **Orders save the rate they used** (`exchangeRate`, `totalBs`, `priceBs` per item), so history doesn't change when the rate does.
- **TLS:** bcv.org.ve often doesn't send its intermediate certificate, so Node rejects it with
  `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. The common fix online is `rejectUnauthorized: false` — don't do that, it lets
  anyone on the network feed you a fake rate. `lib/bcv.js` downloads the missing intermediate from the URL in the
  certificate itself and still verifies the chain against Node's trusted roots.
- Test with the saved page: `lib/__fixtures__/bcv-2026-11-03.html` (real markup captured on 2026-11-03).
  `BCV_URL` can point the fetcher at another URL for testing.

In the Express backend:

```js
import { fetchBcvUsdRate } from "./services/bcv.js";

async function checkBcv() {
  try {
    const { rate, valueDate } = await fetchBcvUsdRate();
    await db.query(
      `INSERT INTO exchange_rates (value_date, rate, source, fetched_at) VALUES (?, ?, 'bcv', NOW())
       ON DUPLICATE KEY UPDATE rate = VALUES(rate), fetched_at = NOW()`,
      [valueDate, rate]
    );
  } catch (err) {
    console.error("[tasa BCV]", err.message); // keep using the last saved rate
  }
}
checkBcv();
setInterval(checkBcv, 60 * 60 * 1000);
// Current rate: SELECT rate FROM exchange_rates WHERE value_date <= <today in America/Caracas>
//               ORDER BY value_date DESC LIMIT 1   (unless a manual rate is set)
```

## Run it

```bash
npm install
npm run dev
```

- Tablet: http://localhost:3000
- Dashboard: http://localhost:3000/dashboard

To reach it from the tablet and another computer on the same network:

```bash
npm run build
npm start -- -H 0.0.0.0 -p 3000
```

Then open `http://<this-computer's-ip>:3000` on the tablet and `/dashboard` on the counter computer.

Fonts are bundled with the app (no Google Fonts call), so the tablet works on a network without internet.

## Backend

The real backend is in `../backend` (Node.js + Express + MySQL/MariaDB). To use it, create `.env.local` here with
`NEXT_PUBLIC_API_URL=http://localhost:4000/api` and restart. Setup steps are in `../backend/README.md`.

## Stand-in API (used when NEXT_PUBLIC_API_URL isn't set)

`app/api/[...path]/route.js` + `lib/mockApi.js` + `lib/mockDb.js` + `lib/mockRates.js` are an in-memory backend so the app
works without the real one (local demos, the Vercel demo). It really does read bcv.org.ve every hour.
Every `/api/*` call goes through the one route handler on purpose: serverless hosts can run separate route files in
separate functions with separate memory, and then the tablet and dashboard wouldn't see the same orders.
Orders, products and photos are shared between the tablet and dashboard but **reset when the server restarts**.

When the real backend is up:

1. Create `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://192.168.1.50:4000/api
   ```
2. Optionally delete `app/api/`, `lib/mockApi.js`, `lib/mockDb.js` and `lib/mockRates.js` (they're unused once the URL is set).
3. Enable CORS on the Express server for the frontend's origin (`app.use(cors({ origin: "http://<frontend>:3000" }))`).

All frontend calls go through `lib/api/client.js` → `lib/api/categories.js`, `lib/api/products.js`, `lib/api/orders.js`, `lib/api/exchangeRate.js`.

## Demo on Vercel

For showing the app without the backend. Data lives in memory on Vercel: it starts from the sample menu and resets
on a new deploy or after the site sits unused for a while (photos added during the demo go with it).
Keeping the dashboard or tablet open keeps it alive.

```bash
npx vercel login       # once; signs in through the browser
npx vercel --prod      # from this folder; accept the defaults (Next.js is detected)
```

- Share the **production** address it prints (`https://<project>.vercel.app`), not the per-deploy URL, which may ask
  visitors to log in to Vercel.
- Don't add `NEXT_PUBLIC_API_URL` in Vercel. `.vercelignore` keeps `.env.local` from being uploaded, so a local backend
  setting won't leak into the demo.
- Anyone with the link can use the dashboard. Remove the project in Vercel (Settings, then Delete Project) after the demo.

## Settings

`lib/config.js`: show/hide prices, which currency shows first, symbols and locale, tablet idle timeout (default: "¿Sigues ahí?" after 90 s, reset 20 s later), how long the thank-you screen stays up, refresh intervals, slow-order highlight, photo resize size.

## API contract for the backend

Base URL = `NEXT_PUBLIC_API_URL` (e.g. `http://server:4000/api`). JSON in and out.
Errors: any non-2xx status with `{ "error": "Mensaje para el usuario" }`. The tablet and dashboard show this text on screen, so write it in Spanish.

### Categories

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/categories` | | `Category[]` sorted by `sortOrder` |
| POST | `/categories` | `{ name }` | `Category` (409 if name exists) |
| PUT | `/categories/:id` | `{ name }` | `Category` |
| PUT | `/categories/reorder` | `{ ids: [3, 1, 2, …] }` (every id, new order) | `Category[]` |
| DELETE | `/categories/:id` | | 204 (409 if it still has products) |

`Category = { id, name, sortOrder }`

### Products

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/products` | | `Product[]` (all, including hidden ones) |
| POST | `/products` | `{ name, categoryId, priceUsd, description, isAvailable }` | `Product` |
| PUT | `/products/:id` | same as POST (full object) | `Product` |
| DELETE | `/products/:id` | | 204 |
| POST | `/products/:id/image` | `multipart/form-data`, file in field **`image`** | `Product` |
| DELETE | `/products/:id/image` | | `Product` |

`Product = { id, categoryId, name, description, priceUsd, imageUrl, isAvailable }`

- `priceUsd` is the price in US dollars (e.g. `4.75`) or `null` (no price shown). The frontend calculates bolívares itself.
- `imageUrl` is `null` or a path relative to the API base, e.g. `/uploads/product-4-1730.webp`.
  The frontend loads it from `NEXT_PUBLIC_API_URL + imageUrl`, so serve uploads under the API path:
  `app.use("/api/uploads", express.static("uploads"))`. Full `http(s)://` URLs also work.
- Photos are resized in the browser (max 1000 px, WebP or JPEG) before upload, so they're small. Uploading a new one replaces the old one.

### Orders

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/orders?status=new,preparing,ready` | | `Order[]` oldest first |
| GET | `/orders?status=completed,cancelled&date=2026-11-03` | | `Order[]` for that local date |
| POST | `/orders` | `{ customerName, note, items: [{ productId, quantity }] }` | `Order` (201) |
| PATCH | `/orders/:id/status` | `{ status }` | `Order` |

```
Order = {
  id, orderNumber, customerName, note,
  status: "new" | "preparing" | "ready" | "completed" | "cancelled",
  totalUsd, totalBs, exchangeRate, exchangeRateSource: "bcv" | "manual",
  createdAt, updatedAt,
  items: [{ id, productId, name, priceUsd, priceBs, quantity }]
}
```

- `priceBs = round(priceUsd × exchangeRate, 2)`, `totalBs = Σ priceBs × quantity`. All three are `null` when no rate is known.

- The server looks up names and prices itself (never trust the tablet) and stores a copy on each order item, so deleting or repricing a product doesn't change past orders.
- If an item is missing or hidden, return **409** with `{ error, unavailable: [productId, …] }`. The tablet marks those items as sold out.
- `orderNumber` is what customers see (#12). The stand-in restarts it at 1 each day.

### Exchange rate

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/exchange-rate` | | `RateStatus` |
| POST | `/exchange-rate/refresh` | | `RateStatus` (checks bcv.org.ve now) |
| PUT | `/exchange-rate/manual` | `{ rate: 905.25 }` | `RateStatus` (uses this rate, pauses BCV) |
| DELETE | `/exchange-rate/manual` | | `RateStatus` (back to BCV, checks it now) |

```
RateStatus = {
  rate,                 // Bs. per US$ in use now, or null
  source,               // "bcv" | "manual" | null
  valueDate,            // "2026-11-03" (BCV fecha valor), null for manual
  updatedAt,            // when this rate was read or set
  bcvRate,              // { rate, valueDate } BCV rate for today, even while manual is on
  upcoming,             // { rate, valueDate } already published for a later date, or null
  lastCheckAt, lastError, checkEveryMinutes, today
}
```

### Suggested MySQL tables

```sql
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(200) NOT NULL DEFAULT '',
  price_usd DECIMAL(10,2) NULL,
  image_path VARCHAR(255) NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number INT NOT NULL,
  order_date DATE NOT NULL,
  customer_name VARCHAR(40) NOT NULL,
  note VARCHAR(200) NOT NULL DEFAULT '',
  status ENUM('new','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'new',
  total_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_bs DECIMAL(16,2) NULL,
  exchange_rate DECIMAL(18,8) NULL,
  exchange_rate_source ENUM('bcv','manual') NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY (order_date, order_number),
  KEY (status)
);

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NULL,
  name VARCHAR(80) NOT NULL,
  price_usd DECIMAL(10,2) NULL,
  price_bs DECIMAL(16,2) NULL,
  quantity INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE exchange_rates (
  value_date DATE PRIMARY KEY,          -- BCV "fecha valor"
  rate DECIMAL(18,8) NOT NULL,          -- Bs. per US$
  source ENUM('bcv','manual') NOT NULL DEFAULT 'bcv',
  fetched_at DATETIME NOT NULL
);

-- Manual override (one row, or empty when using BCV)
CREATE TABLE manual_exchange_rate (
  id TINYINT PRIMARY KEY DEFAULT 1,
  rate DECIMAL(18,8) NOT NULL,
  set_at DATETIME NOT NULL
);
```

## Project layout

```
app/
  (kiosk)/            tablet screens: page.js (start), order/, order/review/, order/done/
  dashboard/          staff screens: page.js (orders), products/, categories/, tasa/ (dollar rate)
  api/                stand-in API (delete later)
components/kiosk/     tablet UI: tiles, order panel, steppers, idle reset
components/dashboard/ dashboard UI: sidebar, order card, product form, dialogs
components/ui/        modal, icons, DualPrice ($ + Bs.)
hooks/                useMenu, useNow, useChime, useExchangeRate
lib/                  config, formatting, photo resizing, bcv.js (BCV rate fetcher)
lib/api/              frontend API modules (client, categories, products, orders, exchangeRate).
                      Not in a top-level api/ folder: Vercel would turn those files into functions.
public/brand/         logo, bean mark, wordmark (cut from the shop logo)
util/                 ReactQueryProvider
```

## Tablet tips

- iPad: open the site in Safari → Share → Add to Home Screen, then use Guided Access to lock the iPad to it.
- Android: use the browser's "Install app" / pinned-screen mode.
- Pinch-zoom is turned off on the tablet screens; the dashboard zooms normally.
- Turn on the new-order chime with **Sound on** (it stays on). After reloading the dashboard, click anywhere once so the browser allows sound.

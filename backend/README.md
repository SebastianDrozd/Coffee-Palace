# Coffee Palace — backend

Node.js + Express API for the Coffee Palace tablet and dashboard, with MySQL/MariaDB.
Prices are saved in US dollars; bolívares are calculated with the official BCV rate, which the
server reads from https://www.bcv.org.ve/ every hour.

Works with **XAMPP** (its "MySQL" is MariaDB 10.4+) and with **MySQL 8**. Needs **Node.js 20+**.

## Setup

1. **Start MySQL** in the XAMPP Control Panel.
2. **Create the tables:** in phpMyAdmin go to *Import*, choose `database/schema.sql`, click *Go*.
   For the sample menu, import `database/seed.sql` the same way.
   (Command line instead: `mysql -u root < database/schema.sql` then `mysql -u root < database/seed.sql`.)
   Both scripts are safe to run again; they only add what's missing.
3. **Configure:** copy `.env.example` to `.env`. With XAMPP's defaults (user `root`, no password) it works as is.
4. **Run:**
   ```bash
   npm install
   npm start          # or: npm run dev   (restarts on file changes)
   ```
   You should see:
   ```
   Coffee Palace API en http://localhost:4000/api
   Base de datos: coffee_palace en 127.0.0.1:3306
   [tasa BCV] Bs. 891.1054 (fecha valor 2026-11-03)
   ```
   Check http://localhost:4000/api/health, which should answer `{"ok":true}`.
5. **Point the frontend at it:** in the `frontend` folder create `.env.local` with
   ```
   NEXT_PUBLIC_API_URL=http://localhost:4000/api
   ```
   and restart `npm run dev`. Without this line the frontend keeps using its built-in stand-in API.

## Running it in the shop (tablet + counter computer)

The tablet's browser calls this API directly, so `localhost` won't work from the tablet.
On the computer that runs both servers (say its IP is `192.168.1.50`):

- `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://192.168.1.50:4000/api`
- `backend/.env`: `CORS_ORIGIN=http://192.168.1.50:3000,http://localhost:3000`
- Rebuild the frontend after changing `NEXT_PUBLIC_API_URL` (`npm run build && npm start -- -H 0.0.0.0`):
  Next.js bakes `NEXT_PUBLIC_*` values in at build time.
- Allow ports **3000** and **4000** in Windows Firewall (private network).
- Give that computer a fixed IP in the router so the tablet's address doesn't change.

## What's where

```
server.js                 starts the API and the hourly BCV check
app.js                    Express app: CORS, JSON, photos, routes, errors
configs/                  config.js (.env), db.js (connection pool, transactions)
routes/                   URL → controller
controllers/              validation and business rules
databaseRepos/            SQL only, one file per table group
services/bcv.js           reads the BCV page (same file as frontend/lib/bcv.js)
services/rateService.js   rate in use (BCV or manual), hourly scheduler
middleware/               photo upload (multer), error handler
database/schema.sql       tables
database/seed.sql         sample menu (Spanish, prices in US$)
uploads/                  product photos (back this folder up with the database)
tests/                    end-to-end API tests
```

## How it behaves

- **Errors** always come back as `{ "error": "mensaje en español" }`; the screens show them as-is.
  If MySQL is off, every call answers 503 "No hay conexión con la base de datos. Revisa que MySQL esté encendido."
- **Orders:** the server looks up names and prices itself (it ignores any prices sent by the tablet), saves a copy on
  each order line, and fixes the bolívar amounts at the rate in force at that moment. Deleting or repricing a product
  later doesn't change past orders.
- **Order numbers** restart at 1 each day (Caracas time) and never repeat, even with several tablets ordering at once.
- **Hidden or deleted products** in an order answer 409 with `unavailable: [ids]`, and the tablet marks them "agotado".
- **Photos:** JPG, PNG, WebP or GIF up to 10 MB, checked by content (not just the file name), saved in `uploads/`
  and served at `/api/uploads/...`. Replacing or removing a photo deletes the old file.

### BCV rate

- Checks bcv.org.ve when the server starts, then every 60 minutes (`BCV_CHECK_MINUTES`), or every 10 after a failure
  (`BCV_RETRY_MINUTES`). Paused while a manual rate is set.
- Each rate is saved by its **fecha valor**. BCV usually publishes tomorrow's rate in the afternoon; it's stored as
  "upcoming" and only used from that date.
- If BCV is down or its page changes, the last saved rate stays in use, and the dashboard's *Tasa del dólar* page
  shows the error. Staff can set a manual rate there.
- bcv.org.ve often doesn't send its intermediate SSL certificate. `services/bcv.js` downloads the missing certificate
  and still verifies the connection fully. It does **not** turn off certificate checking (the usual fix you'll find
  online), which would let anyone on the network feed the shop a fake rate.

## API

Base URL: `http://<server>:4000/api`. JSON in and out.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/health` | | `{ ok: true }` |
| GET | `/categories` | | categories in display order |
| POST | `/categories` | `{ name }` | category (409 if the name exists) |
| PUT | `/categories/reorder` | `{ ids: [every id, new order] }` | categories |
| PUT | `/categories/:id` | `{ name }` | category |
| DELETE | `/categories/:id` | | 204 (409 if it still has products) |
| GET | `/products` | | all products, hidden ones included |
| POST | `/products` | `{ name, categoryId, priceUsd, description, isAvailable }` | product |
| PUT | `/products/:id` | any of the fields above | product |
| DELETE | `/products/:id` | | 204 |
| POST | `/products/:id/image` | multipart, file in field `image` | product |
| DELETE | `/products/:id/image` | | product |
| GET | `/orders?status=new,preparing,ready&date=YYYY-MM-DD` | | orders, oldest first |
| POST | `/orders` | `{ customerName, note, items: [{ productId, quantity }] }` | order (201) |
| PATCH | `/orders/:id/status` | `{ status }` | order |
| GET | `/exchange-rate` | | rate status |
| POST | `/exchange-rate/refresh` | | rate status (checks BCV now) |
| PUT | `/exchange-rate/manual` | `{ rate }` | rate status |
| DELETE | `/exchange-rate/manual` | | rate status (back to BCV, checks it now) |

Statuses: `new` → `preparing` → `ready` → `completed`, or `cancelled`.
Full field lists are in the frontend README ("API contract for the backend").

## Tests

```bash
npm test
```

Runs 26 end-to-end tests against a real database: categories, products, photo upload, orders (including 10 at once),
the BCV rate (with a saved copy of the real BCV page, plus "site down" and "page changed"), CORS and errors.
It **creates and drops a database called `coffee_palace_test`**, using `DB_USER` / `DB_PASSWORD` from `.env`
(XAMPP's root works). It never touches `coffee_palace`.

## Not included yet

- **No login.** Anyone on the shop network who can reach port 4000 can change the menu or orders. Next step: a PIN
  or staff login for the dashboard routes.
- **No backups.** Back up the `coffee_palace` database (phpMyAdmin → Export) and the `uploads` folder.

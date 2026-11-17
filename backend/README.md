# Coffee Palace — backend

Node.js + Express server for the Coffee Palace tablet and dashboard, with MySQL/MariaDB.
It serves **both the website and the API on one address** (port 4000): the tablet and dashboard pages are
prebuilt plain files in `public/`, so no Next.js server is needed.

Prices are saved in US dollars; bolívares are calculated with the official BCV rate, which the server reads from
https://www.bcv.org.ve/ every hour.

Works with **XAMPP** (its "MySQL" is MariaDB 10.4+) and with **MySQL 8**. Needs **Node.js 16 or newer**, so it runs on
old Macs (macOS 10.13 High Sierra and up).

## Setup

On a Mac, read "Installing on a Mac" below first.

1. **Start MySQL** in XAMPP (Windows: XAMPP Control Panel; Mac: manager-osx → *Manage Servers*).
2. **Create the tables:** in phpMyAdmin go to *Import*, choose `database/schema.sql`, click *Go*.
   For the sample menu, import `database/seed.sql` the same way.
   (Command line instead: `mysql -u root < database/schema.sql` then `mysql -u root < database/seed.sql`.)
   Both scripts are safe to run again; they only add what's missing.
3. **Configure:** copy `.env.example` to `.env`. With XAMPP's defaults (user `root`, no password) it works as is.
4. **Run:**
   ```bash
   npm install
   npm start
   ```
   You should see:
   ```
   Coffee Palace en http://localhost:4000
     Tablet:     http://192.168.1.50:4000
     Dashboard:  http://192.168.1.50:4000/dashboard
   Base de datos: coffee_palace en 127.0.0.1:3306
   [tasa BCV] Bs. 891.1054 (fecha valor 2026-11-03)
   ```
5. **Open it:** the tablet uses the *Tablet* address, the counter computer the *Dashboard* address
   (on the server itself, http://localhost:4000 and http://localhost:4000/dashboard).

## Running it in the shop

- The tablet and the counter computer must be on the **same Wi-Fi/network** as the server.
- Give the server a **fixed IP** in the router so the tablet's address doesn't change.
- Allow incoming connections to `node` (Mac: click *Allow* when asked; Windows Firewall: allow port 4000, private network).
- Keep it running after closing the terminal and after a restart with pm2 (see the Mac section).

## Updating the website

The pages in `public/` are built from the `frontend` folder. After changing the frontend, on a computer with
**Node 20+** (not the old Mac), run in `frontend`:

```bash
npm run build:static          # builds and copies the site into ../backend/public
```

Then copy the new `public/` folder to the server and restart it (`pm2 restart coffee-palace`).
The `frontend` folder is not needed on the server.

## Installing on a Mac

**Copy only the `backend` folder, without `node_modules`.** Then run `npm install` on the Mac.

**Node.js:** macOS 10.13–10.14 can run at most **Node 16**: install
https://nodejs.org/dist/v16.20.2/node-v16.20.2.pkg. On macOS 10.15 or newer, install the LTS from https://nodejs.org.

**MySQL + phpMyAdmin:** any of these works with `schema.sql`. Only the connection details differ:

| Package | `DB_PORT` | `DB_USER` / `DB_PASSWORD` (defaults) |
| --- | --- | --- |
| XAMPP for macOS | 3306 | `root` / *(empty)* |
| MAMP | **8889** | `root` / `root` |
| Homebrew `mysql` | 3306 | `root` / *(empty)* |

**Files copied from another computer are "from an unidentified developer".** Clear that once for the whole folder,
then create `.env` in Terminal (it's hidden in Finder):

```bash
cd ~/Documents/"Coffee Palace"/backend
xattr -dr com.apple.quarantine .
cp .env.example .env
open -e .env        # or: nano .env
```

**The Mac's network IP:** `npm start` prints it, or `ipconfig getifaddr en0`.

**Firewall:** if macOS asks whether `node` may accept incoming connections, click **Allow**, or the tablet can't connect.

**Keep it awake:** if the Mac sleeps, the tablet and dashboard stop working. System Preferences → Energy Saver →
turn on *Prevent computer from sleeping automatically when the display is off* (MacBook: on the *Power Adapter* tab,
and keep it plugged in).

**Keep it running** after closing Terminal and after a restart, with pm2 (version 5 works on Node 16; newer pm2 needs
Node 18):

```bash
sudo npm install -g pm2@5
cd ~/Documents/"Coffee Palace"/backend
pm2 start server.js --name coffee-palace
pm2 save
pm2 startup        # prints one sudo command: copy, paste and run it
```

`pm2 status` shows it, `pm2 logs` shows its output, `pm2 restart coffee-palace` restarts it.
After a restart of the Mac, start MySQL in XAMPP (or set it to start automatically there).

## What's where

```
server.js                 starts the server and the hourly BCV check
app.js                    Express app: CORS, JSON, photos, API routes, website, errors
public/                   the website (built from the frontend with npm run build:static)
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

Needs Node 18+ (the server itself runs on 16). Runs 26 end-to-end tests against a real database: categories, products, photo upload, orders (including 10 at once),
the BCV rate (with a saved copy of the real BCV page, plus "site down" and "page changed"), CORS and errors.
It **creates and drops a database called `coffee_palace_test`**, using `DB_USER` / `DB_PASSWORD` from `.env`
(XAMPP's root works). It never touches `coffee_palace`.

## Not included yet

- **No login.** Anyone on the shop network who can reach port 4000 can change the menu or orders. Next step: a PIN
  or staff login for the dashboard routes.
- **No backups.** Back up the `coffee_palace` database (phpMyAdmin → Export) and the `uploads` folder.

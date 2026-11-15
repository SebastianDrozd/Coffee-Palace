import { config } from "@/lib/config";

export function hasPrice(priceUsd) {
  return config.showPrices && priceUsd !== null && priceUsd !== undefined && Number(priceUsd) > 0;
}

const round2 = (n) => Math.round(n * 100) / 100;

// Venezuelan number format, built by hand so every browser shows the same thing:
// 4500 -> "4.500,00"
export function formatAmount(value, { grouping = true, decimals = config.priceDecimals } = {}) {
  const n = Number(value) || 0;
  const [whole, cents] = Math.abs(n).toFixed(decimals).split(".");
  const grouped = grouping ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : whole;
  return `${n < 0 ? "-" : ""}${grouped}${cents ? `,${cents}` : ""}`;
}

// 4.75 -> "$4,75"
export function formatUsd(usd) {
  return `${config.usdSymbol}${formatAmount(usd)}`;
}

// 4232.75 -> "Bs. 4.232,75"
export function formatBs(bs) {
  return `${config.bsSymbol} ${formatAmount(bs)}`;
}

// 891.1054 -> "891,1054"
export function formatRate(rate) {
  return formatAmount(rate, { decimals: config.rateDecimals });
}

// Dollar price -> bolívares at the given rate (rounded per unit, same as the server)
export function toBs(usd, rate) {
  if (!rate || usd === null || usd === undefined) return null;
  return round2(Number(usd) * rate);
}

// Turns what staff type into a number. Accepts "4,75", "4.75", "1.250,50" and "1250".
// Returns null for an empty field and NaN for anything that isn't a price.
export function parsePrice(text) {
  const s = String(text ?? "").replace(/\s|Bs\.?|\$/gi, "");
  if (s === "") return null;
  let normalized;
  if (s.includes(",")) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    normalized = s.replace(/\./g, ""); // "1.250" = one thousand two hundred fifty
  } else {
    normalized = s;
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 1e8) / 1e8;
}

// Price as it appears in the edit field: 4.75 -> "4,75"
export function priceInputValue(price) {
  return price === null || price === undefined ? "" : formatAmount(price, { grouping: false });
}

export function lineTotal(items) {
  return round2(items.reduce((sum, i) => sum + (Number(i.priceUsd) || 0) * i.quantity, 0));
}

export function lineTotalBs(items, rate) {
  if (!rate) return null;
  return round2(items.reduce((sum, i) => sum + (toBs(i.priceUsd, rate) || 0) * i.quantity, 0));
}

export function itemCount(items) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

// plural(2, "producto", "productos") -> "2 productos"
export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export function minutesSince(iso, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

export function waitLabel(iso, now) {
  const m = minutesSince(iso, now);
  if (m < 1) return "Ahora";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export function clockTime(iso) {
  return new Date(iso).toLocaleTimeString(config.locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// "2026-11-03" -> "martes, 3 de noviembre de 2026"
export function longDate(ymd) {
  if (!ymd) return "";
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString(config.locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// YYYY-MM-DD in the browser's local time zone
export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

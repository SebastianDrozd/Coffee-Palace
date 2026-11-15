// ------------------------------------------------------------------
// STAND-IN BACKEND (temporary): exchange rate store.
// Keeps the BCV dollar rate in memory and re-checks bcv.org.ve every hour.
// The Express backend should do the same with a timer + MySQL (see README).
// ------------------------------------------------------------------
import { fetchBcvUsdRate } from "@/lib/bcv";

const CHECK_EVERY_MS = 60 * 60 * 1000; // BCV publishes once per business day; hourly is plenty
const RETRY_AFTER_ERROR_MS = 10 * 60 * 1000;
const KEEP_RATES = 10;

const state = (globalThis.__coffeePalaceRates ??= {
  rates: [], // [{ rate, valueDate: "YYYY-MM-DD", fetchedAt }], newest first
  manual: null, // { rate, setAt }
  lastCheckAt: null,
  lastError: null,
  inflight: null,
});

// Today's date in Caracas (UTC-4), as YYYY-MM-DD
export function todayInCaracas(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(now);
}

function rememberRate(r) {
  const existing = state.rates.find((x) => x.valueDate === r.valueDate);
  if (existing) Object.assign(existing, r);
  else state.rates.push({ rate: r.rate, valueDate: r.valueDate, fetchedAt: r.fetchedAt });
  state.rates.sort((a, b) => b.valueDate.localeCompare(a.valueDate));
  state.rates.length = Math.min(state.rates.length, KEEP_RATES);
}

// BCV usually publishes tomorrow's rate in the afternoon. A rate only applies from its
// "fecha valor", so until then we keep using today's.
function bcvRateFor(today) {
  return state.rates.find((r) => r.valueDate <= today) ?? state.rates.at(-1) ?? null;
}

function effectiveRate() {
  if (state.manual) {
    return { rate: state.manual.rate, source: "manual", valueDate: null, updatedAt: state.manual.setAt };
  }
  const r = bcvRateFor(todayInCaracas());
  return r ? { rate: r.rate, source: "bcv", valueDate: r.valueDate, updatedAt: r.fetchedAt } : null;
}

export function refreshFromBcv() {
  if (state.inflight) return state.inflight;
  state.inflight = (async () => {
    try {
      rememberRate(await fetchBcvUsdRate());
      state.lastError = null;
    } catch (err) {
      state.lastError = err.message || "No se pudo leer la página del BCV.";
      console.error("[tasa BCV]", state.lastError, err.cause?.code ?? "");
    } finally {
      state.lastCheckAt = new Date().toISOString();
      state.inflight = null;
    }
  })();
  return state.inflight;
}

// Checks BCV when the last check is old. Waits only when there is no rate at all yet.
async function refreshIfDue() {
  const age = Date.now() - (state.lastCheckAt ? new Date(state.lastCheckAt).getTime() : 0);
  const due = age >= (state.lastError ? RETRY_AFTER_ERROR_MS : CHECK_EVERY_MS);
  if (!due) return;
  const pending = refreshFromBcv();
  if (!effectiveRate()) await pending;
}

export async function getEffectiveRate() {
  await refreshIfDue();
  return effectiveRate();
}

export async function getRateStatus() {
  await refreshIfDue();
  return rateStatus();
}

export function rateStatus() {
  const today = todayInCaracas();
  const current = effectiveRate();
  const latest = state.rates[0] ?? null;
  const bcv = bcvRateFor(today);
  return {
    rate: current?.rate ?? null,
    source: current?.source ?? null,
    valueDate: current?.valueDate ?? null,
    updatedAt: current?.updatedAt ?? null,
    bcvRate: bcv ? { rate: bcv.rate, valueDate: bcv.valueDate } : null,
    upcoming: latest && latest.valueDate > today ? { rate: latest.rate, valueDate: latest.valueDate } : null,
    lastCheckAt: state.lastCheckAt,
    lastError: state.lastError,
    checkEveryMinutes: CHECK_EVERY_MS / 60_000,
    today,
  };
}

export function setManualRate(rate) {
  state.manual = { rate, setAt: new Date().toISOString() };
  return rateStatus();
}

export function clearManualRate() {
  state.manual = null;
  return rateStatus();
}

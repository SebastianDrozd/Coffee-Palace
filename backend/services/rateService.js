// The dollar rate in use: BCV (checked automatically) or a manual rate set by staff.
import { config } from "../configs/config.js";
import * as ratesRepo from "../databaseRepos/exchangeRatesRepo.js";
import { todayInBusinessTz } from "../utils/dates.js";
import { fetchBcvUsdRate } from "./bcv.js";

let inflight = null;
let timer = null;

// Reads bcv.org.ve and saves the rate. Never throws: failures are saved as lastError.
export function checkBcvNow() {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const result = await fetchBcvUsdRate();
      await ratesRepo.saveBcvRate(result);
      await ratesRepo.recordCheck(null);
      console.log(`[tasa BCV] Bs. ${result.rate} (fecha valor ${result.valueDate})`);
      return true;
    } catch (err) {
      const message = err.message || "No se pudo leer la página del BCV.";
      console.error("[tasa BCV]", message, err.cause?.code ?? "");
      await ratesRepo.recordCheck(message).catch((dbErr) => console.error("[tasa BCV]", dbErr.message));
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// { rate, source: "bcv" | "manual", valueDate, updatedAt } or null if no rate is known
export async function getEffectiveRate(db) {
  const state = await ratesRepo.getState(db);
  if (state.manualRate) {
    return { rate: state.manualRate, source: "manual", valueDate: null, updatedAt: state.manualSetAt };
  }
  const today = todayInBusinessTz();
  // First run in the afternoon may only know tomorrow's rate; better than none.
  const bcv = (await ratesRepo.getRateFor(today, db)) ?? (await ratesRepo.getUpcoming(today, db));
  return bcv ? { rate: bcv.rate, source: "bcv", valueDate: bcv.valueDate, updatedAt: bcv.fetchedAt } : null;
}

export async function getStatus() {
  const today = todayInBusinessTz();
  const [state, current, bcvToday, upcoming] = await Promise.all([
    ratesRepo.getState(),
    getEffectiveRate(),
    ratesRepo.getRateFor(today),
    ratesRepo.getUpcoming(today),
  ]);
  return {
    rate: current?.rate ?? null,
    source: current?.source ?? null,
    valueDate: current?.valueDate ?? null,
    updatedAt: current?.updatedAt ?? null,
    bcvRate: bcvToday ? { rate: bcvToday.rate, valueDate: bcvToday.valueDate } : null,
    upcoming: upcoming ? { rate: upcoming.rate, valueDate: upcoming.valueDate } : null,
    lastCheckAt: state.lastCheckAt,
    lastError: state.lastError,
    checkEveryMinutes: config.bcv.checkEveryMinutes,
    today,
  };
}

export async function setManual(rate) {
  await ratesRepo.setManualRate(rate);
  return getStatus();
}

// Back to the BCV rate, checking bcv.org.ve right away
export async function clearManual() {
  await ratesRepo.clearManualRate();
  await checkBcvNow();
  return getStatus();
}

// Checks BCV on startup, then every BCV_CHECK_MINUTES (BCV_RETRY_MINUTES after a failure).
// Skips checks while a manual rate is set.
export function startScheduler() {
  if (!config.bcv.enabled || timer) return;
  const loop = async () => {
    let ok = true;
    try {
      const { manualRate } = await ratesRepo.getState();
      if (!manualRate) ok = await checkBcvNow();
    } catch (err) {
      ok = false;
      console.error("[tasa BCV] scheduler:", err.message);
    }
    const minutes = ok ? config.bcv.checkEveryMinutes : config.bcv.retryMinutes;
    timer = setTimeout(loop, minutes * 60_000);
    timer.unref();
  };
  timer = setTimeout(loop, 0);
  timer.unref();
}

export function stopScheduler() {
  clearTimeout(timer);
  timer = null;
}

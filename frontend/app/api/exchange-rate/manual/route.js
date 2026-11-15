import { HttpError } from "@/lib/mockDb";
import { clearManualRate, rateStatus, refreshFromBcv, setManualRate } from "@/lib/mockRates";
import { readJson, route } from "@/lib/mockRoute";

// Use a rate typed by staff instead of the BCV one: { rate: 905.5 }
export const PUT = route(async (req) => {
  const body = await readJson(req);
  const rate = Number(body?.rate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1e9) {
    throw new HttpError(400, "Escribe una tasa válida, por ejemplo 891,1054.");
  }
  return setManualRate(Math.round(rate * 1e8) / 1e8);
});

// Go back to the automatic BCV rate, checking bcv.org.ve right away
export const DELETE = route(async () => {
  clearManualRate();
  await refreshFromBcv();
  return rateStatus();
});

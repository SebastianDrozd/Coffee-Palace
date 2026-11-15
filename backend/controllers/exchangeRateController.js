import * as rateService from "../services/rateService.js";
import { HttpError } from "../utils/httpError.js";
import { requireBody } from "../utils/validate.js";

export async function getStatus(req, res) {
  res.json(await rateService.getStatus());
}

// Check bcv.org.ve now instead of waiting for the hourly check
export async function refresh(req, res) {
  await rateService.checkBcvNow();
  res.json(await rateService.getStatus());
}

// Body: { rate: 905.25 } (Bs. per US$)
export async function setManual(req, res) {
  const rate = Number(requireBody(req).rate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1e9) {
    throw new HttpError(400, "Escribe una tasa válida, por ejemplo 891,1054.");
  }
  res.json(await rateService.setManual(Math.round(rate * 1e8) / 1e8));
}

export async function clearManual(req, res) {
  res.json(await rateService.clearManual());
}

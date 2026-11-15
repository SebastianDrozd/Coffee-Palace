import { config } from "../configs/config.js";

// Today's date in the business time zone (Caracas), as "YYYY-MM-DD"
export function todayInBusinessTz(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone }).format(now);
}

export const iso = (value) => (value ? new Date(value).toISOString() : null);

export const round2 = (n) => Math.round(n * 100) / 100;

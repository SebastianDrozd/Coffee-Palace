import { apiRequest } from "@/api/client";

export const rateKeys = {
  current: ["exchange-rate"],
};

// { rate, source: "bcv" | "manual", valueDate, updatedAt, upcoming, lastCheckAt, lastError, ... }
export const getExchangeRate = () => apiRequest("/exchange-rate");

// Check bcv.org.ve now
export const refreshExchangeRate = () => apiRequest("/exchange-rate/refresh", { method: "POST" });

export const setManualRate = (rate) =>
  apiRequest("/exchange-rate/manual", { method: "PUT", body: { rate } });

export const clearManualRate = () => apiRequest("/exchange-rate/manual", { method: "DELETE" });

import { rateStatus, refreshFromBcv } from "@/lib/mockRates";
import { route } from "@/lib/mockRoute";

// Check bcv.org.ve right now instead of waiting for the hourly check.
export const POST = route(async () => {
  await refreshFromBcv();
  return rateStatus();
});

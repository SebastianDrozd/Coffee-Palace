import { getRateStatus } from "@/lib/mockRates";
import { route } from "@/lib/mockRoute";

// Current dollar rate (Bs. per US$) plus where it came from and when it was last checked.
export const GET = route(() => getRateStatus());

import { listOrders, placeOrder } from "@/lib/mockDb";
import { readJson, route } from "@/lib/mockRoute";

// GET /api/orders?status=new,preparing,ready&date=2026-11-03
export const GET = route((req) => {
  const params = req.nextUrl.searchParams;
  const statuses = params.get("status")?.split(",").filter(Boolean);
  const date = params.get("date") || undefined;
  return listOrders({ statuses, date });
});

export const POST = route(async (req) => placeOrder(await readJson(req)));

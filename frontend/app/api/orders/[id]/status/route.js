import { setOrderStatus } from "@/lib/mockDb";
import { idParam, readJson, route } from "@/lib/mockRoute";

export const PATCH = route(async (req, ctx) => setOrderStatus(await idParam(ctx), await readJson(req)));

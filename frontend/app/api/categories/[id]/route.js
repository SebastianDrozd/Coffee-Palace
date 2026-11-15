import { editCategory, removeCategory } from "@/lib/mockDb";
import { idParam, readJson, route } from "@/lib/mockRoute";

export const PUT = route(async (req, ctx) => editCategory(await idParam(ctx), await readJson(req)));
export const DELETE = route(async (req, ctx) => {
  removeCategory(await idParam(ctx));
});

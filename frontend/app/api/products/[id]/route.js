import { editProduct, removeProduct } from "@/lib/mockDb";
import { idParam, readJson, route } from "@/lib/mockRoute";

export const PUT = route(async (req, ctx) => editProduct(await idParam(ctx), await readJson(req)));
export const DELETE = route(async (req, ctx) => {
  removeProduct(await idParam(ctx));
});

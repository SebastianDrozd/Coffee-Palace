import { addProduct, listProducts } from "@/lib/mockDb";
import { readJson, route } from "@/lib/mockRoute";

export const GET = route(() => listProducts());
export const POST = route(async (req) => addProduct(await readJson(req)));

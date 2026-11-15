import { addCategory, listCategories } from "@/lib/mockDb";
import { readJson, route } from "@/lib/mockRoute";

export const GET = route(() => listCategories());
export const POST = route(async (req) => addCategory(await readJson(req)));

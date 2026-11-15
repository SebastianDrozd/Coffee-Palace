import { reorderCategoryList } from "@/lib/mockDb";
import { readJson, route } from "@/lib/mockRoute";

export const PUT = route(async (req) => reorderCategoryList(await readJson(req)));

import { clearProductImage, setProductImage } from "@/lib/mockDb";
import { idParam, route } from "@/lib/mockRoute";

// multipart/form-data with the file in a field named "image"
export const POST = route(async (req, ctx) => {
  const id = await idParam(ctx);
  const form = await req.formData();
  return setProductImage(id, form.get("image"));
});

export const DELETE = route(async (req, ctx) => clearProductImage(await idParam(ctx)));

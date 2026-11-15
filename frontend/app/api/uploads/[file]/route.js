import { connection } from "next/server";
import { getImage } from "@/lib/mockDb";

export async function GET(req, { params }) {
  await connection();
  const { file } = await params;
  const image = getImage(file);
  if (!image) return new Response("No encontrado", { status: 404 });
  return new Response(image.buffer, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

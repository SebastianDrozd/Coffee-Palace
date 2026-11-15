// Shared helpers for the stand-in API route handlers (app/api/*).
import { connection } from "next/server";
import { HttpError } from "@/lib/mockDb";

// Wraps a handler: always runs at request time, turns HttpError into JSON errors.
export function route(handler) {
  return async (request, context) => {
    await connection();
    try {
      const result = await handler(request, context);
      if (result === undefined) return new Response(null, { status: 204 });
      return Response.json(result, { status: request.method === "POST" ? 201 : 200 });
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json({ error: err.message, ...err.extra }, { status: err.status });
      }
      console.error(err);
      return Response.json({ error: "Ocurrió un error en el servidor." }, { status: 500 });
    }
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "El cuerpo de la solicitud debe ser JSON.");
  }
}

export async function idParam(context) {
  const { id } = await context.params;
  const n = Number(id);
  if (!Number.isInteger(n)) throw new HttpError(400, "Id no válido.");
  return n;
}

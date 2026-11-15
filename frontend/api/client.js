// Base URL of the backend. While the Node/MySQL backend is being built,
// this defaults to the stand-in API inside this Next.js app (app/api/*).
// Point it at the real server in .env.local, e.g.
//   NEXT_PUBLIC_API_URL=http://192.168.1.50:4000/api
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest(path, { method = "GET", body, formData } = {}) {
  const init = { method, headers: {}, cache: "no-store" };

  if (formData) {
    init.body = formData;
  } else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError("No hay conexión con el servidor. Revisa la red e intenta de nuevo.", 0);
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error || `La solicitud falló (${res.status})`, res.status, data);
  }
  return data;
}

// The backend returns image paths relative to the API (e.g. "/uploads/latte.webp").
export function imageSrc(imageUrl) {
  if (!imageUrl) return null;
  if (/^(https?:|data:|blob:)/.test(imageUrl)) return imageUrl;
  return `${API_BASE}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

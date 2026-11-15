// Stand-in API: every /api/* request goes through one handler (see lib/mockApi.js).
import { handleApi } from "@/lib/mockApi";

export const GET = handleApi;
export const POST = handleApi;
export const PUT = handleApi;
export const PATCH = handleApi;
export const DELETE = handleApi;

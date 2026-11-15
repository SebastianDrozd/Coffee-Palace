import { apiRequest } from "@/lib/api/client";

export const ORDER_STATUSES = ["new", "preparing", "ready", "completed", "cancelled"];
export const ACTIVE_STATUSES = ["new", "preparing", "ready"];

export const orderKeys = {
  active: ["orders", "active"],
  history: (date) => ["orders", "history", date],
};

export const getActiveOrders = () =>
  apiRequest(`/orders?status=${ACTIVE_STATUSES.join(",")}`);

// date: YYYY-MM-DD (local)
export const getOrderHistory = (date) =>
  apiRequest(`/orders?status=completed,cancelled&date=${date}`);

// order: { customerName, note, items: [{ productId, quantity }] }
export const createOrder = (order) => apiRequest("/orders", { method: "POST", body: order });

export const updateOrderStatus = (id, status) =>
  apiRequest(`/orders/${id}/status`, { method: "PATCH", body: { status } });

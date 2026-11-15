import { apiRequest } from "@/lib/api/client";

export const categoryKeys = {
  all: ["categories"],
};

export const getCategories = () => apiRequest("/categories");

export const createCategory = (name) =>
  apiRequest("/categories", { method: "POST", body: { name } });

export const updateCategory = (id, data) =>
  apiRequest(`/categories/${id}`, { method: "PUT", body: data });

export const deleteCategory = (id) => apiRequest(`/categories/${id}`, { method: "DELETE" });

// ids: every category id, in the new display order
export const reorderCategories = (ids) =>
  apiRequest("/categories/reorder", { method: "PUT", body: { ids } });

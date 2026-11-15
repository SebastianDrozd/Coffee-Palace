import { apiRequest } from "@/lib/api/client";

export const productKeys = {
  all: ["products"],
};

export const getProducts = () => apiRequest("/products");

// data: { name, categoryId, price, description, isAvailable }
export const createProduct = (data) => apiRequest("/products", { method: "POST", body: data });

export const updateProduct = (id, data) =>
  apiRequest(`/products/${id}`, { method: "PUT", body: data });

export const deleteProduct = (id) => apiRequest(`/products/${id}`, { method: "DELETE" });

export const uploadProductImage = (id, file) => {
  const formData = new FormData();
  formData.append("image", file, file.name || "photo.webp");
  return apiRequest(`/products/${id}/image`, { method: "POST", formData });
};

export const deleteProductImage = (id) =>
  apiRequest(`/products/${id}/image`, { method: "DELETE" });

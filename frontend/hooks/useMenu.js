"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { categoryKeys, getCategories } from "@/lib/api/categories";
import { getProducts, productKeys } from "@/lib/api/products";
import { config } from "@/lib/config";

// The tablet menu: categories in display order, each with its available products.
// Categories without any available products are left out.
export function useMenu() {
  const categoriesQuery = useQuery({
    queryKey: categoryKeys.all,
    queryFn: getCategories,
    refetchInterval: config.menuRefreshMs,
  });
  const productsQuery = useQuery({
    queryKey: productKeys.all,
    queryFn: getProducts,
    refetchInterval: config.menuRefreshMs,
  });

  const menu = useMemo(() => {
    const categories = categoriesQuery.data ?? [];
    const products = productsQuery.data ?? [];
    return categories
      .map((c) => ({
        ...c,
        products: products.filter((p) => p.categoryId === c.id && p.isAvailable),
      }))
      .filter((c) => c.products.length > 0);
  }, [categoriesQuery.data, productsQuery.data]);

  const availableIds = useMemo(
    () => new Set((productsQuery.data ?? []).filter((p) => p.isAvailable).map((p) => p.id)),
    [productsQuery.data]
  );

  return {
    menu,
    availableIds,
    isLoading: categoriesQuery.isLoading || productsQuery.isLoading,
    isLoaded: categoriesQuery.isSuccess && productsQuery.isSuccess,
    error: categoriesQuery.error || productsQuery.error,
    refetch: () => {
      categoriesQuery.refetch();
      productsQuery.refetch();
    },
  };
}

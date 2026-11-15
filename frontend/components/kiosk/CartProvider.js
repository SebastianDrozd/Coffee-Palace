"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const MAX_QTY = 20;
const CartContext = createContext(null);

const emptyDetails = { customerName: "", note: "" };

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [details, setDetails] = useState(emptyDetails);
  const [lastOrder, setLastOrder] = useState(null);

  const add = useCallback((product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + 1) } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          priceUsd: product.priceUsd,
          imageUrl: product.imageUrl,
          quantity: 1,
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((productId, quantity) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) =>
            i.productId === productId ? { ...i, quantity: Math.min(MAX_QTY, quantity) } : i
          )
    );
  }, []);

  const remove = useCallback((productId) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setDetails(emptyDetails);
  }, []);

  const value = useMemo(
    () => ({
      items,
      details,
      setDetails,
      lastOrder,
      setLastOrder,
      add,
      setQuantity,
      remove,
      clear,
      maxQty: MAX_QTY,
    }),
    [items, details, lastOrder, add, setQuantity, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCart } from "@/components/kiosk/CartProvider";
import { categoryKeys, getCategories } from "@/lib/api/categories";
import { getProducts, productKeys } from "@/lib/api/products";
import { getExchangeRate, rateKeys } from "@/lib/api/exchangeRate";
import ui from "@/components/kiosk/kioskUi.module.css";
import styles from "./welcome.module.css";

export default function WelcomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { clear } = useCart();

  // Warm up the menu so it's ready the moment someone taps.
  useEffect(() => {
    queryClient.prefetchQuery({ queryKey: categoryKeys.all, queryFn: getCategories });
    queryClient.prefetchQuery({ queryKey: productKeys.all, queryFn: getProducts });
    queryClient.prefetchQuery({ queryKey: rateKeys.current, queryFn: getExchangeRate });
    router.prefetch("/order");
  }, [queryClient, router]);

  const start = () => {
    clear();
    router.push("/order");
  };

  return (
    <main className={styles.screen} onClick={start}>
      <div className={styles.beanA} aria-hidden="true" />
      <div className={styles.beanB} aria-hidden="true" />

      <div className={styles.saucer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="Coffee Palace" className={styles.logo} />
      </div>

      <div className={styles.cta}>
        <button
          type="button"
          className={`${ui.btn} ${ui.primary} ${ui.large} ${styles.start}`}
          onClick={(e) => {
            e.stopPropagation();
            start();
          }}
        >
          Empezar pedido
        </button>
        <p className={styles.hint}>Toca en cualquier lugar para empezar</p>
      </div>
    </main>
  );
}

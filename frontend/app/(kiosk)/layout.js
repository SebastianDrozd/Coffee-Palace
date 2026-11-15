import { CartProvider } from "@/components/kiosk/CartProvider";
import IdleGuard from "@/components/kiosk/IdleGuard";
import styles from "./kiosk.module.css";

// The customer-facing tablet screens: /, /order, /order/review, /order/done
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffb1e3",
};

export default function KioskLayout({ children }) {
  return (
    <CartProvider>
      <div className={styles.kiosk}>{children}</div>
      <IdleGuard />
    </CartProvider>
  );
}

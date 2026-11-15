"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getActiveOrders, orderKeys } from "@/lib/api/orders";
import { CupIcon, DollarIcon, ReceiptIcon, TabletIcon, TagIcon } from "@/components/ui/Icons";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { formatRate } from "@/lib/format";
import { useNow } from "@/hooks/useNow";
import { config } from "@/lib/config";
import styles from "./Sidebar.module.css";

const NAV = [
  { href: "/dashboard", label: "Pedidos", icon: ReceiptIcon },
  { href: "/dashboard/products", label: "Productos", icon: CupIcon },
  { href: "/dashboard/categories", label: "Categorías", icon: TagIcon },
  { href: "/dashboard/tasa", label: "Tasa del dólar", icon: DollarIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const now = useNow();
  const { data: orders } = useQuery({
    queryKey: orderKeys.active,
    queryFn: getActiveOrders,
    refetchInterval: config.ordersRefreshMs,
    refetchIntervalInBackground: true,
  });
  const newCount = orders?.filter((o) => o.status === "new").length ?? 0;
  const { info: rateInfo } = useExchangeRate();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <img src="/icon.png" alt="" className={styles.mark} />
        <div>
          <div className={styles.name}>Coffee Palace</div>
          <div className={styles.tag}>Panel del personal</div>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Panel">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.link} ${active ? styles.active : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon />
              <span>{label}</span>
              {href === "/dashboard" && newCount > 0 && (
                <span className={styles.badge} aria-label={`${newCount} ${newCount === 1 ? "nuevo" : "nuevos"}`}>
                  {newCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={styles.foot}>
        <Link href="/dashboard/tasa" className={styles.rate}>
          <span className={styles.rateLabel}>
            {rateInfo?.source === "manual" ? "Tasa manual" : "Tasa BCV"}
            {rateInfo?.lastError && rateInfo?.source !== "manual" && (
              <span className={styles.rateWarn} title={rateInfo.lastError}>
                {" "}
                sin actualizar
              </span>
            )}
          </span>
          <span className={styles.rateValue}>
            {rateInfo?.rate ? `Bs. ${formatRate(rateInfo.rate)}` : "Sin tasa"}
          </span>
        </Link>
        <div className={styles.clock} aria-hidden={now === null}>
          {now !== null &&
            new Date(now).toLocaleTimeString(config.locale, { hour: "numeric", minute: "2-digit" })}
        </div>
        <a href="/" target="_blank" rel="noreferrer" className={styles.footLink}>
          <TabletIcon />
          Abrir pantalla de pedidos
        </a>
      </div>
    </aside>
  );
}

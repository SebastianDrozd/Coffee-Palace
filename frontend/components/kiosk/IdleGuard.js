"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useCart } from "@/components/kiosk/CartProvider";
import { config } from "@/lib/config";
import { plural } from "@/lib/format";
import ui from "./kioskUi.module.css";

const WATCHED_PATHS = ["/order", "/order/review"];
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchmove"];

// Sends the tablet back to the start screen when someone walks away mid-order.
export default function IdleGuard() {
  const pathname = usePathname().replace(/(.)\/$/, "$1"); // "/order/" and "/order" are the same page
  const router = useRouter();
  const { clear } = useCart();
  const enabled = WATCHED_PATHS.includes(pathname);

  const lastActivity = useRef(0);
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!enabled) return;

    lastActivity.current = Date.now();
    const onActivity = () => {
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const idleMs = config.kioskIdleSeconds * 1000;
    const warnMs = config.kioskIdleWarningSeconds * 1000;

    const timer = setInterval(() => {
      const idleFor = Date.now() - lastActivity.current;
      if (idleFor < idleMs) {
        setSecondsLeft(null);
      } else if (idleFor < idleMs + warnMs) {
        setSecondsLeft(Math.ceil((idleMs + warnMs - idleFor) / 1000));
      } else {
        clearInterval(timer);
        setSecondsLeft(null);
        clear();
        router.replace("/");
      }
    }, 500);

    return () => {
      clearInterval(timer);
      setSecondsLeft(null);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [enabled, clear, router]);

  const keepGoing = () => {
    lastActivity.current = Date.now();
    setSecondsLeft(null);
  };

  const startOver = () => {
    clear();
    router.replace("/");
  };

  return (
    <Modal
      open={secondsLeft !== null}
      onClose={keepGoing}
      variant="kiosk"
      size="sm"
      title="¿Sigues ahí?"
      footer={
        <>
          <button className={`${ui.btn} ${ui.soft}`} onClick={startOver}>
            Empezar de nuevo
          </button>
          <button className={`${ui.btn} ${ui.primary}`} onClick={keepGoing}>
            Seguir pidiendo
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>
        Tu pedido se borrará en {secondsLeft !== null && plural(secondsLeft, "segundo", "segundos")}.
      </p>
    </Modal>
  );
}

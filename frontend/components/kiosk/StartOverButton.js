"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useCart } from "@/components/kiosk/CartProvider";
import ui from "./kioskUi.module.css";

export default function StartOverButton() {
  const router = useRouter();
  const { items, clear } = useCart();
  const [confirming, setConfirming] = useState(false);

  const startOver = () => {
    clear();
    router.replace("/");
  };

  return (
    <>
      <button
        type="button"
        className={`${ui.btn} ${ui.soft} ${ui.small}`}
        onClick={() => (items.length ? setConfirming(true) : startOver())}
      >
        Empezar de nuevo
      </button>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        variant="kiosk"
        size="sm"
        title="¿Empezar de nuevo?"
        footer={
          <>
            <button className={`${ui.btn} ${ui.soft}`} onClick={() => setConfirming(false)}>
              Seguir con mi pedido
            </button>
            <button className={`${ui.btn} ${ui.primary}`} onClick={startOver}>
              Borrar pedido
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>Se borrará todo lo que agregaste.</p>
      </Modal>
    </>
  );
}

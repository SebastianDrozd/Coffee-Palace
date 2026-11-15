"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clearManualRate, rateKeys, refreshExchangeRate, setManualRate } from "@/lib/api/exchangeRate";
import { RefreshIcon } from "@/components/ui/Icons";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useNow } from "@/hooks/useNow";
import { config } from "@/lib/config";
import { clockTime, formatBs, formatRate, formatUsd, longDate, minutesSince, parsePrice, toBs } from "@/lib/format";
import ui from "@/components/dashboard/dash.module.css";
import styles from "./tasa.module.css";

const EXAMPLES = [1, 4.75, 10];

function ago(iso, now) {
  if (!iso || now === null) return "";
  const m = minutesSince(iso, now);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `hace ${h} h` : `el ${new Date(iso).toLocaleDateString(config.locale)}`;
}

export default function RatePage() {
  const queryClient = useQueryClient();
  const now = useNow();
  const { info, query } = useExchangeRate();
  const [manualText, setManualText] = useState("");
  const [manualError, setManualError] = useState("");

  const store = (data) => {
    queryClient.setQueryData(rateKeys.current, data);
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const refresh = useMutation({ mutationFn: refreshExchangeRate, onSuccess: store });
  const applyManual = useMutation({
    mutationFn: (rate) => setManualRate(rate),
    onSuccess: (data) => {
      store(data);
      setManualText("");
    },
  });
  const backToBcv = useMutation({ mutationFn: clearManualRate, onSuccess: store });

  const submitManual = (e) => {
    e.preventDefault();
    const rate = parsePrice(manualText);
    if (!rate || Number.isNaN(rate)) {
      setManualError("Escribe la tasa en bolívares por dólar, por ejemplo 891,1054.");
      return;
    }
    setManualError("");
    applyManual.mutate(rate);
  };

  const manual = info?.source === "manual";
  const actionError = refresh.error || applyManual.error || backToBcv.error;

  return (
    <>
      <div className={ui.pageHead}>
        <div>
          <h1 className={ui.pageTitle}>Tasa del dólar</h1>
          <p className={ui.pageSub}>
            Los precios se guardan en dólares. Los bolívares se calculan con esta tasa.
          </p>
        </div>
        <div className={ui.headActions}>
          <button
            type="button"
            className={`${ui.btn} ${ui.secondary}`}
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending || manual}
            title={manual ? "Vuelve a la tasa del BCV para actualizarla" : undefined}
          >
            <RefreshIcon />
            {refresh.isPending ? "Consultando el BCV…" : "Actualizar ahora"}
          </button>
        </div>
      </div>

      {query.isLoading && <div className={styles.skeleton} />}

      {query.isError && (
        <div className={`${ui.card} ${ui.empty}`}>
          <strong>No se pudo cargar la tasa</strong>
          {query.error.message}
        </div>
      )}

      {info && (
        <div className={styles.layout}>
          <section className={`${ui.card} ${styles.current}`} aria-labelledby="rate-title">
            <h2 id="rate-title" className={styles.kicker}>
              {manual ? "Tasa manual" : "Tasa oficial BCV"}
            </h2>

            {info.rate ? (
              <>
                <p className={styles.value}>
                  <span className={styles.bs}>{config.bsSymbol}</span> {formatRate(info.rate)}
                </p>
                <p className={styles.per}>por cada dólar</p>

                <dl className={styles.meta}>
                  {manual ? (
                    <div>
                      <dt>Desde</dt>
                      <dd>
                        {clockTime(info.updatedAt)} ({ago(info.updatedAt, now)})
                      </dd>
                    </div>
                  ) : (
                    <div>
                      <dt>Fecha valor</dt>
                      <dd className={styles.capitalize}>{longDate(info.valueDate)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Última revisión del BCV</dt>
                    <dd>
                      {info.lastCheckAt
                        ? `${clockTime(info.lastCheckAt)} (${ago(info.lastCheckAt, now)})`
                        : "Todavía no"}
                    </dd>
                  </div>
                  <div>
                    <dt>Revisión automática</dt>
                    <dd>{manual ? "En pausa mientras uses una tasa manual" : `Cada ${info.checkEveryMinutes} minutos`}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className={styles.noRate}>
                Todavía no hay una tasa. La tablet muestra solo precios en dólares hasta que se lea la
                página del BCV o pongas una tasa manual.
              </p>
            )}

            {info.upcoming && !manual && (
              <p className={styles.upcoming}>
                El BCV ya publicó la tasa del <span className={styles.lower}>{longDate(info.upcoming.valueDate)}</span>:{" "}
                <strong>
                  {config.bsSymbol} {formatRate(info.upcoming.rate)}
                </strong>
                . Se usará automáticamente ese día.
              </p>
            )}

            {info.lastError && !manual && (
              <p className={ui.alert} role="alert">
                {info.lastError}{" "}
                {info.rate
                  ? "Se sigue usando la última tasa conocida y se intentará de nuevo en unos minutos."
                  : "Se intentará de nuevo en unos minutos."}
              </p>
            )}
            {actionError && (
              <p className={ui.alert} role="alert">
                {actionError.message}
              </p>
            )}
          </section>

          <div className={styles.side}>
            {info.rate && (
              <section className={`${ui.card} ${styles.examples}`} aria-labelledby="examples-title">
                <h2 id="examples-title" className={styles.cardTitle}>
                  Así se ve en la tablet
                </h2>
                <ul>
                  {EXAMPLES.map((usd) => (
                    <li key={usd}>
                      <span>{formatUsd(usd)}</span>
                      <span>{formatBs(toBs(usd, info.rate))}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={`${ui.card} ${styles.manual}`} aria-labelledby="manual-title">
              <h2 id="manual-title" className={styles.cardTitle}>
                {manual ? "Estás usando una tasa manual" : "Usar una tasa manual"}
              </h2>
              {manual ? (
                <>
                  <p className={styles.help}>
                    {info.bcvRate
                      ? `La tasa del BCV para hoy es ${config.bsSymbol} ${formatRate(info.bcvRate.rate)}.`
                      : "Al volver, se consultará la página del BCV en ese momento."}
                  </p>
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.primary}`}
                    onClick={() => backToBcv.mutate()}
                    disabled={backToBcv.isPending}
                  >
                    Volver a la tasa del BCV
                  </button>
                </>
              ) : (
                <form onSubmit={submitManual} className={styles.manualForm} noValidate>
                  <p className={styles.help}>
                    Para cuando la página del BCV no responde. La revisión automática se pausa hasta que
                    vuelvas a la tasa del BCV.
                  </p>
                  <label className={ui.field}>
                    <span className={ui.label}>Bolívares por dólar</span>
                    <span className={styles.inputWrap}>
                      <span className={styles.prefix}>{config.bsSymbol}</span>
                      <input
                        className={`${ui.input} ${styles.manualInput} ${manualError ? ui.inputError : ""}`}
                        value={manualText}
                        onChange={(e) => setManualText(e.target.value)}
                        inputMode="decimal"
                        placeholder={info.rate ? formatRate(info.rate) : "0,0000"}
                      />
                    </span>
                    {manualError && <span className={ui.errorText}>{manualError}</span>}
                  </label>
                  <button
                    type="submit"
                    className={`${ui.btn} ${ui.primary}`}
                    disabled={!manualText.trim() || applyManual.isPending}
                  >
                    Usar esta tasa
                  </button>
                </form>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}

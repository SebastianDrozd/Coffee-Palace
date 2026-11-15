import { config } from "@/lib/config";
import { formatRate } from "@/lib/format";

// "Tasa BCV: Bs. 891,1054 por dólar" under order totals on the tablet
export default function RateNote({ info, className }) {
  if (!info?.rate) return null;
  const label = info.source === "manual" ? "Tasa del día" : "Tasa BCV";
  return (
    <p className={className}>
      {label}: {config.bsSymbol} {formatRate(info.rate)} por dólar
    </p>
  );
}

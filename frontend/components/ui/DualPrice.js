import { config } from "@/lib/config";
import { formatBs, formatUsd, toBs } from "@/lib/format";

/**
 * A dollar price with its bolívar equivalent.
 *   usd: the dollar amount. bs: the bolívar amount, if already known (e.g. saved on an order);
 *   otherwise it's calculated from `rate`. Without a rate only dollars are shown.
 */
export default function DualPrice({ usd, bs, rate, className, mainClassName, subClassName }) {
  const bolivars = bs ?? toBs(usd, rate);
  const usdText = formatUsd(usd);
  const bsText = bolivars !== null && bolivars !== undefined ? formatBs(bolivars) : null;
  const [main, sub] = config.primaryCurrency === "VES" && bsText ? [bsText, usdText] : [usdText, bsText];

  return (
    <span className={className}>
      <span className={mainClassName}>{main}</span>
      {sub && <span className={subClassName}>{sub}</span>}
    </span>
  );
}

// Plain-text version for screen-reader labels: "$4,75 (Bs. 4.232,75)"
export function dualPriceText(usd, rate) {
  const bs = toBs(usd, rate);
  return bs !== null ? `${formatUsd(usd)} (${formatBs(bs)})` : formatUsd(usd);
}

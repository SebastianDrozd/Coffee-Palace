"use client";

import { useQuery } from "@tanstack/react-query";
import { getExchangeRate, rateKeys } from "@/lib/api/exchangeRate";
import { config } from "@/lib/config";

// Current Bs. per US$ rate. `rate` is null until one is known; screens then show dollars only.
export function useExchangeRate() {
  const query = useQuery({
    queryKey: rateKeys.current,
    queryFn: getExchangeRate,
    refetchInterval: config.rateRefreshMs,
    refetchIntervalInBackground: true,
    staleTime: 60_000,
  });
  return {
    rate: query.data?.rate ?? null,
    info: query.data ?? null,
    query,
  };
}

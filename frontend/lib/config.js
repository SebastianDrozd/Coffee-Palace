// App-wide settings. Change these in one place.
export const config = {
  shopName: "Coffee Palace",

  // Prices show on the tablet and dashboard whenever a product has one.
  // Set to false if drinks are free (e.g. a staff coffee bar).
  showPrices: true,

  // Prices are saved in US dollars. Bolívares are calculated with the BCV rate
  // (checked on the server every hour). "USD" shows dollars first, "VES" bolívares first.
  primaryCurrency: "USD",
  locale: "es-VE",
  usdSymbol: "$",
  bsSymbol: "Bs.",
  priceDecimals: 2,
  rateDecimals: 4,
  // How often each screen asks the server for the current rate.
  rateRefreshMs: 5 * 60_000,

  // Tablet: after this many seconds without a tap, ask "¿Sigues ahí?"
  kioskIdleSeconds: 90,
  // ...then reset to the start screen after this many more seconds.
  kioskIdleWarningSeconds: 20,
  // How long the "order placed" screen stays up before going back to the start.
  doneScreenSeconds: 15,

  // How often each screen checks the server for changes.
  menuRefreshMs: 60_000,
  ordersRefreshMs: 5_000,

  // Dashboard: orders waiting longer than this get highlighted.
  slowOrderMinutes: 8,

  // Product photos are resized in the browser before upload.
  maxPhotoUploadMb: 8,
  photoMaxSidePx: 1000,
};

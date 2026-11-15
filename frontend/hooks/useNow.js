"use client";

import { useSyncExternalStore } from "react";

// One shared 1-second clock for the whole page.
// Returns null during server rendering, so time is only ever read in the browser.
const listeners = new Set();
let now = 0;
let timer = null;

function tick() {
  now = Date.now();
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  if (!timer) timer = setInterval(tick, 1000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => {
  if (!now) now = Date.now();
  return now;
};
const getServerSnapshot = () => null;

export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

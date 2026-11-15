"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const KEY = "cp:dashboard-sound";
const listeners = new Set();

function read() {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

function write(on) {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* storage unavailable — keep the in-memory choice */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// A soft two-note chime for new orders, made with Web Audio (no sound files).
export function useChime() {
  const enabled = useSyncExternalStore(subscribe, read, () => false);
  const ctxRef = useRef(null);

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctxRef.current = new Ctx();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  // Browsers block audio until the page gets a click. After a reload, the first
  // click anywhere on the dashboard unlocks the chime again.
  useEffect(() => {
    const unlock = () => {
      if (read()) ensureContext();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [ensureContext]);

  const play = useCallback(() => {
    if (!read()) return;
    const ctx = ensureContext();
    if (!ctx) return;
    const start = ctx.currentTime + 0.02;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = start + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  }, [ensureContext]);

  const toggle = useCallback(() => {
    const next = !read();
    write(next);
    if (next) {
      // Browsers only allow audio after a click, so unlock it now and play a preview.
      ensureContext();
      setTimeout(play, 0);
    }
  }, [ensureContext, play]);

  return { enabled, toggle, play };
}

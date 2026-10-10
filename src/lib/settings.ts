import { useSyncExternalStore } from "react";

export type EtfProvider = "coinglass" | "sosovalue";
export type Settings = {
  etfProvider: EtfProvider;
  alertsOn: boolean;
  alertBuy: boolean;
  alertSell: boolean;
  alertMinBtc: number;
  alertSound: boolean;
  alertNotify: boolean;
  wallMinBtc: number;
};

export const DEFAULT_SETTINGS: Settings = {
  etfProvider: "coinglass",
  alertsOn: true,
  alertBuy: true,
  alertSell: true,
  alertMinBtc: 10,
  alertSound: true,
  alertNotify: false,
  wallMinBtc: 25,
};

const KEY = "fz-settings";
let state = DEFAULT_SETTINGS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
}

export function getSettings() {
  load();
  return state;
}

export function setSettings(patch: Partial<Settings>) {
  state = { ...getSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSettings() {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS);
}

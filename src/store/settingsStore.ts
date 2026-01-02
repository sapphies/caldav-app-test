import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type AccentColor = string;
export type StartOfWeek = 'sunday' | 'monday';

export interface KeyboardShortcut {
  id: string;
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
}

export const defaultShortcuts: KeyboardShortcut[] = [
  { id: 'new-task', key: 'n', meta: true, description: 'Create new task' },
  { id: 'search', key: 'f', meta: true, description: 'Focus search' },
  { id: 'settings', key: ',', meta: true, description: 'Open settings' },
  { id: 'sync', key: 'r', meta: true, description: 'Sync with server' },
  { id: 'delete', key: 'Backspace', meta: true, description: 'Delete selected task' },
  { id: 'toggle-complete', key: 'Enter', description: 'Toggle task completion' },
  { id: 'close', key: 'Escape', description: 'Close editor / Clear search' },
  { id: 'nav-up', key: 'ArrowUp', description: 'Navigate to previous task' },
  { id: 'nav-down', key: 'ArrowDown', description: 'Navigate to next task' },
  { id: 'nav-up-vim', key: 'k', description: 'Navigate to previous task (vim)' },
  { id: 'nav-down-vim', key: 'j', description: 'Navigate to next task (vim)' },
];

interface SettingsStore {
  theme: Theme;
  accentColor: AccentColor;
  autoSync: boolean;
  syncInterval: number; // minutes
  syncOnStartup: boolean;
  showCompletedByDefault: boolean;
  confirmBeforeDelete: boolean;
  startOfWeek: StartOfWeek;
  notifications: boolean;
  notifyBefore: number; // minutes before due date

  // actions
  setTheme: (theme: Theme) => void;
  setAccentColor: (color: AccentColor) => void;
  setAutoSync: (enabled: boolean) => void;
  setSyncInterval: (interval: number) => void;
  setSyncOnStartup: (enabled: boolean) => void;
  setShowCompletedByDefault: (show: boolean) => void;
  setConfirmBeforeDelete: (confirm: boolean) => void;
  setStartOfWeek: (day: StartOfWeek) => void;
  setNotifications: (enabled: boolean) => void;
  setNotifyBefore: (minutes: number) => void;
  exportSettings: () => string;
  importSettings: (json: string) => boolean;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      accentColor: '#3b82f6',
      autoSync: true,
      syncInterval: 5,
      syncOnStartup: true,
      showCompletedByDefault: true,
      confirmBeforeDelete: true,
      startOfWeek: 'sunday',
      notifications: true,
      notifyBefore: 15,

      setTheme: (theme) => set({ theme }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setAutoSync: (autoSync) => set({ autoSync }),
      setSyncInterval: (syncInterval) => set({ syncInterval }),
      setSyncOnStartup: (syncOnStartup) => set({ syncOnStartup }),
      setShowCompletedByDefault: (showCompletedByDefault) => set({ showCompletedByDefault }),
      setConfirmBeforeDelete: (confirmBeforeDelete) => set({ confirmBeforeDelete }),
      setStartOfWeek: (startOfWeek) => set({ startOfWeek }),
      setNotifications: (notifications) => set({ notifications }),
      setNotifyBefore: (notifyBefore) => set({ notifyBefore }),
      
      exportSettings: () => {
        const state = get();
        const exportData = {
          version: 1,
          theme: state.theme,
          accentColor: state.accentColor,
          autoSync: state.autoSync,
          syncInterval: state.syncInterval,
          syncOnStartup: state.syncOnStartup,
          showCompletedByDefault: state.showCompletedByDefault,
          confirmBeforeDelete: state.confirmBeforeDelete,
          startOfWeek: state.startOfWeek,
          notifications: state.notifications,
          notifyBefore: state.notifyBefore,
        };
        return JSON.stringify(exportData, null, 2);
      },
      
      importSettings: (json: string) => {
        try {
          const data = JSON.parse(json);
          if (data.version !== 1) {
            console.error('Unsupported settings version');
            return false;
          }
          set({
            theme: data.theme ?? 'system',
            accentColor: data.accentColor ?? '#3b82f6',
            autoSync: data.autoSync ?? true,
            syncInterval: data.syncInterval ?? 5,
            syncOnStartup: data.syncOnStartup ?? true,
            showCompletedByDefault: data.showCompletedByDefault ?? true,
            confirmBeforeDelete: data.confirmBeforeDelete ?? true,
            startOfWeek: data.startOfWeek ?? 'sunday',
            notifications: data.notifications ?? true,
            notifyBefore: data.notifyBefore ?? 15,
          });
          return true;
        } catch (e) {
          console.error('Failed to import settings:', e);
          return false;
        }
      },
    }),
    {
      name: 'caldav-tasks-settings',
    }
  )
);

/**
 * apply the theme to the document
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

/**
 * apply accent color as CSS custom properties
 * generates a palette of shades from the base accent color
 */
export function applyAccentColor(color: string): void {
  const root = document.documentElement;
  
  // parse hex color to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // convert to HSL for easier shade generation
  const [h, s] = rgbToHsl(r, g, b);

  // generate shades (50-950)
  const shades = [
    { name: '50', l: 97 },
    { name: '100', l: 94 },
    { name: '200', l: 86 },
    { name: '300', l: 74 },
    { name: '400', l: 60 },
    { name: '500', l: 50 },
    { name: '600', l: 42 },
    { name: '700', l: 35 },
    { name: '800', l: 26 },
    { name: '900', l: 18 },
    { name: '950', l: 10 },
  ];

  shades.forEach(({ name, l: lightness }) => {
    const [sr, sg, sb] = hslToRgb(h, s, lightness);
    root.style.setProperty(`--color-primary-${name}`, `${sr} ${sg} ${sb}`);
  });

  // also set the base accent color
  root.style.setProperty('--accent-color', color);
}

/**
 * convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s * 100, l * 100];
}

/**
 * convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

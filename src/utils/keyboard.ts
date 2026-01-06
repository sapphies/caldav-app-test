import { isMacPlatform } from "./misc";

export function getMetaKeyLabel(): string {
  return isMacPlatform() ? '⌘' : 'Ctrl';
}

export function getAltKeyLabel(): string {
  return isMacPlatform() ? '⌥' : 'Alt';
}

export function getShiftKeyLabel(): string {
  return isMacPlatform() ? '⇧' : 'Shift';
}

export function getModifierJoiner(): string {
  return isMacPlatform() ? '' : '+';
}

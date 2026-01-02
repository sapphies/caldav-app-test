export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

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

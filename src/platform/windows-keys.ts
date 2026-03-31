/**
 * Mapping from xdotool key names to Windows Virtual Key (VK) codes.
 * Reference: https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
 */
const VK_MAP: Record<string, number> = {
  // Modifiers
  ctrl: 0x11,
  Control_L: 0x11,
  Control_R: 0x11,
  alt: 0x12,
  Alt_L: 0x12,
  Alt_R: 0x12,
  shift: 0x10,
  Shift_L: 0x10,
  Shift_R: 0x10,
  super: 0x5b,
  Super_L: 0x5b,
  Super_R: 0x5c,

  // Navigation
  Return: 0x0d,
  Tab: 0x09,
  Escape: 0x1b,
  BackSpace: 0x08,
  Delete: 0x2e,
  Home: 0x24,
  End: 0x23,
  Page_Up: 0x21,
  Page_Down: 0x22,
  Insert: 0x2d,

  // Arrows
  Up: 0x26,
  Down: 0x28,
  Left: 0x25,
  Right: 0x27,

  // Misc
  space: 0x20,
  Print: 0x2c,
  Scroll_Lock: 0x91,
  Pause: 0x13,
  Caps_Lock: 0x14,
  Num_Lock: 0x90,
  Menu: 0x5d,

  // Function keys
  F1: 0x70,
  F2: 0x71,
  F3: 0x72,
  F4: 0x73,
  F5: 0x74,
  F6: 0x75,
  F7: 0x76,
  F8: 0x77,
  F9: 0x78,
  F10: 0x79,
  F11: 0x7a,
  F12: 0x7b,
};

export function resolveVkCode(keyName: string): number {
  const mapped = VK_MAP[keyName];
  if (mapped !== undefined) return mapped;

  // Single character: use its uppercase char code (A-Z, 0-9 map directly to VK codes)
  if (keyName.length === 1) {
    return keyName.toUpperCase().charCodeAt(0);
  }

  throw new Error(`Unknown key name: "${keyName}". Use xdotool-compatible key names.`);
}

export function parseKeyCombination(keys: string): number[] {
  return keys.split('+').map((k) => resolveVkCode(k.trim()));
}

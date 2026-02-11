/**
 * Safe-area insets for mobile browsers (iOS notch / Android gesture bar).
 *
 * index.html defines CSS variables:
 *   --sat / --sab / --sal / --sar
 * based on env(safe-area-inset-*).
 */
export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

let cached: SafeAreaInsets | null = null;

function readPxVar(varName: string): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!v) return 0;
  const n = parseFloat(v.replace('px', ''));
  return Number.isFinite(n) ? n : 0;
}

export function getSafeAreaInsets(): SafeAreaInsets {
  if (cached) return cached;
  if (typeof document === 'undefined') {
    cached = { top: 0, bottom: 0, left: 0, right: 0 };
    return cached;
  }

  // Prefer our normalized vars; fall back to any legacy vars if present.
  const top = readPxVar('--sat') || readPxVar('--safe-area-inset-top');
  const bottom = readPxVar('--sab') || readPxVar('--safe-area-inset-bottom');
  const left = readPxVar('--sal') || readPxVar('--safe-area-inset-left');
  const right = readPxVar('--sar') || readPxVar('--safe-area-inset-right');

  cached = { top, bottom, left, right };
  return cached;
}

export function resetSafeAreaCache(): void {
  cached = null;
}

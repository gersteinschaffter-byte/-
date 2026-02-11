/**
 * Best-effort clipboard copy for mobile/desktop.
 * Falls back to a prompt if Clipboard API is unavailable.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const t = String(text ?? '');
  if (!t) return false;

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    // fall through
  }

  try {
    // Fallback for older WebViews
    const el = document.createElement('textarea');
    el.value = t;
    el.setAttribute('readonly', 'true');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return !!ok;
  } catch {
    // final fallback: let user manually copy
    try {
      window.prompt('复制下面内容（长按全选复制）', t);
      return true;
    } catch {
      return false;
    }
  }
}

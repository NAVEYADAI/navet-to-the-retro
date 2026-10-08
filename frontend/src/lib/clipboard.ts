/**
 * Copy text to the clipboard on web. `navigator.clipboard` only exists in secure contexts (HTTPS /
 * localhost), so on plain-HTTP deployments or older browsers it is undefined and the call used to
 * fail silently (BUG-58). Falls back to a hidden textarea + `document.execCommand('copy')`.
 * Resolves to whether the copy actually succeeded, so callers can surface a failure.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path (permission denied, insecure context, etc.)
  }

  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const textarea = document.createElement('textarea');
  try {
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    if (textarea.parentNode) textarea.parentNode.removeChild(textarea);
  }
}

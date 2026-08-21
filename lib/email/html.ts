export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function textToSafeHtml(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br/>")
}

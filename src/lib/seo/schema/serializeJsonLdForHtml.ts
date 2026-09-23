/**
 * Serialize JSON-LD for embedding inside an HTML <script> element.
 *
 * JSON.stringify() alone is not sufficient here: HTML parsers terminate a
 * script element on a literal </script> sequence even when type=application/ld+json.
 * Escaping HTML-significant characters keeps the JSON semantically identical
 * after JSON parsing while preventing script-tag breakout.
 */
export function serializeJsonLdForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Where the NestJS API lives.
 *
 * Next inlines this at build time, which only works for a literal
 * `process.env.NEXT_PUBLIC_…` lookup — a destructured or dynamically-keyed read
 * is left untouched and arrives as undefined. The fallback means the app works
 * with no configuration at all in local dev.
 *
 * Because the value is baked in at `next build` (and this app builds with
 * `output: "standalone"`), a production image cannot be re-pointed at runtime —
 * it has to become a Docker build arg, or the app has to proxy through a
 * Next rewrite instead of calling the API's origin directly.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001";

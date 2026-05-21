/**
 * Restrict post-login redirects to same-origin relative paths (open-redirect hardening).
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  fallback = "/"
): string {
  if (!raw) return fallback;

  const path = raw.trim();
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("://") ||
    path.includes("\\") ||
    path.includes("\0")
  ) {
    return fallback;
  }

  return path;
}

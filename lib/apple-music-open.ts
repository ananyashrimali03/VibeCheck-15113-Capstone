/**
 * Map catalog HTTPS links to native URL schemes so the OS opens the Apple Music / iTunes app
 * on the same resource — usually starts playback in-app with one gesture (vs web + second play).
 * Unknown URLs are returned unchanged.
 */
export function appleMusicDeepLink(webUrl: string): string {
  try {
    const u = new URL(webUrl);
    const host = u.hostname.toLowerCase();
    if (host === "music.apple.com" || host.endsWith(".music.apple.com")) {
      return `music://${u.host}${u.pathname}${u.search}`;
    }
    if (
      host.includes("itunes.apple.com") ||
      host.includes("geo.itunes.apple.com") ||
      host.includes("podcasts.apple.com")
    ) {
      return `itms://${u.host}${u.pathname}${u.search}`;
    }
  } catch {
    /* ignore */
  }
  return webUrl;
}

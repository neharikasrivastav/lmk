// Share links must open without a Lovable login: preview and editor hosts
// (lovableproject.com, id-preview--*.lovable.app, localhost, …) sit behind the
// editor's auth wall, while the published app is public. Build links from the
// current site's origin, and fall back to the published domain whenever the
// current host is a preview, editor, or local dev host.
const PUBLISHED_ORIGIN = "https://safter-city-steps.lovable.app";

const PREVIEW_HOST =
  /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+\.(?:lovable\.app|gpt-eng\.com|gptengineer\.run)$/;
const EDITOR_HOST =
  /(?:^|\.)lovableproject(?:-dev)?\.com$|(?:^|\.)gpt-eng\.com$|(?:^|\.)gptengineer\.run$|^project--.+-dev\.lovable\.app$/;

export function isPreviewHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return true;
  return PREVIEW_HOST.test(host) || EDITOR_HOST.test(host);
}

function currentOrigin(): string {
  if (typeof window === "undefined") return PUBLISHED_ORIGIN;
  return isPreviewHost(window.location.hostname) ? PUBLISHED_ORIGIN : window.location.origin;
}

export function shareLink(token: string, origin?: string): string {
  const base = origin ?? currentOrigin();
  return `${base}/t/${token}`;
}

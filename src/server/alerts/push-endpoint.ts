const EXACT_PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
]);

const PUSH_HOST_SUFFIXES = [
  ".push.apple.com",
  ".notify.windows.com",
];

export function isAllowedPushEndpoint(value: string): boolean {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    return false;
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    (endpoint.port && endpoint.port !== "443")
  ) {
    return false;
  }

  const host = endpoint.hostname.toLowerCase();
  return (
    EXACT_PUSH_HOSTS.has(host) ||
    PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

export async function fingerprintWorker(
  registration: ServiceWorkerRegistration
): Promise<string> {
  const scriptUrl =
    registration.active?.scriptURL ??
    registration.waiting?.scriptURL ??
    registration.installing?.scriptURL;
  if (!scriptUrl) {
    throw new Error("The service worker is not active.");
  }

  const response = await fetch(scriptUrl, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error("The service worker version could not be checked.");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await response.arrayBuffer()
  );
  return Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export async function fingerprintWorker(
  registration: ServiceWorkerRegistration,
  fetchWorker: typeof fetch = fetch
): Promise<string> {
  const scriptUrl =
    registration.active?.scriptURL ??
    registration.waiting?.scriptURL ??
    registration.installing?.scriptURL;
  if (!scriptUrl) {
    throw new Error("The service worker is not active.");
  }

  const response = await fetchWorker(scriptUrl, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error("The service worker version could not be checked.");
  }

  const source = await response.text();
  const alertWorker = source.match(
    /importScripts\(["']((?:\.\/|\/)?worker-[A-Za-z0-9_-]+\.js)["']\)/
  )?.[1];
  if (!alertWorker) {
    throw new Error("The alert worker version could not be checked.");
  }

  const alertWorkerResponse = await fetchWorker(
    new URL(alertWorker, scriptUrl),
    {
      cache: "no-store",
      credentials: "same-origin",
    }
  );
  if (!alertWorkerResponse.ok) {
    throw new Error("The alert worker version could not be checked.");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await alertWorkerResponse.arrayBuffer()
  );
  return Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

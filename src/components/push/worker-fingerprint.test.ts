import { describe, expect, it, vi } from "vitest";

import { fingerprintWorker } from "./worker-fingerprint";

describe("fingerprintWorker", () => {
  it("keeps the alert worker version across precache-only changes", async () => {
    const registration = {
      active: { scriptURL: "https://example.com/sw.js" },
    } as ServiceWorkerRegistration;

    const first = await fingerprintWorker(
      registration,
      createWorkerFetch(
        'importScripts("worker-firstName.js");precacheAndRoute(["app-a.js"])',
        "same alert worker"
      )
    );
    const second = await fingerprintWorker(
      registration,
      createWorkerFetch(
        'importScripts("worker-secondName.js");precacheAndRoute(["app-b.js"])',
        "same alert worker"
      )
    );

    expect(second).toBe(first);
  });

  it("changes the version when the alert worker bundle changes", async () => {
    const registration = {
      active: { scriptURL: "https://example.com/sw.js" },
    } as ServiceWorkerRegistration;

    const first = await fingerprintWorker(
      registration,
      createWorkerFetch(
        'importScripts("worker-firstName.js")',
        "first alert worker"
      )
    );
    const second = await fingerprintWorker(
      registration,
      createWorkerFetch(
        'importScripts("worker-secondName.js")',
        "second alert worker"
      )
    );

    expect(second).not.toBe(first);
  });

  it("preserves a root-relative alert worker URL", async () => {
    const registration = {
      active: { scriptURL: "https://example.com/nested/sw.js" },
    } as ServiceWorkerRegistration;
    const fetchWorker = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/sw.js")) {
        return new Response('importScripts("/worker-rootHash.js")');
      }
      return new Response("alert worker", {
        status: url === "https://example.com/worker-rootHash.js" ? 200 : 404,
      });
    }) as typeof fetch;

    await expect(
      fingerprintWorker(registration, fetchWorker)
    ).resolves.toHaveLength(32);
  });
});

function createWorkerFetch(serviceWorker: string, alertWorker: string) {
  return vi.fn(async (input: string | URL | Request) =>
    new Response(String(input).endsWith("/sw.js") ? serviceWorker : alertWorker)
  ) as typeof fetch;
}

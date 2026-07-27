import { describe, expect, it } from "vitest";

import { isAllowedPushEndpoint } from "./push-endpoint";

describe("push endpoint policy", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/opaque",
    "https://updates.push.services.mozilla.com/wpush/v2/opaque",
    "https://web.push.apple.com/QH/opaque",
    "https://wns2-am3p.notify.windows.com/w/?token=opaque",
  ])("allows a browser push service endpoint: %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "https://localhost/push",
    "https://127.0.0.1/push",
    "https://10.0.0.5/push",
    "https://attacker.example/push",
    "https://fcm.googleapis.com.attacker.example/push",
    "http://fcm.googleapis.com/push",
  ])("rejects a non-push or private endpoint: %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});

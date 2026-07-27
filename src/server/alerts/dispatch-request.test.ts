import { describe, expect, it, vi } from "vitest";

import { verifyDispatchRequest } from "./dispatch-request";

describe("QStash callback verification", () => {
  it("verifies the raw body, rotated key signature, and canonical URL", async () => {
    const verify = vi.fn().mockResolvedValue(true);

    await expect(
      verifyDispatchRequest(
        '{"restId":"a","token":"b"}',
        "signature",
        "https://workouts.example/api/rest-alerts/dispatch",
        verify
      )
    ).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith({
      body: '{"restId":"a","token":"b"}',
      signature: "signature",
      url: "https://workouts.example/api/rest-alerts/dispatch",
    });
  });

  it("rejects a missing signature without calling the verifier", async () => {
    const verify = vi.fn();

    await expect(
      verifyDispatchRequest("{}", null, "https://workouts.example/api", verify)
    ).resolves.toBe(false);
    expect(verify).not.toHaveBeenCalled();
  });
});

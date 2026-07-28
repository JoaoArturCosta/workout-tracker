import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ServiceWorkerRegistration } from "./service-worker-registration";

describe("ServiceWorkerRegistration", () => {
  it("registers the root service worker for App Router pages", async () => {
    const register = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    render(<ServiceWorkerRegistration />);

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

async function loadApi() {
  vi.resetModules();
  return import("@/lib/api");
}

describe("apiUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes leading slashes for relative API calls", async () => {
    const { apiUrl } = await loadApi();

    expect(apiUrl("api/generate-lesson")).toBe("/api/generate-lesson");
    expect(apiUrl("/api/generate-lesson")).toBe("/api/generate-lesson");
  });

  it("removes a trailing base URL slash", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
    const { apiUrl } = await loadApi();

    expect(apiUrl("/health")).toBe("https://api.example.test/health");
  });
});

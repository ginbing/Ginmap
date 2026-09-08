import { describe, expect, it } from "vitest";
import { walkAdaptiveWindows } from "@ginmap/github";

describe("walkAdaptiveWindows", () => {
  it("splits windows that exceed the GitHub search limit", async () => {
    const fetched: Array<[number, number]> = [];
    const result = await walkAdaptiveWindows({
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-01-01T00:00:09Z"),
      count: async ({ from, to }) => {
        const seconds = Math.floor((to.getTime() - from.getTime()) / 1000) + 1;
        return seconds * 300;
      },
      fetch: async ({ from, to }) => {
        fetched.push([from.getTime(), to.getTime()]);
        return [`${from.toISOString()}-${to.toISOString()}`];
      },
      maxResults: 1000,
    });
    expect(result.length).toBeGreaterThan(1);
    expect(fetched.every(([from, to]) => Math.floor((to - from) / 1000) + 1 <= 3)).toBe(true);
  });

  it("rejects an unsplittable one-second overflow", async () => {
    await expect(walkAdaptiveWindows({
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-01-01T00:00:00Z"),
      count: async () => 1001,
      fetch: async () => [],
    })).rejects.toThrow(/cannot partition safely/);
  });
});

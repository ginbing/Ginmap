import { describe, expect, it } from "vitest";
import { defaultProfileSettings, type ProfileSnapshot } from "@ginmap/model";
import { escapeXml, renderWorkCard } from "@ginmap/render";

const snapshot: ProfileSnapshot = {
  schemaVersion: "1",
  metricsVersion: "test",
  calculatedAt: "2026-09-08T12:00:00.000Z",
  identity: { githubId: "1", nodeId: "U_1", login: "<octo&cat>", avatarUrl: "", profileUrl: "", createdAt: "2020-01-01T00:00:00.000Z" },
  lifetime: { contributions: 100, commits: 50, pullRequests: 20, mergedPullRequests: 15, openPullRequests: 3, closedUnmergedPullRequests: 2, issues: 8, reviews: 9, repositoriesWorkedIn: 4, additions: 12000, deletions: 3000, changedFiles: 90 },
  years: [],
  accountWideMetricsAvailable: true,
  repositories: [{
    repositoryId: "42", fullName: "org/<tool>", ownerLogin: "org", ownerAvatarUrl: null, htmlUrl: "", description: null,
    primaryLanguage: "TypeScript", stars: 100, isFork: false, role: "contributor", pullRequests: 8, mergedPullRequests: 7,
    openPullRequests: 1, closedUnmergedPullRequests: 0, issues: 2, reviews: 3, commits: 4, additions: 100, deletions: 20,
    changedFiles: 4, firstActivityAt: null, lastActivityAt: null, firstActivityYear: 2026, lastActivityYear: 2026,
  }],
};

describe("SVG card", () => {
  it("escapes user and repository content", () => {
    const svg = renderWorkCard(snapshot, defaultProfileSettings, "light");
    expect(svg).toContain("&lt;octo&amp;cat&gt;");
    expect(svg).toContain("org/&lt;tool&gt;");
    expect(svg).not.toContain("<octo&cat>");
  });

  it("renders both themes", () => {
    expect(renderWorkCard(snapshot, defaultProfileSettings, "light")).toContain("#ffffff");
    expect(renderWorkCard(snapshot, defaultProfileSettings, "dark")).toContain("#0d1117");
  });

  it("does not render account-wide metrics when they are unavailable", () => {
    const hidden = { ...snapshot, accountWideMetricsAvailable: false };
    const svg = renderWorkCard(hidden, defaultProfileSettings, "light");
    expect(svg).not.toContain("reviewed PRs");
    expect(svg).not.toContain(">contribs<");
  });

  it("escapes XML primitives", () => {
    expect(escapeXml(`a&b<c>"d"`)).toBe("a&amp;b&lt;c&gt;&quot;d&quot;");
  });
});

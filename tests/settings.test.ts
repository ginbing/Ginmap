import { describe, expect, it } from "vitest";
import { applySettings } from "@ginmap/analytics";
import { defaultProfileSettings, type ProfileSnapshot } from "@ginmap/model";

const base: ProfileSnapshot = {
  schemaVersion: "1", metricsVersion: "test", calculatedAt: new Date(0).toISOString(),
  identity: { githubId: "1", nodeId: null, login: "x", avatarUrl: "", profileUrl: "", createdAt: new Date(0).toISOString() },
  lifetime: { contributions: 100, commits: 20, pullRequests: 5, mergedPullRequests: 5, openPullRequests: 0, closedUnmergedPullRequests: 0, issues: 3, reviews: 9, repositoriesWorkedIn: 2, additions: 50, deletions: 10, changedFiles: 8 },
  years: [{ year: 2026, contributions: 100, commits: 20, pullRequests: 5, issues: 3, reviews: 9 }],
  accountWideMetricsAvailable: true,
  repositories: [
    { repositoryId: "1", fullName: "a/a", ownerLogin: "a", ownerAvatarUrl: null, htmlUrl: "", description: null, primaryLanguage: null, stars: 0, isFork: false, role: "contributor", pullRequests: 4, mergedPullRequests: 4, openPullRequests: 0, closedUnmergedPullRequests: 0, issues: 2, reviews: 4, commits: 12, additions: 40, deletions: 8, changedFiles: 6, firstActivityAt: null, lastActivityAt: "2026-01-01T00:00:00Z", firstActivityYear: 2026, lastActivityYear: 2026 },
    { repositoryId: "2", fullName: "b/b", ownerLogin: "b", ownerAvatarUrl: null, htmlUrl: "", description: null, primaryLanguage: null, stars: 0, isFork: false, role: "contributor", pullRequests: 1, mergedPullRequests: 1, openPullRequests: 0, closedUnmergedPullRequests: 0, issues: 1, reviews: 5, commits: 8, additions: 10, deletions: 2, changedFiles: 2, firstActivityAt: null, lastActivityAt: "2026-01-01T00:00:00Z", firstActivityYear: 2026, lastActivityYear: 2026 },
  ],
};

describe("profile settings", () => {
  it("hides repositories, recomputes exact visible totals, and withholds indivisible account-wide metrics", () => {
    const settings = { ...defaultProfileSettings, hiddenRepositoryIds: ["1"], pinnedRepositoryIds: ["2"] };
    const result = applySettings(base, settings);
    expect(result.repositories.map((repo) => repo.repositoryId)).toEqual(["2"]);
    expect(result.lifetime.pullRequests).toBe(1);
    expect(result.lifetime.issues).toBe(1);
    expect(result.lifetime.additions).toBe(10);
    expect(result.lifetime.repositoriesWorkedIn).toBe(1);
    expect(result.accountWideMetricsAvailable).toBe(false);
    expect(result.lifetime.contributions).toBe(0);
    expect(result.lifetime.commits).toBe(0);
    expect(result.lifetime.reviews).toBe(0);
    expect(result.years).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { applySettings } from "@ginmap/analytics";
import { defaultProfileSettings, type ProfileSnapshot } from "@ginmap/model";

const base: ProfileSnapshot = {
  schemaVersion: "1", metricsVersion: "test", calculatedAt: new Date(0).toISOString(),
  identity: { githubId: "1", nodeId: null, login: "x", avatarUrl: "", profileUrl: "", createdAt: new Date(0).toISOString() },
  lifetime: { contributions: 0, commits: 0, pullRequests: 0, mergedPullRequests: 0, openPullRequests: 0, closedUnmergedPullRequests: 0, issues: 0, reviews: 0, repositoriesWorkedIn: 2, additions: 0, deletions: 0, changedFiles: 0 },
  years: [],
  repositories: [
    { repositoryId: "1", fullName: "a/a", ownerLogin: "a", ownerAvatarUrl: null, htmlUrl: "", stars: 0, role: "contributor", pullRequests: 4, mergedPullRequests: 4, openPullRequests: 0, closedUnmergedPullRequests: 0, issues: 0, reviews: 0, commitDays: 0, additions: 0, deletions: 0, changedFiles: 0, firstActivityAt: null, lastActivityAt: "2026-01-01T00:00:00Z" },
    { repositoryId: "2", fullName: "b/b", ownerLogin: "b", ownerAvatarUrl: null, htmlUrl: "", stars: 0, role: "contributor", pullRequests: 1, mergedPullRequests: 1, openPullRequests: 0, closedUnmergedPullRequests: 0, issues: 0, reviews: 0, commitDays: 0, additions: 0, deletions: 0, changedFiles: 0, firstActivityAt: null, lastActivityAt: "2026-01-01T00:00:00Z" },
  ],
};

describe("profile settings", () => {
  it("hides repositories and keeps pinned order", () => {
    const settings = { ...defaultProfileSettings, hiddenRepositoryIds: ["1"], pinnedRepositoryIds: ["2"] };
    const result = applySettings(base, settings);
    expect(result.repositories.map((repo) => repo.repositoryId)).toEqual(["2"]);
  });
});

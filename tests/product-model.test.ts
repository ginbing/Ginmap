import { describe, expect, it } from "vitest";
import { splitWork } from "@ginmap/analytics";
import { validGitHubLogin } from "@ginmap/hosted";
import type { RepositoryWorkSummary } from "@ginmap/model";

function repo(id: string, role: "owner" | "contributor", isFork = false): RepositoryWorkSummary {
  return {
    repositoryId: id,
    fullName: role === "owner" ? `octocat/${id}` : `upstream/${id}`,
    ownerLogin: role === "owner" ? "octocat" : "upstream",
    ownerAvatarUrl: null,
    htmlUrl: "https://github.com/example/repo",
    description: null,
    primaryLanguage: null,
    stars: 0,
    isFork,
    role,
    pullRequests: 1,
    mergedPullRequests: 1,
    openPullRequests: 0,
    closedUnmergedPullRequests: 0,
    issues: 0,
    reviews: 0,
    commits: 0,
    additions: 1,
    deletions: 0,
    changedFiles: 1,
    firstActivityAt: null,
    lastActivityAt: null,
    firstActivityYear: 2026,
    lastActivityYear: 2026,
  };
}

describe("mature product model", () => {
  it("separates owned projects from external contributions and excludes personal forks from projects", () => {
    const result = splitWork([repo("project", "owner"), repo("fork", "owner", true), repo("contribution", "contributor")]);
    expect(result.projects.map((item) => item.repositoryId)).toEqual(["project"]);
    expect(result.externalContributions.map((item) => item.repositoryId)).toEqual(["contribution"]);
  });

  it("accepts GitHub login syntax and rejects route-like input", () => {
    expect(validGitHubLogin("squarepots")).toBe(true);
    expect(validGitHubLogin("octo-cat")).toBe(true);
    expect(validGitHubLogin("-octocat")).toBe(false);
    expect(validGitHubLogin("octocat-")).toBe(false);
    expect(validGitHubLogin("octo/cat")).toBe(false);
    expect(validGitHubLogin("a".repeat(40))).toBe(false);
  });
});

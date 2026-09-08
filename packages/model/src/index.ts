export const METRICS_VERSION = "2026-09-v1";
export const API_SCHEMA_VERSION = "1";

export type SyncKind = "backfill" | "incremental" | "reconcile";
export type SyncStatus = "pending" | "running" | "complete" | "failed";
export type JobStatus = "pending" | "running" | "complete" | "failed";
export type Theme = "light" | "dark";

export interface GitHubIdentity {
  githubId: string;
  nodeId: string | null;
  login: string;
  avatarUrl: string;
  profileUrl: string;
  createdAt: string;
}

export interface RepositoryIdentity {
  githubId: string;
  nodeId: string | null;
  ownerLogin: string;
  ownerId: string | null;
  ownerAvatarUrl: string | null;
  name: string;
  fullName: string;
  htmlUrl: string;
  stars: number;
  isFork: boolean;
  isArchived: boolean;
}

export interface PullRequestRecord {
  nodeId: string;
  databaseId: string | null;
  number: number;
  repository: RepositoryIdentity;
  state: "OPEN" | "CLOSED" | "MERGED";
  merged: boolean;
  additions: number;
  deletions: number;
  changedFiles: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  url: string;
}

export interface IssueRecord {
  nodeId: string;
  databaseId: string | null;
  number: number;
  repository: RepositoryIdentity;
  state: "OPEN" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  url: string;
}

export interface RepoContributionCounters {
  repository: RepositoryIdentity;
  commitDays: number;
  pullRequests: number;
  issues: number;
  reviews: number;
}

export interface YearContributionRecord {
  year: number;
  totalContributions: number;
  commits: number;
  issues: number;
  pullRequests: number;
  reviews: number;
  restrictedContributions: number;
  repositories: RepoContributionCounters[];
}

export interface RepositoryWorkSummary {
  repositoryId: string;
  fullName: string;
  ownerLogin: string;
  ownerAvatarUrl: string | null;
  htmlUrl: string;
  stars: number;
  role: "owner" | "contributor";
  pullRequests: number;
  mergedPullRequests: number;
  openPullRequests: number;
  closedUnmergedPullRequests: number;
  issues: number;
  reviews: number;
  commitDays: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
}

export interface YearSummary {
  year: number;
  contributions: number;
  commits: number;
  pullRequests: number;
  issues: number;
  reviews: number;
}

export interface LifetimeSummary {
  contributions: number;
  commits: number;
  pullRequests: number;
  mergedPullRequests: number;
  openPullRequests: number;
  closedUnmergedPullRequests: number;
  issues: number;
  reviews: number;
  repositoriesWorkedIn: number;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface ProfileSnapshot {
  schemaVersion: string;
  metricsVersion: string;
  calculatedAt: string;
  identity: GitHubIdentity;
  lifetime: LifetimeSummary;
  years: YearSummary[];
  repositories: RepositoryWorkSummary[];
}

export interface ProfileSettings {
  publicProfile: boolean;
  hiddenRepositoryIds: string[];
  pinnedRepositoryIds: string[];
  visibleMetrics: {
    contributions: boolean;
    pullRequests: boolean;
    issues: boolean;
    reviews: boolean;
    repositories: boolean;
    codeChanged: boolean;
  };
}

export const defaultProfileSettings: ProfileSettings = {
  publicProfile: true,
  hiddenRepositoryIds: [],
  pinnedRepositoryIds: [],
  visibleMetrics: {
    contributions: true,
    pullRequests: true,
    issues: true,
    reviews: true,
    repositories: true,
    codeChanged: true,
  },
};

export interface PublicSummaryResponse {
  schemaVersion: string;
  metricsVersion: string;
  calculatedAt: string;
  identity: GitHubIdentity;
  lifetime: LifetimeSummary;
  years: YearSummary[];
  repositories: RepositoryWorkSummary[];
  definitionsUrl: string;
}

export interface BackfillState {
  years: number[];
  nextYearIndex: number;
}

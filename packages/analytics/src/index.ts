import {
  API_SCHEMA_VERSION,
  METRICS_VERSION,
  type ProfileSettings,
  type ProfileSnapshot,
  type PublicSummaryResponse,
  type RepositoryWorkSummary,
} from "@ginmap/model";
import {
  getIssueTotal,
  getPrTotals,
  getProfileSettings,
  getSnapshot,
  getUserById,
  listRepositoryWork,
  listYearContributions,
  rebuildRepositoryContributions,
  saveSnapshot,
} from "@ginmap/db";

export async function rebuildSnapshot(userId: string): Promise<ProfileSnapshot> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  await rebuildRepositoryContributions(userId);
  const [years, repositories, pr, issues] = await Promise.all([
    listYearContributions(userId),
    listRepositoryWork(userId),
    getPrTotals(userId),
    getIssueTotal(userId),
  ]);
  const publicYears = years.filter((year) => year.totalContributions > 0 || year.commits > 0 || year.issues > 0 || year.pullRequests > 0 || year.reviews > 0);
  const contributionTotals = publicYears.reduce(
    (acc, year) => ({
      contributions: acc.contributions + year.totalContributions,
      commits: acc.commits + year.commits,
      reviews: acc.reviews + year.reviews,
    }),
    { contributions: 0, commits: 0, reviews: 0 },
  );
  const snapshot: ProfileSnapshot = {
    schemaVersion: API_SCHEMA_VERSION,
    metricsVersion: METRICS_VERSION,
    calculatedAt: new Date().toISOString(),
    identity: {
      githubId: user.github_id,
      nodeId: user.github_node_id,
      login: user.login,
      avatarUrl: user.avatar_url,
      profileUrl: user.profile_url,
      createdAt: user.github_created_at.toISOString(),
    },
    lifetime: {
      contributions: contributionTotals.contributions,
      commits: contributionTotals.commits,
      pullRequests: pr.total,
      mergedPullRequests: pr.merged,
      openPullRequests: pr.open,
      closedUnmergedPullRequests: pr.closedUnmerged,
      issues,
      reviews: contributionTotals.reviews,
      repositoriesWorkedIn: repositories.length,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
    },
    years: publicYears.map((year) => ({
      year: year.year,
      contributions: year.totalContributions,
      commits: year.commits,
      pullRequests: year.pullRequests,
      issues: year.issues,
      reviews: year.reviews,
    })),
    repositories: repositories.sort(defaultRepositorySort),
  };
  await saveSnapshot(userId, snapshot);
  return snapshot;
}

function defaultRepositorySort(a: RepositoryWorkSummary, b: RepositoryWorkSummary): number {
  return b.mergedPullRequests - a.mergedPullRequests || b.pullRequests - a.pullRequests ||
    Date.parse(b.lastActivityAt ?? "1970-01-01") - Date.parse(a.lastActivityAt ?? "1970-01-01") ||
    a.fullName.localeCompare(b.fullName);
}

export function applySettings(snapshot: ProfileSnapshot, settings: ProfileSettings): ProfileSnapshot {
  const hidden = new Set(settings.hiddenRepositoryIds);
  const pins = new Map(settings.pinnedRepositoryIds.map((id, index) => [id, index]));
  const repositories = snapshot.repositories
    .filter((repository) => !hidden.has(repository.repositoryId))
    .sort((a, b) => {
      const ai = pins.get(a.repositoryId);
      const bi = pins.get(b.repositoryId);
      if (ai != null && bi != null) return ai - bi;
      if (ai != null) return -1;
      if (bi != null) return 1;
      return defaultRepositorySort(a, b);
    });
  return { ...snapshot, repositories };
}

export async function getVisibleSnapshot(userId: string): Promise<{ snapshot: ProfileSnapshot; settings: ProfileSettings } | null> {
  const [snapshot, settings] = await Promise.all([getSnapshot(userId), getProfileSettings(userId)]);
  if (!snapshot) return null;
  return { snapshot: applySettings(snapshot, settings), settings };
}

export function toPublicSummary(snapshot: ProfileSnapshot, definitionsUrl: string): PublicSummaryResponse {
  return {
    schemaVersion: snapshot.schemaVersion,
    metricsVersion: snapshot.metricsVersion,
    calculatedAt: snapshot.calculatedAt,
    identity: snapshot.identity,
    lifetime: snapshot.lifetime,
    years: snapshot.years,
    repositories: snapshot.repositories,
    definitionsUrl,
  };
}

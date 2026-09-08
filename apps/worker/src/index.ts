import { createServer } from "node:http";
import {
  decryptToken,
  encryptToken,
  githubPublicToken,
  githubClientId,
  githubClientSecret,
  reconcileIntervalHours,
  syncIntervalHours,
  unclaimedRetentionDays,
  workerHealthPort,
} from "@ginmap/config";
import {
  claimSyncJob,
  closePool,
  completeSyncJob,
  connectGitHubAccount,
  createOrResumeSyncRun,
  deleteYearContributionsNotIn,
  failSyncJob,
  failSyncRun,
  finishSyncRun,
  getGitHubCredential,
  getLastCompletedSyncAt,
  getUserById,
  listRepositoriesForUser,
  removeUserRepositoryData,
  parseBackfillState,
  updateSyncRunState,
  upsertIssue,
  upsertPullRequest,
  upsertUser,
  upsertRepository,
  upsertYearContribution,
} from "@ginmap/db";
import {
  fetchContributionYears,
  fetchIssuesInWindow,
  fetchOpenPullRequests,
  fetchPublicIdentity,
  fetchPullRequestsInWindow,
  fetchRepositoryMetadata,
  fetchViewerIdentity,
  refreshOAuthToken,
  fetchYearContributions,
} from "@ginmap/github";
import { rebuildSnapshot } from "@ginmap/analytics";
import { deleteExpiredUnclaimedProfiles, enqueueDuePublicSyncs } from "@ginmap/hosted";
import type { SyncKind } from "@ginmap/model";

const pollMs = 5_000;
let stopping = false;
let lastLoopAt = Date.now();

const healthServer = createServer((_request, response) => {
  const healthy = Date.now() - lastLoopAt < 120_000;
  response.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ status: healthy ? "ok" : "stale" }));
});
healthServer.listen(workerHealthPort());

function yearWindow(year: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
    to: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
  };
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      if (item !== undefined) await fn(item);
    }
  });
  await Promise.all(workers);
}

async function persistYear(userId: string, credential: string, login: string, year: number): Promise<void> {
  const { from, to } = yearWindow(year);
  const [contributions, prs, issues] = await Promise.all([
    fetchYearContributions(credential, login, year),
    fetchPullRequestsInWindow(credential, login, from, to),
    fetchIssuesInWindow(credential, login, from, to),
  ]);
  await upsertYearContribution(userId, contributions);
  await mapLimit(prs, 8, (pr) => upsertPullRequest(userId, pr));
  await mapLimit(issues, 8, (issue) => upsertIssue(userId, issue));
}

async function refreshOpenPrs(userId: string, credential: string, login: string, createdAt: Date): Promise<void> {
  const prs = await fetchOpenPullRequests(credential, login, createdAt);
  await mapLimit(prs, 8, (pr) => upsertPullRequest(userId, pr));
}

async function runBackfill(userId: string, credential: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  const contributionYears = await fetchContributionYears(credential, user.login);
  const currentYear = new Date().getUTCFullYear();
  const years = [...new Set([...contributionYears, currentYear])].sort((a, b) => a - b);
  const run = await createOrResumeSyncRun(userId, "backfill", { years, nextYearIndex: 0 });
  try {
    const state = parseBackfillState(run.state, years);
    for (let index = state.nextYearIndex; index < state.years.length; index++) {
      const year = state.years[index]!;
      await persistYear(userId, credential, user.login, year);
      await updateSyncRunState(run.id, { years: state.years, nextYearIndex: index + 1 });
    }
    await refreshOpenPrs(userId, credential, user.login, user.github_created_at);
    await rebuildSnapshot(userId);
    await finishSyncRun(run.id);
  } catch (error) {
    await failSyncRun(run.id, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function runIncremental(userId: string, credential: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  const previous = await getLastCompletedSyncAt(userId);
  if (!previous) {
    await runBackfill(userId, credential);
    return;
  }
  const run = await createOrResumeSyncRun(userId, "incremental", {});
  try {
    const from = new Date(Math.max(user.github_created_at.getTime(), previous.getTime() - 10 * 60 * 1000));
    const to = new Date();
    const [prs, issues, contributions] = await Promise.all([
      fetchPullRequestsInWindow(credential, user.login, from, to, "updated"),
      fetchIssuesInWindow(credential, user.login, from, to, "updated"),
      fetchYearContributions(credential, user.login, to.getUTCFullYear()),
    ]);
    await mapLimit(prs, 8, (pr) => upsertPullRequest(userId, pr));
    await mapLimit(issues, 8, (issue) => upsertIssue(userId, issue));
    await upsertYearContribution(userId, contributions);
    await refreshOpenPrs(userId, credential, user.login, user.github_created_at);
    await rebuildSnapshot(userId);
    await finishSyncRun(run.id);
  } catch (error) {
    await failSyncRun(run.id, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function reconcileRepositories(userId: string, credential: string): Promise<boolean> {
  const repositories = await listRepositoriesForUser(userId);
  let removed = false;
  await mapLimit(repositories, 4, async (repository) => {
    const current = await fetchRepositoryMetadata(credential, repository.fullName);
    if (!current) {
      await removeUserRepositoryData(userId, repository.githubId);
      removed = true;
      return;
    }
    await upsertRepository(current);
  });
  return removed;
}

async function refreshContributionHistory(userId: string, credential: string, login: string): Promise<void> {
  const contributionYears = await fetchContributionYears(credential, login);
  await mapLimit(contributionYears, 3, async (year) => {
    await upsertYearContribution(userId, await fetchYearContributions(credential, login, year));
  });
  await deleteYearContributionsNotIn(userId, contributionYears);
}

async function runReconcile(userId: string, credential: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  const run = await createOrResumeSyncRun(userId, "reconcile", {});
  try {
    const current = new Date().getUTCFullYear();
    const earliest = user.github_created_at.getUTCFullYear();
    for (const year of [current - 1, current].filter((year) => year >= earliest)) {
      await persistYear(userId, credential, user.login, year);
    }
    await refreshOpenPrs(userId, credential, user.login, user.github_created_at);
    const repositorySetChanged = await reconcileRepositories(userId, credential);
    if (repositorySetChanged) await refreshContributionHistory(userId, credential, user.login);
    await rebuildSnapshot(userId);
    await finishSyncRun(run.id);
  } catch (error) {
    await failSyncRun(run.id, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function credentialForUser(userId: string): Promise<{ credential: string; claimed: boolean }> {
  const credential = await getGitHubCredential(userId);
  if (!credential) return { credential: githubPublicToken(), claimed: false };
  if (credential.scopes.trim() !== "") throw new Error("Ginmap refuses GitHub credentials with non-empty OAuth scopes");
  const needsRefresh = credential.tokenExpiresAt != null && credential.tokenExpiresAt.getTime() <= Date.now() + 5 * 60 * 1000;
  if (!needsRefresh) return { credential: decryptToken(credential.tokenCiphertext), claimed: true };
  if (!credential.refreshTokenCiphertext) throw new Error("GitHub access token expired; reconnect GitHub");
  if (credential.refreshTokenExpiresAt && credential.refreshTokenExpiresAt.getTime() <= Date.now()) throw new Error("GitHub refresh token expired; reconnect GitHub");
  const refreshed = await refreshOAuthToken(githubClientId(), githubClientSecret(), decryptToken(credential.refreshTokenCiphertext));
  if (refreshed.scope.trim() !== "") throw new Error("Ginmap refuses refreshed GitHub credentials with non-empty OAuth scopes");
  const now = Date.now();
  await connectGitHubAccount(userId, {
    tokenCiphertext: encryptToken(refreshed.accessToken),
    refreshTokenCiphertext: refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : null,
    tokenExpiresAt: refreshed.expiresIn == null ? null : new Date(now + refreshed.expiresIn * 1000),
    refreshTokenExpiresAt: refreshed.refreshTokenExpiresIn == null ? null : new Date(now + refreshed.refreshTokenExpiresIn * 1000),
    scopes: refreshed.scope,
  });
  return { credential: refreshed.accessToken, claimed: true };
}

async function refreshIdentity(userId: string, credential: string, claimed: boolean): Promise<void> {
  const existing = await getUserById(userId);
  if (!existing) throw new Error("User not found");
  const identity = claimed
    ? await fetchViewerIdentity(credential)
    : await fetchPublicIdentity(credential, existing.login);
  if (!identity) throw new Error("GitHub user is no longer public or does not exist");
  if (identity.githubId !== existing.github_id) throw new Error("GitHub identity changed unexpectedly");
  const refreshed = await upsertUser(identity);
  if (refreshed.id !== userId) throw new Error("GitHub identity changed unexpectedly");
}

async function processJob(job: { id: string; userId: string; kind: SyncKind; attempts: number }): Promise<void> {
  const { credential, claimed } = await credentialForUser(job.userId);
  await refreshIdentity(job.userId, credential, claimed);
  if (job.kind === "backfill") await runBackfill(job.userId, credential);
  if (job.kind === "incremental") await runIncremental(job.userId, credential);
  if (job.kind === "reconcile") await runReconcile(job.userId, credential);
}

async function loop(): Promise<void> {
  let lastScheduler = 0;
  while (!stopping) {
    lastLoopAt = Date.now();
    if (Date.now() - lastScheduler > 5 * 60 * 1000) {
      try {
        await enqueueDuePublicSyncs(syncIntervalHours(), reconcileIntervalHours());
        const deleted = await deleteExpiredUnclaimedProfiles(unclaimedRetentionDays());
        if (deleted > 0) console.log(JSON.stringify({ event: "profiles.expired", count: deleted }));
        lastScheduler = Date.now();
      } catch (error) {
        console.error(JSON.stringify({ event: "scheduler.failed", error: error instanceof Error ? error.message : String(error) }));
      }
    }
    const job = await claimSyncJob();
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    try {
      await processJob(job);
      await completeSyncJob(job.id);
      console.log(JSON.stringify({ event: "sync.complete", jobId: job.id, userId: job.userId, kind: job.kind }));
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      await failSyncJob(job.id, message, job.attempts);
      console.error(JSON.stringify({ event: "sync.failed", jobId: job.id, userId: job.userId, kind: job.kind, error: message }));
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => { stopping = true; healthServer.close(); });
}

loop()
  .catch((error) => {
    console.error(error);
    healthServer.close();
    process.exitCode = 1;
  })
  .finally(async () => closePool());

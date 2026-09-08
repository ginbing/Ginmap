import type {
  GitHubIdentity,
  IssueRecord,
  PullRequestRecord,
  RepoContributionCounters,
  RepositoryIdentity,
  YearContributionRecord,
} from "@ginmap/model";

const REST = "https://api.github.com";
const GRAPHQL = "https://api.github.com/graphql";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authorizationHeader(credential: string): string {
  return credential.startsWith("Basic ") || credential.startsWith("Bearer ")
    ? credential
    : `Bearer ${credential}`;
}

async function githubFetch(url: string, credential: string, init: RequestInit = {}, allowedStatuses: number[] = []): Promise<Response> {
  let lastResponse: Response | undefined;
  let lastNetworkError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: authorizationHeader(credential),
          "X-GitHub-Api-Version": "2026-03-10",
          "User-Agent": "ginmap",
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      lastNetworkError = error;
      if (attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      break;
    }
    lastResponse = response;
    if (response.ok || allowedStatuses.includes(response.status)) return response;
    if (![403, 429, 502, 503, 504].includes(response.status)) break;
    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    const reset = Number(response.headers.get("x-ratelimit-reset") ?? 0) * 1000 - Date.now();
    const delay = retryAfter > 0 ? retryAfter * 1000 : reset > 0 ? reset : 1000 * 2 ** attempt;
    await sleep(Math.min(Math.max(delay, 1000), 60_000));
  }
  if (lastResponse) {
    const text = await lastResponse.text();
    throw new Error(`GitHub API request failed (${lastResponse.status}): ${text.slice(0, 500)}`);
  }
  throw new Error(`GitHub API request failed (network): ${lastNetworkError instanceof Error ? lastNetworkError.message : String(lastNetworkError ?? "unknown error")}`);
}

async function graphql<T>(credential: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await githubFetch(GRAPHQL, credential, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const payload = (await response.json()) as { data?: T; errors?: Array<{ message: string; type?: string }> };
  if (payload.errors?.length) throw new Error(`GitHub GraphQL: ${payload.errors.map((error) => error.message).join("; ")}`);
  if (!payload.data) throw new Error("GitHub GraphQL returned no data");
  return payload.data;
}

export interface OAuthTokenSet {
  accessToken: string;
  scope: string;
  expiresIn: number | null;
  refreshToken: string | null;
  refreshTokenExpiresIn: number | null;
}

function parseOAuthTokenPayload(payload: {
  access_token?: string; scope?: string; expires_in?: number; refresh_token?: string; refresh_token_expires_in?: number; error?: string; error_description?: string;
}): OAuthTokenSet {
  if (!payload.access_token) throw new Error(payload.error_description ?? payload.error ?? "GitHub OAuth returned no access token");
  return {
    accessToken: payload.access_token,
    scope: payload.scope ?? "",
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : null,
    refreshToken: payload.refresh_token ?? null,
    refreshTokenExpiresIn: typeof payload.refresh_token_expires_in === "number" ? payload.refresh_token_expires_in : null,
  };
}

export async function exchangeOAuthCode(clientId: string, clientSecret: string, code: string): Promise<OAuthTokenSet> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "ginmap" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!response.ok) throw new Error(`GitHub OAuth exchange failed (${response.status})`);
  return parseOAuthTokenPayload(await response.json());
}

export async function refreshOAuthToken(clientId: string, clientSecret: string, refreshToken: string): Promise<OAuthTokenSet> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "ginmap" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!response.ok) throw new Error(`GitHub OAuth refresh failed (${response.status})`);
  return parseOAuthTokenPayload(await response.json());
}

function mapRestUser(user: {
  id: number; node_id?: string; login: string; avatar_url: string; html_url: string; created_at: string;
}): GitHubIdentity {
  return {
    githubId: String(user.id),
    nodeId: user.node_id ?? null,
    login: user.login,
    avatarUrl: user.avatar_url,
    profileUrl: user.html_url,
    createdAt: user.created_at,
  };
}

export async function fetchViewerIdentity(credential: string): Promise<GitHubIdentity> {
  const response = await githubFetch(`${REST}/user`, credential);
  return mapRestUser(await response.json() as {
    id: number; node_id?: string; login: string; avatar_url: string; html_url: string; created_at: string;
  });
}

export async function fetchPublicIdentity(credential: string, login: string): Promise<GitHubIdentity | null> {
  const response = await githubFetch(`${REST}/users/${encodeURIComponent(login)}`, credential, {}, [404]);
  if (response.status === 404) return null;
  return mapRestUser(await response.json() as {
    id: number; node_id?: string; login: string; avatar_url: string; html_url: string; created_at: string;
  });
}

interface GraphRepository {
  id: string;
  databaseId: number | null;
  name: string;
  nameWithOwner: string;
  url: string;
  stargazerCount: number;
  isFork: boolean;
  isArchived: boolean;
  owner: { login: string; avatarUrl: string };
}

function mapRepository(repo: GraphRepository): RepositoryIdentity {
  if (repo.databaseId == null) throw new Error(`Repository ${repo.nameWithOwner} has no databaseId`);
  return {
    githubId: String(repo.databaseId),
    nodeId: repo.id,
    ownerLogin: repo.owner.login,
    ownerId: null,
    ownerAvatarUrl: repo.owner.avatarUrl,
    name: repo.name,
    fullName: repo.nameWithOwner,
    htmlUrl: repo.url,
    stars: repo.stargazerCount,
    isFork: repo.isFork,
    isArchived: repo.isArchived,
  };
}

const REPOSITORY_FIELDS = `
  id databaseId name nameWithOwner url stargazerCount isFork isArchived
  owner { login avatarUrl }
`;

export async function fetchContributionYears(credential: string, login: string): Promise<number[]> {
  const data = await graphql<{ user: { contributionsCollection: { contributionYears: number[] } } | null }>(credential, `
    query ContributionYears($login: String!) {
      user(login: $login) { contributionsCollection { contributionYears } }
    }
  `, { login });
  if (!data.user) throw new Error(`GitHub user not found: ${login}`);
  return [...data.user.contributionsCollection.contributionYears].sort((a, b) => a - b);
}

interface ContributionGroup {
  repository: GraphRepository;
  contributions: { totalCount: number };
}

export async function fetchYearContributions(credential: string, login: string, year: number): Promise<YearContributionRecord> {
  const from = new Date(Date.UTC(year, 0, 1)).toISOString();
  const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString();
  const data = await graphql<{
    user: {
      contributionsCollection: {
        contributionCalendar: { totalContributions: number };
        totalCommitContributions: number;
        totalIssueContributions: number;
        totalPullRequestContributions: number;
        totalPullRequestReviewContributions: number;
        restrictedContributionsCount: number;
        commitContributionsByRepository: ContributionGroup[];
        issueContributionsByRepository: ContributionGroup[];
        pullRequestContributionsByRepository: ContributionGroup[];
        pullRequestReviewContributionsByRepository: ContributionGroup[];
      };
    } | null;
  }>(credential, `
    query YearContributions($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar { totalContributions }
          totalCommitContributions
          totalIssueContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          restrictedContributionsCount
          commitContributionsByRepository(maxRepositories: 100) { repository { ${REPOSITORY_FIELDS} } contributions(first: 1) { totalCount } }
          issueContributionsByRepository(maxRepositories: 100) { repository { ${REPOSITORY_FIELDS} } contributions(first: 1) { totalCount } }
          pullRequestContributionsByRepository(maxRepositories: 100) { repository { ${REPOSITORY_FIELDS} } contributions(first: 1) { totalCount } }
          pullRequestReviewContributionsByRepository(maxRepositories: 100) { repository { ${REPOSITORY_FIELDS} } contributions(first: 1) { totalCount } }
        }
      }
    }
  `, { login, from, to });
  if (!data.user) throw new Error(`GitHub user not found: ${login}`);
  const c = data.user.contributionsCollection;
  const byRepo = new Map<string, RepoContributionCounters>();
  const apply = (groups: ContributionGroup[], key: "commitDays" | "issues" | "pullRequests" | "reviews") => {
    for (const group of groups) {
      const repository = mapRepository(group.repository);
      const current = byRepo.get(repository.githubId) ?? { repository, commitDays: 0, pullRequests: 0, issues: 0, reviews: 0 };
      current[key] += group.contributions.totalCount;
      byRepo.set(repository.githubId, current);
    }
  };
  apply(c.commitContributionsByRepository, "commitDays");
  apply(c.issueContributionsByRepository, "issues");
  apply(c.pullRequestContributionsByRepository, "pullRequests");
  apply(c.pullRequestReviewContributionsByRepository, "reviews");
  return {
    year,
    totalContributions: Math.max(0, c.contributionCalendar.totalContributions - c.restrictedContributionsCount),
    commits: c.totalCommitContributions,
    issues: c.totalIssueContributions,
    pullRequests: c.totalPullRequestContributions,
    reviews: c.totalPullRequestReviewContributions,
    restrictedContributions: c.restrictedContributionsCount,
    repositories: [...byRepo.values()],
  };
}

export interface SearchWindow { from: Date; to: Date }

export async function walkAdaptiveWindows<T>(options: {
  from: Date;
  to: Date;
  count: (window: SearchWindow) => Promise<number>;
  fetch: (window: SearchWindow) => Promise<T[]>;
  maxResults?: number;
}): Promise<T[]> {
  const maxResults = options.maxResults ?? 1000;
  const output: T[] = [];
  const queue: SearchWindow[] = [{ from: options.from, to: options.to }];
  while (queue.length) {
    const window = queue.shift()!;
    const count = await options.count(window);
    if (count === 0) continue;
    if (count <= maxResults) {
      output.push(...await options.fetch(window));
      continue;
    }
    const fromSec = Math.floor(window.from.getTime() / 1000);
    const toSec = Math.floor(window.to.getTime() / 1000);
    if (fromSec >= toSec) throw new Error(`GitHub search has more than ${maxResults} results in one second; cannot partition safely`);
    const midSec = Math.floor((fromSec + toSec) / 2);
    queue.unshift(
      { from: new Date(fromSec * 1000), to: new Date(midSec * 1000) },
      { from: new Date((midSec + 1) * 1000), to: new Date(toSec * 1000) },
    );
  }
  return output;
}

function qualifierDate(date: Date): string {
  return date.toISOString().replace(/\.000Z$/, "Z");
}

function buildSearch(login: string, kind: "pr" | "issue", field: "created" | "updated", window: SearchWindow, extra = ""): string {
  return `is:${kind} author:${login} ${field}:${qualifierDate(window.from)}..${qualifierDate(window.to)} ${extra}`.trim();
}

async function searchCount(credential: string, query: string): Promise<number> {
  const data = await graphql<{ search: { issueCount: number } }>(credential, `
    query SearchCount($query: String!) { search(query: $query, type: ISSUE, first: 1) { issueCount } }
  `, { query });
  return data.search.issueCount;
}

interface GraphPr {
  __typename: "PullRequest";
  id: string; databaseId: number | null; number: number; state: "OPEN" | "CLOSED" | "MERGED"; merged: boolean;
  additions: number; deletions: number; changedFiles: number; createdAt: string; updatedAt: string; closedAt: string | null; mergedAt: string | null; url: string;
  repository: GraphRepository;
}

interface GraphIssue {
  __typename: "Issue";
  id: string; databaseId: number | null; number: number; state: "OPEN" | "CLOSED";
  createdAt: string; updatedAt: string; closedAt: string | null; url: string; repository: GraphRepository;
}

async function fetchPrSearchPage(credential: string, query: string, after: string | null): Promise<{ nodes: GraphPr[]; hasNextPage: boolean; endCursor: string | null }> {
  const data = await graphql<{ search: { nodes: Array<GraphPr | null>; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }>(credential, `
    query SearchPrs($query: String!, $after: String) {
      search(query: $query, type: ISSUE, first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          ... on PullRequest {
            __typename id databaseId number state merged additions deletions changedFiles createdAt updatedAt closedAt mergedAt url
            repository { ${REPOSITORY_FIELDS} }
          }
        }
      }
    }
  `, { query, after });
  return { nodes: data.search.nodes.filter((node): node is GraphPr => Boolean(node && node.__typename === "PullRequest")), ...data.search.pageInfo };
}

async function fetchIssueSearchPage(credential: string, query: string, after: string | null): Promise<{ nodes: GraphIssue[]; hasNextPage: boolean; endCursor: string | null }> {
  const data = await graphql<{ search: { nodes: Array<GraphIssue | null>; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }>(credential, `
    query SearchIssues($query: String!, $after: String) {
      search(query: $query, type: ISSUE, first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          ... on Issue {
            __typename id databaseId number state createdAt updatedAt closedAt url
            repository { ${REPOSITORY_FIELDS} }
          }
        }
      }
    }
  `, { query, after });
  return { nodes: data.search.nodes.filter((node): node is GraphIssue => Boolean(node && node.__typename === "Issue")), ...data.search.pageInfo };
}

function mapPr(node: GraphPr): PullRequestRecord {
  return {
    nodeId: node.id,
    databaseId: node.databaseId == null ? null : String(node.databaseId),
    number: node.number,
    repository: mapRepository(node.repository),
    state: node.merged ? "MERGED" : node.state,
    merged: node.merged,
    additions: node.additions,
    deletions: node.deletions,
    changedFiles: node.changedFiles,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    closedAt: node.closedAt,
    mergedAt: node.mergedAt,
    url: node.url,
  };
}

function mapIssue(node: GraphIssue): IssueRecord {
  return {
    nodeId: node.id,
    databaseId: node.databaseId == null ? null : String(node.databaseId),
    number: node.number,
    repository: mapRepository(node.repository),
    state: node.state,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    closedAt: node.closedAt,
    url: node.url,
  };
}

async function fetchAllPrPages(credential: string, query: string): Promise<PullRequestRecord[]> {
  const items: PullRequestRecord[] = [];
  let after: string | null = null;
  for (;;) {
    const page = await fetchPrSearchPage(credential, query, after);
    items.push(...page.nodes.map(mapPr));
    if (!page.hasNextPage || !page.endCursor) break;
    after = page.endCursor;
  }
  return items;
}

async function fetchAllIssuePages(credential: string, query: string): Promise<IssueRecord[]> {
  const items: IssueRecord[] = [];
  let after: string | null = null;
  for (;;) {
    const page = await fetchIssueSearchPage(credential, query, after);
    items.push(...page.nodes.map(mapIssue));
    if (!page.hasNextPage || !page.endCursor) break;
    after = page.endCursor;
  }
  return items;
}

function dedupeByNode<T extends { nodeId: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.nodeId, item])).values()];
}

export async function fetchPullRequestsInWindow(credential: string, login: string, from: Date, to: Date, field: "created" | "updated" = "created", extra = ""): Promise<PullRequestRecord[]> {
  const items = await walkAdaptiveWindows({
    from, to,
    count: (window) => searchCount(credential, buildSearch(login, "pr", field, window, extra)),
    fetch: (window) => fetchAllPrPages(credential, buildSearch(login, "pr", field, window, extra)),
  });
  return dedupeByNode(items);
}

export async function fetchIssuesInWindow(credential: string, login: string, from: Date, to: Date, field: "created" | "updated" = "created"): Promise<IssueRecord[]> {
  const items = await walkAdaptiveWindows({
    from, to,
    count: (window) => searchCount(credential, buildSearch(login, "issue", field, window)),
    fetch: (window) => fetchAllIssuePages(credential, buildSearch(login, "issue", field, window)),
  });
  return dedupeByNode(items);
}

export async function fetchRepositoryMetadata(credential: string, fullName: string): Promise<RepositoryIdentity | null> {
  const response = await githubFetch(`${REST}/repos/${fullName}`, credential, {}, [404]);
  if (response.status === 404) return null;
  const repo = await response.json() as {
    id: number; node_id?: string; name: string; full_name: string; html_url: string; stargazers_count: number; fork: boolean; archived: boolean;
    owner: { login: string; id: number; avatar_url: string };
  };
  return {
    githubId: String(repo.id), nodeId: repo.node_id ?? null, ownerLogin: repo.owner.login, ownerId: String(repo.owner.id),
    ownerAvatarUrl: repo.owner.avatar_url, name: repo.name, fullName: repo.full_name, htmlUrl: repo.html_url, stars: repo.stargazers_count,
    isFork: repo.fork, isArchived: repo.archived,
  };
}

export async function fetchOpenPullRequests(credential: string, login: string, accountCreatedAt: Date): Promise<PullRequestRecord[]> {
  return fetchPullRequestsInWindow(credential, login, accountCreatedAt, new Date(), "created", "is:open");
}

import type { ProfileSettings, ProfileSnapshot, RepositoryWorkSummary, Theme } from "@ginmap/model";

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character] ?? character);
}

function compact(value: number): string {
  if (Math.abs(value) < 1000) return String(value);
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function renderRepoRows(repositories: RepositoryWorkSummary[], startY: number, colors: { text: string; muted: string }, label: string): { svg: string; endY: number } {
  if (repositories.length === 0) return { svg: "", endY: startY };
  const heading = `<text x="28" y="${startY}" font-size="12" font-weight="650" letter-spacing="0.8" fill="${colors.muted}">${label}</text>`;
  const rows = repositories.map((repository, index) => {
    const y = startY + 32 + index * 33;
    const detail = repository.pullRequests > 0
      ? `${repository.pullRequests} PR${repository.pullRequests === 1 ? "" : "s"} · ${repository.mergedPullRequests} merged`
      : `${repository.commits} commits · ${repository.reviews} reviewed PRs`;
    return `<text x="28" y="${y}" font-size="14" font-weight="600" fill="${colors.text}">${escapeXml(repository.fullName)}</text><text x="732" y="${y}" text-anchor="end" font-size="13" fill="${colors.muted}">${escapeXml(detail)}</text>`;
  }).join("");
  return { svg: heading + rows, endY: startY + 32 + repositories.length * 33 };
}

export function renderWorkCard(snapshot: ProfileSnapshot, settings: ProfileSettings, theme: Theme): string {
  const dark = theme === "dark";
  const colors = dark
    ? { bg: "#0d1117", border: "#30363d", text: "#f0f6fc", muted: "#8b949e", accent: "#3fb950", secondary: "#58a6ff" }
    : { bg: "#ffffff", border: "#d0d7de", text: "#1f2328", muted: "#636c76", accent: "#1a7f37", secondary: "#0969da" };
  const metrics: Array<{ label: string; value: string }> = [];
  if (settings.visibleMetrics.pullRequests) {
    metrics.push({ label: "PRs", value: compact(snapshot.lifetime.pullRequests) });
    metrics.push({ label: "merged", value: compact(snapshot.lifetime.mergedPullRequests) });
  }
  if (settings.visibleMetrics.issues) metrics.push({ label: "issues", value: compact(snapshot.lifetime.issues) });
  if (settings.visibleMetrics.reviews && snapshot.accountWideMetricsAvailable) metrics.push({ label: "reviewed PRs", value: compact(snapshot.lifetime.reviews) });
  if (settings.visibleMetrics.repositories) metrics.push({ label: "repos", value: compact(snapshot.lifetime.repositoriesWorkedIn) });
  if (settings.visibleMetrics.contributions && snapshot.accountWideMetricsAvailable) metrics.push({ label: "contribs", value: compact(snapshot.lifetime.contributions) });
  const visibleMetrics = metrics.slice(0, 6);
  const projects = snapshot.repositories.filter((repository) => repository.role === "owner" && !repository.isFork).slice(0, 2);
  const external = snapshot.repositories.filter((repository) => repository.role === "contributor").slice(0, 3);
  const width = 760;
  const metricStart = 28;
  const metricWidth = Math.floor((width - 56) / Math.max(visibleMetrics.length, 1));
  const metricSvg = visibleMetrics.map((metric, index) => {
    const x = metricStart + index * metricWidth;
    return `<text x="${x}" y="112" font-size="22" font-weight="650" fill="${colors.text}">${escapeXml(metric.value)}</text><text x="${x}" y="133" font-size="12" fill="${colors.muted}">${escapeXml(metric.label)}</text>`;
  }).join("");

  let y = 164;
  const projectRows = renderRepoRows(projects, y, colors, "PROJECTS");
  y = projectRows.endY + (projects.length ? 18 : 0);
  const externalRows = renderRepoRows(external, y, colors, "EXTERNAL CONTRIBUTIONS");
  y = externalRows.endY;
  const codeY = y + 36;
  const height = settings.visibleMetrics.codeChanged ? codeY + 54 : codeY + 28;
  const codeSvg = settings.visibleMetrics.codeChanged
    ? `<line x1="28" y1="${codeY - 18}" x2="732" y2="${codeY - 18}" stroke="${colors.border}"/><text x="28" y="${codeY + 9}" font-size="13" fill="${colors.muted}">Code changed through authored PRs</text><text x="732" y="${codeY + 9}" text-anchor="end" font-size="13" font-weight="600" fill="${colors.text}"><tspan fill="${colors.accent}">+${escapeXml(compact(snapshot.lifetime.additions))}</tspan><tspan fill="${colors.muted}"> / </tspan><tspan fill="#cf222e">-${escapeXml(compact(snapshot.lifetime.deletions))}</tspan></text>`
    : "";
  const updated = new Date(snapshot.calculatedAt).toISOString().slice(0, 10);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(snapshot.identity.login)} GitHub work summary</title>
<desc id="desc">${snapshot.lifetime.pullRequests} pull requests, ${snapshot.lifetime.mergedPullRequests} merged, ${snapshot.lifetime.issues} issues across ${snapshot.lifetime.repositoriesWorkedIn} repositories.</desc>
<rect x="0.5" y="0.5" width="759" height="${height - 1}" rx="12" fill="${colors.bg}" stroke="${colors.border}"/>
<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}</style>
<text x="28" y="40" font-size="22" font-weight="700" fill="${colors.text}">${escapeXml(snapshot.identity.login)}</text>
<text x="28" y="62" font-size="13" fill="${colors.muted}">GitHub work · lifetime public summary</text>
<text x="732" y="40" text-anchor="end" font-size="13" font-weight="600" fill="${colors.secondary}">Ginmap</text>
<line x1="28" y1="78" x2="732" y2="78" stroke="${colors.border}"/>
${metricSvg}
${projectRows.svg}
${externalRows.svg}
${codeSvg}
<text x="732" y="${height - 16}" text-anchor="end" font-size="11" fill="${colors.muted}">Updated ${updated}</text>
</svg>`;
}

const GINMAP_BASE = new URL(import.meta.url).origin;
const format = new Intl.NumberFormat("en");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

class GinMapElement extends HTMLElement {
  static observedAttributes = ["username", "view", "theme"];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.controller = null;
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  disconnectedCallback() {
    this.controller?.abort();
  }

  get username() {
    return (this.getAttribute("username") || "").trim();
  }

  get view() {
    return this.getAttribute("view") === "compact" ? "compact" : "full";
  }

  get theme() {
    const value = this.getAttribute("theme");
    return value === "light" || value === "dark" ? value : "auto";
  }

  async render() {
    const username = this.username;
    this.controller?.abort();
    this.controller = new AbortController();
    this.shadowRoot.replaceChildren(this.shell());

    if (!username) {
      this.setStatus("Add a GitHub username with the username attribute.");
      return;
    }

    this.setStatus("Loading GitHub work map…");

    try {
      const response = await fetch(`${GINMAP_BASE}/api/v1/users/${encodeURIComponent(username)}/summary`, {
        signal: this.controller.signal,
        mode: "cors",
        credentials: "omit",
      });

      if (response.status === 202) {
        this.setStatus("Ginmap is building this account's public GitHub history. Refresh shortly.");
        return;
      }
      if (response.status === 404) {
        this.setStatus("This Ginmap is unavailable.");
        return;
      }
      if (response.status === 429) {
        this.setStatus("Ginmap is busy creating new profiles. Try again shortly.");
        return;
      }
      if (!response.ok) throw new Error(`Ginmap request failed: ${response.status}`);

      const data = await response.json();
      this.renderMap(data);
    } catch (error) {
      if (error?.name === "AbortError") return;
      this.setStatus("Ginmap could not load this work map.");
    }
  }

  shell() {
    const wrapper = el("section", `ginmap ginmap-${this.view}`);
    wrapper.dataset.theme = this.theme;
    wrapper.innerHTML = `
      <style>
        :host{display:block;container-type:inline-size;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color-scheme:light dark}
        .ginmap{--gm-bg:#fff;--gm-text:#1f2328;--gm-muted:#636c76;--gm-border:#d0d7de;--gm-accent:#0969da;--gm-panel:#f6f8fa;background:var(--gm-bg);color:var(--gm-text);border:1px solid var(--gm-border);border-radius:14px;padding:20px;box-sizing:border-box}
        .ginmap[data-theme="dark"]{--gm-bg:#0d1117;--gm-text:#e6edf3;--gm-muted:#8b949e;--gm-border:#30363d;--gm-accent:#58a6ff;--gm-panel:#161b22;color-scheme:dark}
        @media (prefers-color-scheme:dark){.ginmap[data-theme="auto"]{--gm-bg:#0d1117;--gm-text:#e6edf3;--gm-muted:#8b949e;--gm-border:#30363d;--gm-accent:#58a6ff;--gm-panel:#161b22;color-scheme:dark}}
        .head{display:flex;gap:14px;align-items:center;justify-content:space-between;min-width:0}.identity{display:flex;gap:12px;align-items:center;min-width:0}.avatar{width:48px;height:48px;border-radius:50%;flex:none}.title{font-size:20px;font-weight:700;line-height:1.2;overflow-wrap:anywhere}.muted{color:var(--gm-muted);font-size:13px}.link{color:var(--gm-accent);text-decoration:none}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:16px}.metric{background:var(--gm-panel);border-radius:10px;padding:10px}.metric strong{display:block;font-size:18px}.metric span{display:block;color:var(--gm-muted);font-size:12px;margin-top:2px}.section{margin-top:18px}.section h3{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--gm-muted);margin:0 0 8px}.repos{display:grid;gap:8px}.repo{display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-top:1px solid var(--gm-border);text-decoration:none;color:inherit}.repo:first-child{border-top:0}.repo-name{font-weight:600;overflow-wrap:anywhere}.repo-stats{white-space:nowrap;color:var(--gm-muted);font-size:12px}.status{color:var(--gm-muted);font-size:14px;min-height:42px;display:flex;align-items:center}.foot{margin-top:14px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:var(--gm-muted);font-size:12px}
        .ginmap-compact{padding:16px}.ginmap-compact .metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.ginmap-compact .external,.ginmap-compact .metric:nth-child(4){display:none}.ginmap-compact .section{margin-top:14px}
        @container (max-width:520px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.repo{display:block}.repo-stats{margin-top:4px;white-space:normal}.head{align-items:flex-start}.head>a{display:none}}
      </style>
      <div class="mount"><div class="status" role="status" aria-live="polite"></div></div>`;
    return wrapper;
  }

  setStatus(message) {
    const status = this.shadowRoot.querySelector(".status");
    if (status) status.textContent = message;
  }

  renderMap(data) {
    const mount = this.shadowRoot.querySelector(".mount");
    mount.replaceChildren();

    const head = el("div", "head");
    const identity = el("div", "identity");
    const avatar = el("img", "avatar");
    avatar.src = data.identity.avatarUrl;
    avatar.alt = "";
    const identityText = el("div");
    identityText.append(el("div", "title", data.identity.login), el("div", "muted", "GitHub work map"));
    identity.append(avatar, identityText);
    const profile = el("a", "link", "View full Ginmap ↗");
    profile.href = `${GINMAP_BASE}/${encodeURIComponent(data.identity.login)}`;
    profile.target = "_blank";
    profile.rel = "noopener noreferrer";
    head.append(identity, profile);
    mount.append(head);

    const metrics = el("div", "metrics");
    const values = [
      [data.lifetime.pullRequests, "authored PRs"],
      [data.lifetime.mergedPullRequests, "merged PRs"],
      [data.lifetime.repositoriesWorkedIn, "repositories"],
      [data.lifetime.issues, "authored issues"],
    ];
    for (const [value, label] of values) {
      const metric = el("div", "metric");
      metric.append(el("strong", "", format.format(value)), el("span", "", label));
      metrics.append(metric);
    }
    mount.append(metrics);

    const addRepos = (title, repositories, className) => {
      if (!repositories?.length) return;
      const section = el("section", `section ${className || ""}`);
      section.append(el("h3", "", title));
      const list = el("div", "repos");
      for (const repository of repositories.slice(0, this.view === "compact" ? 3 : 6)) {
        const row = el("a", "repo");
        row.href = repository.htmlUrl;
        row.target = "_blank";
        row.rel = "noopener noreferrer";
        row.append(
          el("span", "repo-name", repository.fullName),
          el("span", "repo-stats", `${format.format(repository.pullRequests)} PRs · ${format.format(repository.mergedPullRequests)} merged`),
        );
        list.append(row);
      }
      section.append(list);
      mount.append(section);
    };

    addRepos("Projects", data.projects, "projects");
    addRepos("External contributions", data.externalContributions, "external");

    const foot = el("div", "foot");
    foot.append(
      el("span", "", `Updated ${new Date(data.calculatedAt).toLocaleDateString()}`),
      el("span", "", "Ginmap · public GitHub data"),
    );
    mount.append(foot);
  }
}

if (!customElements.get("gin-map")) customElements.define("gin-map", GinMapElement);

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public Ginmap surfaces", () => {
  it("keeps canonical hosted, SVG, JSON, and iframe routes", () => {
    const config = source("apps/web/next.config.ts");
    expect(config).toContain('{ source: "/:login", destination: "/u/:login" }');
    expect(config).toContain('{ source: "/:login.svg", destination: "/u/:login/card.svg" }');
    expect(config).toContain('{ source: "/:login.json", destination: "/api/v1/users/:login/summary" }');
    expect(config).toContain('{ source: "/:login/embed", destination: "/u/:login/embed" }');
  });

  it("serves the website widget as a cross-origin module asset", () => {
    const config = source("apps/web/next.config.ts");
    const widget = source("apps/web/public/widget.js");
    expect(config).toContain('source: "/widget.js"');
    expect(config).toContain('key: "Access-Control-Allow-Origin", value: "*"');
    expect(widget).toContain('static observedAttributes = ["username", "view", "theme"]');
    expect(widget).toContain('attachShadow({ mode: "open" })');
    expect(widget).toContain("/api/v1/users/");
    expect(widget).toContain('customElements.define("gin-map", GinMapElement)');
  });

  it("allows public summary reads from embedded websites", () => {
    const route = source("apps/web/app/api/v1/users/[login]/summary/route.ts");
    expect(route).toContain('"Access-Control-Allow-Origin": "*"');
    expect(route).toContain('"Access-Control-Allow-Methods": "GET, OPTIONS"');
    expect(route).toContain("export function OPTIONS()");
    expect(route).toContain('"Cache-Control": "public, max-age=900, stale-while-revalidate=3600"');
  });

  it("keeps iframe rendering isolated from the Ginmap site chrome", () => {
    const route = source("apps/web/app/u/[login]/embed/route.ts");
    expect(route).toContain('<script type="module" src="/widget.js"></script>');
    expect(route).toContain('<gin-map username="${safeLogin}" view="full" theme="auto"></gin-map>');
    expect(route).toContain("frame-ancestors *");
  });
});

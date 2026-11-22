/**
 * robots.txt for the importer (RFC 9309): the group for our agent token if one names it, else the "*" group. The
 * longest matching Allow or Disallow wins, Allow on a tie; `*` and a trailing `$` are honoured. A robots.txt that is
 * missing (4xx) allows everything; one that fails to load (5xx or network) allows nothing, as the RFC says.
 */

export const ROBOTS_TOKEN = "proteusai-importer";

export interface Robots {
  allowed(path: string): boolean;
  sitemaps: string[];
}

interface Rule {
  allow: boolean;
  pattern: string;
}

export function parseRobots(text: string, token = ROBOTS_TOKEN): Robots {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  const sitemaps: string[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      if (key === "disallow" && value === "") continue; // "Disallow:" with no path allows everything
      current.rules.push({ allow: key === "allow", pattern: value });
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules);
  return {
    sitemaps,
    allowed(path: string) {
      let best: Rule | null = null;
      for (const r of rules) {
        if (!matches(r.pattern, path)) continue;
        if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r;
      }
      return best ? best.allow : true;
    },
  };
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp("^" + body.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""));
  return re.test(path);
}

export const ALLOW_ALL: Robots = { allowed: () => true, sitemaps: [] };
export const DENY_ALL: Robots = { allowed: () => false, sitemaps: [] };

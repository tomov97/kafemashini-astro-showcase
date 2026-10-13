#!/usr/bin/env python3
"""Internal link-graph builder for kafemashini.ch.

Parses dist/**/*.html (run `npm run build` first), extracts every internal
<a href>, classifies each edge, and writes seo/internal-linking/link-map.md.

Flags the things that quietly rot internal-link equity:
  - links whose target is a `public/_redirects` source (301/302 -> wastes equity)
  - links to a path that doesn't exist in the build (broken)
  - orphan pages: 0 *contextual* inbound links (inbound only from global
    Header/Footer/BrandNav chrome doesn't count)

Canonical URL space is EXTENSIONLESS for info pages; product/brand pages were
always extensionless. We normalize `/foo.html` -> `/foo` and `/index.html` -> `/`
for the *node* identity, but a link written as `/foo.html` is still reported as a
redirect-hitting link because that's what ships to the browser.

Usage:
    python tools/link_graph.py [--dist dist] [--out seo/internal-linking/link-map.md]
Exit code 1 if any broken internal link is found (CI-friendly).
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Links that live in global chrome are structural, not topical/contextual.
# We detect them heuristically: an href that appears on (almost) every page is
# chrome. Simpler + robust: treat the known global nav/footer/brandnav targets
# as chrome so they don't mask real orphans.
CHROME_TARGETS = {
    "/", "/produkti", "/serviz-na-kafe-mashini", "/about", "/contact", "/blog",
    "/uslovia", "/zashtita-na-lichnite-danni", "/biskvitki", "/garantsiya",
    "/kafe-mashini/delonghi", "/kafe-mashini/saeco", "/kafe-mashini/jura",
    "/kafe-mashini/philips",
}

# Category + all-products listing pages link to every product structurally, so an
# inbound link *from* them is not an editorial signal. Editorial inbound = from a
# product page, a blog/cluster article, or a pillar page.
def is_structural_source(page: str) -> bool:
    return page == "/produkti" or page.startswith("/kafe-mashini/") or page in CHROME_TARGETS

HREF_RE = re.compile(r'<a\b[^>]*\bhref\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)


def normalize(url: str) -> str:
    """Strip .html / index / trailing slash to canonical node id. Keeps query off."""
    u = url.split("#", 1)[0].split("?", 1)[0]
    if not u:
        return ""
    if u.endswith("/index.html"):
        u = u[: -len("index.html")]
    if u == "/index.html":
        return "/"
    if u.endswith(".html"):
        u = u[: -len(".html")]
    if len(u) > 1 and u.endswith("/"):
        u = u.rstrip("/")
    return u or "/"


def is_internal(href: str) -> bool:
    h = href.strip()
    if not h:
        return False
    if "${" in h or "{{" in h:  # unrendered JS/template literal, not a real link
        return False
    if h.startswith(("mailto:", "tel:", "viber:", "javascript:", "#", "data:")):
        return False
    if h.startswith("//"):
        return False
    if re.match(r"^https?://", h, re.IGNORECASE):
        return "kafemashini.ch" in h
    return h.startswith("/")


def href_to_path(href: str) -> str:
    h = href.strip()
    h = re.sub(r"^https?://[^/]+", "", h, flags=re.IGNORECASE)
    return h


def raw_path(url: str) -> str:
    """Shipped path minus hash/query/trailing slash. Keeps .html (that's what ships)."""
    u = url.split("#", 1)[0].split("?", 1)[0]
    if len(u) > 1 and u.endswith("/"):
        u = u.rstrip("/")
    return u


def load_redirect_sources(redirects: Path) -> tuple[set[str], list[tuple[str, str]]]:
    """Return (static_sources_raw, wildcard_rules_raw). Sources kept verbatim so a
    link to the canonical extensionless page is NOT mistaken for a redirect source."""
    static: set[str] = set()
    wildcard: list[tuple[str, str]] = []
    if not redirects.exists():
        return static, wildcard
    for line in redirects.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        src = parts[0]
        if "*" in src or ":" in src:
            wildcard.append((src, parts[1]))
        else:
            static.add(raw_path(src))
    return static, wildcard


def wildcard_hits(path: str, wildcard: list[tuple[str, str]]) -> bool:
    for src, _dest in wildcard:
        pattern = re.escape(src).replace(r"\*", ".*").replace(r"\:splat", ".*")
        pattern = re.sub(r"\\:\w+", "[^/]+", pattern)
        if re.fullmatch(pattern, path):
            return True
    return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dist", default=str(REPO / "dist"))
    ap.add_argument("--out", default=str(REPO / "seo/internal-linking/link-map.md"))
    args = ap.parse_args()

    dist = Path(args.dist)
    if not dist.exists():
        print(f"ERROR: {dist} not found. Run `npm run build` first.", file=sys.stderr)
        return 2

    html_files = sorted(dist.glob("**/*.html"))
    # Set of real page nodes that exist in the build.
    nodes: set[str] = set()
    for f in html_files:
        rel = "/" + f.relative_to(dist).as_posix()
        nodes.add(normalize(rel))

    static_redirects, wildcard_redirects = load_redirect_sources(REPO / "public/_redirects")

    outbound: dict[str, list[tuple[str, bool]]] = defaultdict(list)  # page -> [(target, is_chrome)]
    inbound_contextual: dict[str, set[str]] = defaultdict(set)
    inbound_all: dict[str, set[str]] = defaultdict(set)
    redirect_links: list[tuple[str, str]] = []  # (from_page, raw_href)
    broken_links: list[tuple[str, str]] = []

    for f in html_files:
        page = normalize("/" + f.relative_to(dist).as_posix())
        html = f.read_text(encoding="utf-8", errors="replace")
        for raw in HREF_RE.findall(html):
            if not is_internal(raw):
                continue
            path = href_to_path(raw)
            target = normalize(path)
            if not target:
                continue
            is_chrome = target in CHROME_TARGETS
            outbound[page].append((target, is_chrome))
            inbound_all[target].add(page)
            # Editorial inbound: target isn't chrome AND source isn't a structural
            # listing/category page.
            if not is_chrome and not is_structural_source(page):
                inbound_contextual[target].add(page)

            # Redirect / broken detection uses the RAW shipped path (keeps .html),
            # matched against verbatim redirect sources.
            shipped = raw_path(path)
            hits_static = shipped in static_redirects
            hits_wild = wildcard_hits(shipped, wildcard_redirects)
            if hits_static or hits_wild:
                redirect_links.append((page, raw))
            elif target not in nodes and target != "/":
                broken_links.append((page, raw))

    # Orphans: real content pages with 0 contextual inbound. Exclude chrome-only
    # utility pages (legal, 404) from the "problem" list but still report.
    product_nodes = sorted(n for n in nodes if n.startswith("/produkt/"))
    orphans = sorted(
        n for n in nodes
        if not inbound_contextual.get(n) and n not in CHROME_TARGETS and n != "/404"
    )

    # ---- write report ----
    lines: list[str] = []
    lines.append("# Internal Link Map — MACHINE-GENERATED")
    lines.append("")
    lines.append("> Generated by `tools/link_graph.py` from `dist/` build output. **Do not hand-edit.**")
    lines.append("> Re-run after any structural change or content publish:")
    lines.append("> `npm run build && python tools/link_graph.py`")
    lines.append("")
    lines.append(f"- Pages in build: **{len(nodes)}**")
    lines.append(f"- Product pages: **{len(product_nodes)}**")
    lines.append(f"- Contextual (non-chrome) inbound edges tracked across the site.")
    lines.append(f"- Links hitting a redirect (301/302): **{len(redirect_links)}** (should be 0)")
    lines.append(f"- Broken internal links (target not in build): **{len(broken_links)}** (must be 0)")
    lines.append(f"- Orphan content pages (0 contextual inbound): **{len(orphans)}**")
    lines.append("")

    lines.append("## Broken internal links (FIX)")
    if broken_links:
        for pg, href in broken_links:
            lines.append(f"- `{pg}` → `{href}`  (target missing)")
    else:
        lines.append("_none_ ✅")
    lines.append("")

    lines.append("## Links hitting a redirect (replace with canonical target)")
    if redirect_links:
        for pg, href in redirect_links:
            lines.append(f"- `{pg}` → `{href}`")
    else:
        lines.append("_none_ ✅")
    lines.append("")

    lines.append("## Orphan content pages (0 contextual inbound links)")
    lines.append("> Reachable only from global nav/footer. Give each ≥1 in-content/related link.")
    if orphans:
        for n in orphans:
            lines.append(f"- `{n}`")
    else:
        lines.append("_none_ ✅")
    lines.append("")

    lines.append("## Editorial inbound count per product page")
    lines.append("> Inbound from OTHER product/blog/pillar pages (category + /produkti listing links")
    lines.append("> excluded — those are structural). Low = fragile; procedural hubs should lift these.")
    lines.append("")
    lines.append("| Product page | Editorial inbound | From |")
    lines.append("|---|---|---|")
    for n in product_nodes:
        srcs = sorted(inbound_contextual.get(n, set()))
        frm = ", ".join(s for s in srcs) if srcs else "—"
        lines.append(f"| `{n}` | {len(srcs)} | {frm} |")
    lines.append("")

    lines.append("## Full outbound edge list (contextual only, non-chrome)")
    lines.append("")
    for page in sorted(outbound):
        ctx = sorted({t for t, chrome in outbound[page] if not chrome})
        if not ctx:
            continue
        lines.append(f"### `{page}`")
        for t in ctx:
            lines.append(f"- → `{t}`")
        lines.append("")

    Path(args.out).write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {args.out}")
    print(f"  pages={len(nodes)} redirect_links={len(redirect_links)} "
          f"broken={len(broken_links)} orphans={len(orphans)}")
    if broken_links:
        print("FAIL: broken internal links present.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

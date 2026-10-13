#!/usr/bin/env python3
"""Bulgarian keyword demand probe via Google Autocomplete.

Fills the gap left by deferring DataForSEO: a $0, no-auth way to answer
"does this query exist in Bulgaria at all?" before we spend an article on it.

Google only *suggests* a completion once the query clears an internal frequency
threshold, so suggestions are a floor-test on real demand, not a volume number:
  - 8-10 suggestions  -> the term is a live query space, worth targeting
  - 1-3 suggestions   -> thin; the head term exists, long tail doesn't
  - 0 suggestions     -> below threshold. Not proof of zero, but never target
                         a 0-suggestion term as a PRIMARY keyword.

**1 is categorically different from 0.** A seed that returns only itself is a
*recognized* query with no tail (fine as a secondary keyword, or as a primary if
the SERP is weak). A seed returning 0 is not recognized at all. Don't read the
THIN/DEAD boundary as a smooth gradient — that step is the whole signal.

**Latin brand strings leak RU/UA demand even with gl=bg.** `ремонт delonghi
magnifica` scores 10, but the completions are кофемашины / кофемолки / своими
руками / кавомашини — Russian and Ukrainian searchers, not Bulgarian ones. A
Latin model string is language-neutral, and BG is a small share of it. Always
re-probe the **Cyrillic** form (`делонги магнифика`) to measure *Bulgarian*
demand, and eyeball the completions rather than trusting the count. This does not
change on-page practice: the site correctly writes brand names in Latin.

Always probe PREFIXES, not just full phrases: a complete long phrase can return
0 simply because there is nothing left to complete. `--prefix` truncates each
seed to its last N chars removed so you see what Google steers toward instead.

ALWAYS pass controls (`--control`) — terms we know convert (`ремонт на
кафемашини`, `сервиз за кафемашини`). If controls come back empty the endpoint
or the geo params are broken, not the market.

Geo matters: this site is on a `.ch` domain targeting Bulgaria, so hl=bg & gl=bg
are hardcoded. Never read this data with a default locale.

Trust hierarchy (see seo/tools/free-tools-playbook.md): GSC actual impressions >
live SERP check > this > modeled KD. Use it to *kill* bad targets cheaply, then
confirm survivors manually on google.bg in incognito.

Usage:
    python tools/kw_suggest.py "ремонт кафемашина в гаранция" "кафемашина гаран"
    python tools/kw_suggest.py --file seeds.txt --prefix 4
    python tools/kw_suggest.py --seeds-for-draft seo/content/drafts/foo.md
Exit code 1 if every control seed returns 0 (endpoint/geo failure).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ENDPOINT = "https://suggestqueries.google.com/complete/search"
# Terms with proven GSC clicks for this site; used to prove the probe works.
DEFAULT_CONTROLS = ["ремонт на кафемашини", "сервиз за кафемашини", "кафемашини втора ръка"]
UA = "Mozilla/5.0 (compatible; kafemashini-kw-probe/1.0)"


def suggest(query: str, timeout: float = 15.0) -> list[str]:
    """Return Google's BG autocomplete suggestions for `query` ([] if none)."""
    url = f"{ENDPOINT}?" + urllib.parse.urlencode(
        {"client": "firefox", "hl": "bg", "gl": "bg", "q": query}
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))[1]


def seeds_from_draft(path: Path) -> list[str]:
    """Pull primaryKeyword + secondaryKeywords out of a draft's frontmatter."""
    text = path.read_text(encoding="utf-8")
    seeds: list[str] = []
    primary = re.search(r'^primaryKeyword:\s*"?([^"\n]+)"?', text, re.M)
    if primary:
        seeds.append(primary.group(1).strip())
    block = re.search(r"^secondaryKeywords:\s*\n((?:\s*-\s*.+\n)+)", text, re.M)
    if block:
        seeds += [
            line.strip().lstrip("-").strip().strip('"')
            for line in block.group(1).splitlines()
            if line.strip()
        ]
    return seeds


def verdict(n: int) -> str:
    if n >= 8:
        return "LIVE    "
    if n >= 4:
        return "MODERATE"
    if n >= 1:
        return "THIN    "
    return "DEAD    "


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("seeds", nargs="*", help="Seed queries to probe")
    ap.add_argument("--file", type=Path, help="File with one seed per line")
    ap.add_argument("--seeds-for-draft", type=Path, help="Read keywords from a draft's frontmatter")
    ap.add_argument("--prefix", type=int, metavar="N",
                    help="Also probe each seed with its last N chars removed")
    ap.add_argument("--control", action="append", default=None,
                    help="Known-good term to sanity-check the probe (repeatable)")
    ap.add_argument("--delay", type=float, default=0.6, help="Seconds between calls")
    args = ap.parse_args()

    seeds = list(args.seeds)
    if args.file:
        seeds += [ln.strip() for ln in args.file.read_text(encoding="utf-8").splitlines() if ln.strip()]
    if args.seeds_for_draft:
        seeds += seeds_from_draft(args.seeds_for_draft)
    if not seeds:
        ap.error("no seeds given")

    if args.prefix:
        seeds += [s[: -args.prefix] for s in list(seeds) if len(s) > args.prefix + 3]

    controls = args.control if args.control is not None else DEFAULT_CONTROLS
    controls = [c for c in controls if c.strip()]  # an empty control would false-trip the guard
    control_hits = 0

    for label, group in (("SEEDS", seeds), ("CONTROLS", controls)):
        if not group:
            continue
        print(f"\n{'=' * 66}\n{label}\n{'=' * 66}")
        for seed in group:
            try:
                out = suggest(seed)
            except (urllib.error.URLError, OSError, ValueError) as exc:
                print(f"  ERROR  {seed!r}: {exc}")
                continue
            if label == "CONTROLS":
                control_hits += len(out)
            print(f"\n{verdict(len(out))} [{len(out):2d}]  {seed}")
            for s in out:
                print(f"            {s}")
            time.sleep(args.delay)

    if controls and control_hits == 0:
        print("\nFAIL: every control returned 0 — endpoint or geo params are broken, "
              "not the market. Do not conclude anything about the seeds.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

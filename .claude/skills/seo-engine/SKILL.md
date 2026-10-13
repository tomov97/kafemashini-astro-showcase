---
name: seo-engine
description: >
  Automated SEO content engine for kafemashini.ch. Produces, reviews, and publishes
  Bulgarian topic-cluster content (procedural hubs, repair/buying articles) with
  built-in internal linking, schema, and the owner review gate. Drives the strategy
  in seo/strategy.md. Subcommands: next (draft the next queued piece), publish
  (ship an owner-approved draft), status (queue state). Triggers on: "seo engine",
  "next article", "publish article", "content engine", "write the next post".
user-invokable: true
argument-hint: "next | publish <slug> | status"
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, WebFetch, WebSearch
metadata:
  project: kafemashini.ch
  version: 1
---

# SEO Content Engine — kafemashini.ch

The repeatable idea→published→interlinked pipeline. One owner gate (editing the draft
file). Everything else is automated. This skill IS the automation the campaign was
built toward. Read `seo/strategy.md` §2–7 before first use; the model below is its
execution arm.

## The model in one paragraph
The **service page** (`/serviz-na-kafe-mashini`) and a **buying-guide pillar** are the
money pages. They rank by becoming hubs of topic clusters: informational articles link
UP to them with keyword anchors (passing equity + proving topical authority), and
**procedural hubs** (descale/clean per brand) link DOWN to many product pages (spreading
internal PageRank to lift thin/unindexed products). The 4.6★/147-review GBP supplies
local-pack muscle. We win on **content existence + internal linking**, not on out-gunning
national retailers' backlinks. See `seo/strategy.md`.

## Hard rules (never violate)
- **Bulgarian only.** All copy, headings, alt text, FAQ, schema labels. Cover spelling
  variants naturally (`кафемашина`/`кафе машина`/`кафеавтомат`) — see `seo/keywords/bulgarian-gotchas.md`.
- **Facts only the shop knows are OWNER-SUPPLIED.** Never invent repair prices, timeframes,
  or shop-specific procedures. Mark them `⟨OWNER: …⟩` in the draft for the owner to fill.
- **Warranty = 12 месеца. Parts = "нови части" (never "оригинални"). No self-AggregateRating.**
- **Extensionless internal links only** (`/produkt/x`, never `/produkt/x.html`). Money-page
  anchors keyword-bearing but varied — no exact-match repetition (over-optimization).
- **Quality-gated cadence, never thin filler.** If ≥2 drafts sit unreviewed, `next` refuses.
- **Confidence + falsifiers** on any ranking claim (project rule). Don't declare single causes.

## Command-center files this skill reads/writes
| File | Role |
|---|---|
| `seo/content/content-calendar.md` | the queue; pick the top undone item |
| `seo/content/clusters.md` | build order + cluster structure |
| `seo/content/brand-voice.md` | voice rules + corrections log (grows each cycle) |
| `seo/content/pipeline.md` | the canonical step list (this skill implements it) |
| `seo/content/briefs/{slug}.md` | per-article brief (created by `next`) |
| `seo/content/drafts/{slug}.md` | the review artifact (created by `next`, edited by owner) |
| `seo/content/drafts/.originals/{slug}.md` | pristine copy for the edit-diff (voice learning) |
| `seo/keywords/keyword-map.md` | keyword→page targeting; fill rows as pieces ship |
| `seo/internal-linking/linking-plan.md` | link rules + edge log |
| `seo/internal-linking/link-map.md` | MACHINE-GENERATED graph (via `tools/link_graph.py`) |
| `seo/CHANGELOG.md` | append action log |
| `src/content/blog/{slug}.md` | the published post (created by `publish`) |
| `data/products.json` | `relatedSlugs` for down-links |

---

## `/seo-engine next` — draft the next queued piece

1. **Backlog guard.** Count files in `seo/content/drafts/` (excluding `.originals/`). If ≥2
   awaiting review, STOP: report which drafts are pending and that cadence is quality-gated.
2. **Pick.** Read `seo/content/content-calendar.md`; take the top row with status `☐`
   (respect `clusters.md` build order). If the calendar is empty, propose the next piece
   from `seo/strategy.md` §3 and ask the owner to confirm before drafting.
3. **Brief.** Write `seo/content/briefs/{slug}.md` from the template in `pipeline.md`. Pull
   the primary/secondary keywords from `seo/keywords/keyword-map.md` (verified GSC queries
   are the backbone). Decide cluster, pillar, links up/down.
4. **Light research (5 min, optional).** If useful, `WebFetch` 1–2 pages that rank for the
   primary keyword to note structure (FAQ? table? word count?) — structure only, never copy.
   Do NOT do a heavy research wave; this is a micro-niche BG market (see `PHASE-2-START.md`).
5. **Draft.** Write the full Bulgarian article to `seo/content/drafts/{slug}.md` with:
   - **Owner-checklist header** (see template below): 3–5 `google.bg` spot-check queries + the
     shop facts to verify/fill (`⟨OWNER: …⟩` markers).
   - **Frontmatter** matching the blog collection schema (`src/content.config.ts`): title,
     description (≤160 chars, keyword-bearing), publishDate (today), cluster, pillar,
     primaryKeyword, secondaryKeywords, directAnswer (~200 chars/words), faqs (6+), 
     relatedProducts (slugs to link down to), draft: false.
   - **Body** per `brand-voice.md`: direct-answer opener → question-form H2s → concrete
     specifics (prices/timeframes/model names) → natural in-content links UP to the pillar
     and DOWN to products (varied anchors) → soft CTA is auto-rendered by the template.
   - **Structure for AI citation** (free byproduct): self-contained sections, question H2s,
     specific numbers. See `seo/strategy.md` §6.
6. **Save pristine copy** to `seo/content/drafts/.originals/{slug}.md` (byte copy) for the
   later edit-diff.
7. **Report**: the slug, the owner checklist, and "edit the draft then run `/seo-engine publish {slug}`".
   Also surface the **keyword provenance** — for the primary and each secondary keyword, say whether
   it is a GSC-verified query, a `keyword-map.md` entry, or a term you inferred, and flag it plainly
   if the primary is not GSC-verified. Keyword choice is the thing most likely to be wrong and the
   owner reviews it. This runs interactively, so just report in the session; there is no cron.

**Draft file template** (`seo/content/drafts/{slug}.md`):
```md
<!-- ═══════════ OWNER REVIEW CHECKLIST — delete this block before it matters ═══════════
SPOT-CHECK THESE ON google.bg (incognito), confirm we can realistically compete:
  - <query 1>
  - <query 2>
  - <query 3>
VERIFY / FILL (facts only the shop knows — search for ⟨OWNER: …⟩ below):
  - <e.g. real price range for a Saeco descale service>
  - <e.g. typical turnaround time>
When done: edit freely to your voice, then tell Claude:  /seo-engine publish <slug>
════════════════════════════════════════════════════════════════════════════════════ -->
---
title: "..."
description: "..."
publishDate: 2026-07-15
cluster: hub          # repair | buying | hub
pillar: /serviz-na-kafe-mashini
primaryKeyword: "..."
secondaryKeywords: ["...", "..."]
directAnswer: "..."
faqs:
  - q: "..."
    a: "..."
relatedProducts: ["saeco-...", "saeco-..."]
draft: false
---

<article body in Bulgarian markdown, with ⟨OWNER: …⟩ markers where shop facts go>
```

---

## `/seo-engine publish <slug>` — ship an owner-approved draft

Precondition: the owner has edited `seo/content/drafts/{slug}.md` and there are no unresolved
`⟨OWNER: …⟩` markers. If any remain, STOP and list them.

1. **Learn the voice.** Diff `seo/content/drafts/{slug}.md` against
   `seo/content/drafts/.originals/{slug}.md`. Distill the owner's edits (word choices, tone,
   removed fluff) into the **corrections log** in `seo/content/brand-voice.md`. This is how
   drafts converge on the owner's voice — do it every publish, even for small edits.
2. **Convert** the draft → `src/content/blog/{slug}.md`: strip the owner-checklist HTML
   comment, keep the frontmatter + body. Validate frontmatter against `src/content.config.ts`.
3. **Interlink** (enforce `linking-plan.md` rules):
   - Ensure ≥1 in-content link UP to the pillar with a keyword-bearing anchor.
   - For a **procedural hub**: `relatedProducts` must list the products it covers (the template
     auto-renders down-links); also add ≥1 inbound link TO the hub from the relevant brand
     category page (`src/pages/kafe-mashini/[brand].astro` intro copy) or the service page, so
     the hub isn't an orphan.
   - If the piece should surface on specific product pages, add its slug consideration to those
     products' context (only if natural).
   - Append every new edge to the edge log in `seo/internal-linking/linking-plan.md`.
4. **Buying pillar bootstrap** (only when publishing piece #4, the buying guide): it's a *page*,
   not a post — create `src/pages/kak-da-izberete-upotrebyavana-kafemashina.astro` on BaseLayout
   (mirror the service page's structure: H1, sections, FAQ+FAQPage schema, BreadcrumbList). Then
   repair-cluster comparison articles can set it as `pillar`.
5. **First-publish only** (no posts existed before): nothing else needed — `blog.astro` and the
   sitemap filter already auto-flip once a non-draft post exists. Verify the index de-noindexes.
6. **Build + verify** (see Verification below). Fix anything red before committing.
7. **Log**: append to `seo/CHANGELOG.md`; tick the row in `seo/content/content-calendar.md`;
   fill the mapped rows in `seo/keywords/keyword-map.md`.
8. **Clear the queue.** `git rm` BOTH `seo/content/drafts/{slug}.md` and
   `seo/content/drafts/.originals/{slug}.md`. Their only purposes — owner review and the step-1
   voice diff — are now spent. **This is not optional:** the backlog guard counts files in
   `seo/content/drafts/`, so a draft left behind after publishing permanently inflates the count
   and eventually wedges `next` at its ≥2 refusal threshold. (This is exactly what happened to
   `kak-se-dekalcira-saeco`, published 2026-07-16 and still queued until 2026-08-03.)
9. **Ship**: `git add` the changed files, commit (Co-Authored-By trailer), push to `master`.
   Cloudflare Pages auto-deploys. Optionally submit the URL in GSC / Bing IndexNow.

---

## `/seo-engine status`
Report: calendar queue (done / next / remaining), drafts awaiting review (files in
`seo/content/drafts/`), published post count (`src/content/blog/*.md`), and the current
`link-map.md` health line (orphans / broken / redirect-hitting).

---

## Verification (run before every publish commit)
```bash
npm run build                                   # must pass
python tools/link_graph.py                      # orphans/broken/redirect-hitting = 0
```
Then confirm in `dist/`:
- New post at `dist/blog/{slug}.html`: single `<h1>`, extensionless canonical, meta
  description, og tags, `Article` + `FAQPage` + `BreadcrumbList` JSON-LD present.
- Post appears in `dist/sitemap-0.xml`; `/blog` index no longer noindexed.
- Every internal link in the post resolves to a canonical 200 (link_graph reports 0 issues).
- (Live, post-deploy) Rich Results Test on the URL; GSC URL inspection/submit.

## Quality gate (from pipeline.md — all must be true to publish)
- [ ] Answers the query in the first screen (directAnswer + opener).
- [ ] Genuine first-hand specifics; passes "could any generic site have written this?".
- [ ] ≥1 link up to a pillar + relevant down-links to products, varied anchors.
- [ ] FAQ + schema valid.
- [ ] On brand voice; owner-approved (no `⟨OWNER⟩` markers left).

## Notes for the operating session
- Run GSC/analytics pulls in a subagent to keep context clean (data-discipline rule).
- Don't re-investigate migration indexation; `.html` zombies drain on Google's clock.
- July 2026 GSC data is noisy (June core update rollout to ~mid-July) — don't read
  short-term rank movement as signal until August.

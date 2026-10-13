# tools/seo-api/ — Google SEO API scripts

The five scripts we actually use, kept from the third-party `claude-seo` pack when the rest of it was
removed on 2026-07-30 (see `docs/seo-skills-verdict-2026-05-13.md` Part 2 for the removal record).
Status and evidence for each live in `seo/tools/skills-status.md`.

| Script | What it does |
|---|---|
| `google_auth.py` | OAuth + config loader shared by the others. `--check` reports the credential tier. |
| `gsc_query.py` | GSC Search Analytics — clicks, impressions, CTR, position by page/query/date. |
| `gsc_inspect.py` | GSC URL Inspection — per-URL index state, single or `--batch`. |
| `ga4_report.py` | GA4 Data API — organic sessions and landing pages. |
| `crux_history.py` | CrUX field Core Web Vitals, 25-week history. Origin-level data exists for this site. |

All five import `google_auth` as a sibling, so **keep them in the same directory**.

## Config

Lives outside the repo at `~/.config/claude-seo/` — `google-api.json` (default property, GA4 property
id, `oauth_client_path`) and `oauth-token.json`. The path is hardcoded in `google_auth.py`; don't
rename that directory. The PSI/CrUX API key comes from the `GOOGLE_API_KEY` env var, not the config
file.

```bash
pip install -r tools/seo-api/requirements.txt
```

## Re-auth

Refresh tokens die if the OAuth consent screen ever drops back to "Testing" (7-day expiry). The app is
published to production, but if a pull fails with `invalid_grant`:

```bash
python tools/seo-api/google_auth.py --auth --creds "C:\Users\tomov\.config\kafemashini-seo\client_secret.json"
```

## Data-trust rule

**For totals, query with the `date` dimension, not `page` or `query`.** GSC's page/query-dimension
responses are filtered and anonymised, so summing their rows undercounts. `gsc_query.py --limit` is a
*page size*, not a total row cap — a small `--limit` issues many paginated calls rather than returning
few rows.

Verified against the GSC UI on 2026-06-30 (two windows, clicks and impressions matched).

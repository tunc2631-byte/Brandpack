# PackFactory SEO workflow

This is a static GitHub Pages site. `main:/` publishes to `https://pack-factory.de/`.
Feature branches and pull requests are the review boundary. Do not merge or push
to `main` without the owner's first-release approval. The first implementation
is on `codex/seo-system-2026-09-19`.

## Run

Use Python 3.12 and a virtual environment:

```sh
python -m pip install -r tools/seo/requirements.txt
python -m unittest discover -s tools/seo -p 'test_*.py'
python tools/seo/seo.py check --out ../seo-private/check
python tools/seo/seo.py audit --out ../seo-private/live
python tools/seo/seo.py gsc --history --inspect --out ../seo-private/baseline
python tools/seo/seo.py run --out ../seo-private/weekly
```

`check` is offline and exits nonzero on SEO regressions. `audit` reads live pages;
`gsc` reads Search Console; `run` combines these and generates a report and
opportunity list. Use a NEW dated output directory per run. `--history` requests
16 calendar months; `--inspect` checks the 21 sitemap URLs. GSC uses final web
search data with a three-day buffer and exact, non-overlapping 28-day windows.
The previous-year comparison is shifted 364 days to align weekdays. Empty
periods mean missing data, not measured zero performance. Query anonymization,
API top-row limits and subdomains in a domain property must be considered.

Credentials are read from `PACKFACTORY_GSC_KEY`, or the existing
`~/.credentials/packfactory-seo/service-account.json`. The new client requests
only the `webmasters.readonly` scope. Never copy credentials to this repository.
Retries and request timeouts are bounded; errors are recorded without response
bodies or credential values. A failed run exits with code 2.

**This repository and its Pages source are public.** Keep Search Console exports,
conversion records, margins, customer information and monitoring logs OUTSIDE
the checkout. The CLI refuses to write reports inside it. Do not upload those
reports as public Actions artifacts or paste them into public pull requests.

## Data → review → release → observation

1. Fetch final Search Console data and live technical checks.
2. Review `opportunities.json` alongside intent, actual offering, margin and
   capacity. Its transparent score is triage, not forecast traffic or revenue.
3. Use `data/product-evidence.json` as evidence inventory. It records original
   public source, source hash, specifications and open verification questions.
   Extraction does NOT constitute supplier certification or owner approval.
4. Use `data/catalog.json` for catalogue cards. After editing, run
   `python tools/seo/build_catalog.py`. Commit both source and generated HTML;
   tests detect drift. Hero cards must also be reviewed if those products change.
5. Prepare a feature branch. Run tests, inspect desktop/mobile and configurators.
6. Open a pull request. `SEO checks` runs automatically on the initial feature
   branch and PRs against main. It needs no secrets and never deploys. It is a
   check, not an enforced branch protection rule.
7. Owner reviews concrete changes. Merge only after approval; GitHub Pages then
   publishes automatically. Record the deployed SHA and verified timestamp in a
   private release log and re-check the live pages.
8. Compare periods after 2–4 weeks and again after 8–12 weeks. Avoid attributing
   every change to the deployment. Note seasonality, indexing and other changes.

## Content drafting rules

Every new factual product statement needs a source and review status. Do not
resolve conflicting prices, tax treatment, materials, delivery times or
environmental claims by guessing. Do not create invented certifications,
reviews, customer examples, ranking promises or unsupported stock availability.
For each brief, identify one primary page per search intent, the customer's
decision, evidence-backed facts, missing facts, internal links and quote CTA.
Drafts remain in a branch; never auto-publish AI content.

Current structured data is Organization and BreadcrumbList only. Product offers
and ratings are intentionally deferred until price/variant/terms evidence is
approved. The current cart collects WhatsApp/email quote requests, not payments.
Merchant Center requires a qualifying direct purchase process; do not create a
feed or claim eligibility merely because prices appear on these pages.

## Measurement and automations

The scripts are manually runnable. The initial setup also schedules local Codex
tasks for daily technical monitoring, weekly Search Console reporting and
monthly reassessment. Their actual IDs/status and local paths are documented in
the private delivery report, not this public repository. Local scheduled work
depends on the computer/app being available; it is not a cloud service. GitHub
PR checks run independently of the laptop after the branch is pushed.

No GA4/GTM or other conversion collector was found in the checked site source.
This does not prove no external account exists. Formspree accepts the contact
form, but no backend reporting access was established. WhatsApp/mail/telephone
clicks are microconversions, form acceptance is an unqualified lead, qualified
leads need business validation, and orders/profit need sales records. Do not
report clicks or cart additions as completed inquiries or revenue.

## Alert policy

Daily technical alerts: new HTTP failure, noindex, wrong canonical, broken
internal target, vanished product links or malformed structured data. Retry a
transient network error once before escalating. Compare with the previous
snapshot so existing unresolved defects are not announced every day.

Weekly declines: flag a 28-day click loss of at least 30% AND at least 10 clicks,
or an impression loss of at least 40% AND at least 100 impressions. These are
investigation thresholds, not statistical significance or proof of causation.
Check completeness, devices, country, page and brand/non-brand splits first.
Monthly: re-check indexing, margins/capacity if supplied, intent overlap,
conversion evidence, product claims and the priorities for the next month.

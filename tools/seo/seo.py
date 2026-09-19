"""Read-only SEO monitoring. Private results MUST be outside the public website repo."""
from __future__ import annotations
import argparse
import calendar
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urljoin, urlparse, unquote
import xml.etree.ElementTree as ET
from urllib.robotparser import RobotFileParser

from bs4 import BeautifulSoup
import requests

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = 'https://pack-factory.de'
PROPERTY = 'sc-domain:pack-factory.de'
BRAND_RE = re.compile(r'\bpack[\s-]*factory\b', re.I)

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

def urls():
    return [x.text for x in ET.parse(ROOT / 'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]

def local_path(url):
    p = ROOT / unquote(urlparse(url).path).lstrip('/')
    return p / 'index.html' if p.is_dir() else p

def parse_page(html, url):
    soup = BeautifulSoup(html, 'html.parser')
    desc = soup.find('meta', attrs={'name': 'description'})
    canonical = soup.find_all('link', rel='canonical')
    schemas, errors = [], []
    for s in soup.find_all('script', type='application/ld+json'):
        try:
            schemas.append(json.loads(s.string or s.get_text()))
        except (ValueError, TypeError):
            errors.append('invalid_json_ld')
    links = sorted(set(urljoin(url, a['href']).split('#')[0] for a in soup.select('a[href]')
                       if a['href'] and not a['href'].startswith(('mailto:', 'tel:', 'javascript:'))))
    return dict(title=soup.title.get_text(' ', strip=True) if soup.title else '',
                description=desc.get('content', '') if desc else '',
                h1=[h.get_text(' ', strip=True) for h in soup.find_all('h1')],
                canonicals=[c.get('href') for c in canonical], schemas=schemas,
                robots=[m.get('content', '') for m in soup.select('meta[name="robots"]')],
                links=links, missing_alt=len(soup.select('img:not([alt])')),
                errors=errors, html_bytes=len(html.encode('utf-8')))

def audit(live=False):
    records = []
    site_checks = {'errors': []}
    try:
        robots_text = (ROOT/'robots.txt').read_text(encoding='utf-8')
        if live:
            r = requests.get(ORIGIN+'/robots.txt', timeout=30)
            site_checks['robots_status'] = r.status_code
            robots_text = r.text if r.status_code == 200 else ''
            if r.status_code not in (200,404): site_checks['errors'].append('robots_http_error')
            sm = requests.get(ORIGIN+'/sitemap.xml', timeout=30)
            site_checks['sitemap_status'] = sm.status_code
            if sm.status_code != 200: site_checks['errors'].append('sitemap_http_error')
            else:
                found = [x.text for x in ET.fromstring(sm.content).iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
                site_checks['sitemap_urls'] = found
                if not found: site_checks['errors'].append('empty_sitemap')
        robot = RobotFileParser()
        robot.parse(robots_text.splitlines())
        site_checks['blocked_urls'] = [u for u in urls() if not robot.can_fetch('Googlebot',u)]
        if site_checks['blocked_urls']: site_checks['errors'].append('robots_blocks_pages')
    except Exception as e:
        site_checks['errors'].append('robots_or_sitemap_failed:'+type(e).__name__)
    for url in urls():
        entry = {'url': url}
        try:
            html = local_path(url).read_text(encoding='utf-8')
            if live:
                r = requests.get(url, timeout=30)
                r.encoding = 'utf-8'
                entry.update(status=r.status_code, final_url=r.url,
                             redirects=[{'status': h.status_code, 'url': h.url} for h in r.history],
                             x_robots_tag=r.headers.get('X-Robots-Tag', ''),
                             source_matches_checkout=r.text.replace('\r\n','\n') == html.replace('\r\n','\n'))
                html = r.text
            entry.update(parse_page(html, url))
            problems = entry['errors']
            if not entry['title']: problems.append('missing_title')
            if not entry['description']: problems.append('missing_description')
            if len(entry['h1']) != 1: problems.append('h1_count')
            if entry['canonicals'] != [url]: problems.append('canonical_missing_or_wrong')
            if 'noindex' in ' '.join(entry['robots']).lower() or 'noindex' in entry.get('x_robots_tag', '').lower(): problems.append('noindex')
            if live and entry.get('status') != 200: problems.append('http_status')
            if not live:
                entry['broken_internal_links'] = [u for u in entry['links'] if urlparse(u).netloc == urlparse(ORIGIN).netloc and not local_path(u).exists()]
                if entry['broken_internal_links']: problems.append('broken_internal_links')
        except Exception as e:
            entry['errors'] = ['fetch_or_parse_failed:' + type(e).__name__]
        records.append(entry)
    for field in ('title', 'description'):
        values = {}
        for row in records:
            if row.get(field): values.setdefault(row[field], []).append(row)
        for group in values.values():
            if len(group) > 1:
                for row in group: row['errors'].append('duplicate_' + field)
    home = next(r for r in records if r['url'] == ORIGIN + '/')
    expected = {u for u in urls() if '/produkte/' in u}
    home['missing_product_links'] = sorted(expected - set(home.get('links', [])))
    if home['missing_product_links']: home['errors'].append('products_not_linked_in_html')
    return {'checked_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'mode': 'live' if live else 'local', 'site_checks': site_checks, 'pages': records}

def shift_months(date, months):
    month = date.year * 12 + date.month - 1 + months
    y, m = divmod(month, 12)
    return dt.date(y, m+1, min(date.day, calendar.monthrange(y, m+1)[1]))

def gsc_export(out, history=False, inspect=False):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    import httplib2
    import google_auth_httplib2
    key = Path(os.environ.get('PACKFACTORY_GSC_KEY', '~/.credentials/packfactory-seo/service-account.json')).expanduser()
    creds = service_account.Credentials.from_service_account_file(str(key), scopes=['https://www.googleapis.com/auth/webmasters.readonly'])
    client = build('searchconsole', 'v1', http=google_auth_httplib2.AuthorizedHttp(creds, http=httplib2.Http(timeout=45)), cache_discovery=False)
    # Three-day buffer plus final-only data avoids treating incomplete recent days as declines.
    end = dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=3)
    latest_start = end - dt.timedelta(days=27)
    prev_end = latest_start - dt.timedelta(days=1)
    periods = {'current28': (latest_start, end), 'previous28': (prev_end-dt.timedelta(days=27), prev_end),
               'year_ago28': (latest_start-dt.timedelta(days=364), end-dt.timedelta(days=364))}
    sites = client.sites().list().execute(num_retries=3).get('siteEntry', [])
    match = next((s for s in sites if s['siteUrl'] == PROPERTY), None)
    if not match: raise RuntimeError('Requested Search Console property unavailable')
    result = {'property': PROPERTY, 'access': match['permissionLevel'], 'fetched_at': dt.datetime.now(dt.timezone.utc).isoformat(),
              'periods': {}, 'limitations': ['Final data only; last three days excluded.', 'Query rows omit anonymized queries; do not sum them to reproduce totals.',
              'API returns top rows, not guaranteed exhaustive data even with pagination.', 'Domain property includes subdomains.', 'Impressions are not market search volume.'], 'errors': []}
    def query(start, end, dimensions):
        rows, offset = [], 0
        while True:
            body = dict(startDate=str(start), endDate=str(end), dimensions=dimensions,
                        type='web', dataState='final', rowLimit=25000, startRow=offset)
            part = client.searchanalytics().query(siteUrl=PROPERTY, body=body).execute(num_retries=3).get('rows', [])
            rows.extend(part)
            if len(part) < 25000: break
            offset += 25000
        return rows
    for name, (start, finish) in periods.items():
        item = {'start': str(start), 'end': str(finish), 'days': (finish-start).days+1}
        for name_dim, dims in [('totals', []), ('date',['date']), ('page',['page']), ('query',['query']),
                               ('query_page',['query','page']), ('device',['device']), ('country',['country'])]:
            item[name_dim] = query(start, finish, dims)
        result['periods'][name] = item
        write(out / 'gsc.json', result)
    if history:
        start = shift_months(end, -16) + dt.timedelta(days=1)
        result['history'] = {'start': str(start), 'end': str(end), 'date': query(start, end, ['date']),
                             'page': query(start, end, ['page']), 'query': query(start, end, ['query']),
                             'device': query(start, end, ['device']), 'country': query(start, end, ['country'])}
    result['sitemaps'] = client.sitemaps().list(siteUrl=PROPERTY).execute(num_retries=3)
    if inspect:
        result['inspection'] = []
        for url in urls():
            try:
                response = client.urlInspection().index().inspect(body={'inspectionUrl':url, 'siteUrl':PROPERTY, 'languageCode':'de-DE'}).execute(num_retries=3)
                result['inspection'].append({'url':url, 'result':response.get('inspectionResult', {})})
            except Exception as e:
                result['errors'].append({'url':url, 'error':type(e).__name__})
    write(out / 'gsc.json', result)
    return result

def opportunities(data):
    rows = data['periods']['current28']['query_page']
    result = []
    for r in rows:
        q, url = r['keys']
        brand = bool(BRAND_RE.search(q))
        relevant = re.search(r'bedruck|logo|döner|doener|burger|einschlag|becher|schale|bowl|tüte|tuete|pommessch|kuchenbox|baklava', q, re.I)
        if brand or not relevant or r['impressions'] < 10 or urlparse(url).netloc != 'pack-factory.de': continue
        # Transparent triage heuristic, NOT a prediction of traffic or revenue.
        score = r['impressions'] * (1-r['ctr']) / max(r['position'], 1)
        result.append(dict(query=q, url=url, clicks=r['clicks'], impressions=r['impressions'],
                           ctr=r['ctr'], position=r['position'], priority_score=round(score,2),
                           rationale='Non-brand, at least 10 impressions; rank/access/content must be reviewed. Margin unknown.'))
    return sorted(result, key=lambda r:r['priority_score'], reverse=True)

def report(out, data=None):
    lines = ['# PackFactory SEO-Monitor', '', f'Stand: {dt.datetime.now(dt.timezone.utc).isoformat()}', '',
             'Conversions: nicht verbunden. Kontaktklicks sind keine bestätigten Anfragen oder Bestellungen.', '']
    for name in ('audit-live.json', 'audit-local.json'):
        p = out/name
        if p.exists():
            a = json.loads(p.read_text(encoding='utf-8'))
            lines += [f'## {a["mode"]}: technische Prüfung', '', f'{len(a["pages"])} Seiten geprüft.', '']
            lines += [f'- Website: {error}' for error in a.get('site_checks',{}).get('errors',[])]
            lines += [f'- {r["url"]}: {", ".join(r["errors"])}' for r in a['pages'] if r['errors']]
    if data:
        lines += ['', '## Search Console', '', '| Zeitraum | Klicks | Impressionen | CTR | Position |', '|---|---:|---:|---:|---:|']
        for name,p in data['periods'].items():
            r = p['totals'][0] if p['totals'] else None
            lines.append(f'| {name}: {p["start"]} bis {p["end"]} | '+(f'{r["clicks"]:g} | {r["impressions"]:g} | {r["ctr"]:.2%} | {r["position"]:.1f} |' if r else 'keine Daten | — | — | — |'))
        current=data['periods']['current28']
        lines += ['', '### Sichtbare Suchanfragen: Marke / ohne Marke', '']
        for label, branded in [('Marke', True), ('Ohne Marke', False)]:
            group=[r for r in current['query'] if bool(BRAND_RE.search(r['keys'][0])) == branded]
            lines.append(f'- {label}: {sum(r["clicks"] for r in group):g} Klicks / {sum(r["impressions"] for r in group):g} Impressionen. Nur sichtbare Query-Zeilen.')
        for dim in ['device','country']:
            lines += ['', '### '+dim, '']
            for r in current[dim][:8]:
                lines.append(f'- {r["keys"][0]}: {r["clicks"]:g} Klicks, {r["impressions"]:g} Impressionen, CTR {r["ctr"]:.2%}, Position {r["position"]:.1f}')
        groups={}
        for r in current['query_page']:
            groups.setdefault(r['keys'][0],[]).append(r)
        collisions={q:rs for q,rs in groups.items() if len({r['keys'][1] for r in rs})>1 and sum(r['impressions'] for r in rs)>=10}
        write(out/'query-page-overlap.json',collisions)
        lines += ['', f'Suchanfragen mit mehreren Zielseiten und mindestens 10 Impressionen: {len(collisions)}. Prüfsignal, kein automatischer Nachweis von Kannibalisierung.']
        opp = opportunities(data)
        write(out/'opportunities.json', opp)
        lines += ['', '## Prüfkandidaten (keine Umsatzprognose)', '']
        for r in opp[:15]:
            lines.append(f'- {r["query"]}: {r["impressions"]:g} Impressionen, {r["clicks"]:g} Klicks, Position {r["position"]:.1f}; {r["url"]}')
        lines += ['', 'Anonymisierte Suchanfragen fehlen; kleine Fallzahlen nicht überinterpretieren. Vorjahresvergleich um 364 Tage versetzt für gleiche Wochentage. Änderungen und Sichtbarkeit erlauben allein keine kausale Aussage.']
    (out/'report.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['check','audit','gsc','run'])
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--history', action='store_true')
    parser.add_argument('--inspect', action='store_true')
    args = parser.parse_args()
    out = args.out.resolve()
    if out == ROOT or ROOT in out.parents:
        parser.error('Reports must be outside the public website repository.')
    out.mkdir(parents=True, exist_ok=True)
    data = None
    try:
        if args.command in ('check','run'):
            local = audit()
            write(out/'audit-local.json', local)
        if args.command in ('audit','run'):
            write(out/'audit-live.json', audit(live=True))
        if args.command in ('gsc','run'):
            data = gsc_export(out, args.history, args.inspect)
        report(out, data)
        if args.command == 'check' and (any(p['errors'] for p in local['pages']) or local['site_checks']['errors']):
            return 1
    except Exception as e:
        # Never log credential contents or response bodies.
        write(out/'error.json', {'at':dt.datetime.now(dt.timezone.utc).isoformat(), 'stage':args.command, 'error_type':type(e).__name__})
        print(f'Failed: {type(e).__name__}; see error.json', file=sys.stderr)
        return 2
    print(str(out/'report.md'))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())

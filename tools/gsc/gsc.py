#!/usr/bin/env python
"""
Google Search Console data fetcher for pack-factory.de.

Uses a service account (key kept outside this repo, in
~/.credentials/packfactory-seo/service-account.json) that has been
added as a user on the Search Console property.

Usage:
  python gsc.py queries [--days 28] [--limit 25]
  python gsc.py pages   [--days 28] [--limit 25]
  python gsc.py devices [--days 28]
  python gsc.py inspect <url>
"""
import argparse
import datetime
import json
import os
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build

SITE_URL = "sc-domain:pack-factory.de"
KEY_PATH = os.path.expanduser("~/.credentials/packfactory-seo/service-account.json")
SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]


def get_credentials():
    if not os.path.exists(KEY_PATH):
        sys.exit(f"Service account key not found at {KEY_PATH}")
    return service_account.Credentials.from_service_account_file(KEY_PATH, scopes=SCOPES)


def search_analytics(dimensions, days, limit):
    creds = get_credentials()
    service = build("searchconsole", "v1", credentials=creds)
    end = datetime.date.today() - datetime.timedelta(days=2)  # GSC data lags ~2 days
    start = end - datetime.timedelta(days=days)
    body = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "dimensions": dimensions,
        "rowLimit": limit,
    }
    resp = service.searchanalytics().query(siteUrl=SITE_URL, body=body).execute()
    return resp.get("rows", []), start, end


def cmd_queries(args):
    rows, start, end = search_analytics(["query"], args.days, args.limit)
    print(f"Top Suchanfragen ({start} bis {end}):\n")
    print(f"{'Suchanfrage':<40} {'Klicks':>7} {'Impr.':>7} {'CTR':>8} {'Position':>9}")
    for r in rows:
        q = r["keys"][0]
        print(f"{q:<40} {r['clicks']:>7} {r['impressions']:>7} {r['ctr']*100:>7.2f}% {r['position']:>9.1f}")


def cmd_pages(args):
    rows, start, end = search_analytics(["page"], args.days, args.limit)
    print(f"Top Seiten ({start} bis {end}):\n")
    print(f"{'URL':<60} {'Klicks':>7} {'Impr.':>7} {'CTR':>8} {'Position':>9}")
    for r in rows:
        p = r["keys"][0]
        print(f"{p:<60} {r['clicks']:>7} {r['impressions']:>7} {r['ctr']*100:>7.2f}% {r['position']:>9.1f}")


def cmd_devices(args):
    rows, start, end = search_analytics(["device"], args.days, 10)
    print(f"Nach Gerät ({start} bis {end}):\n")
    print(f"{'Gerät':<12} {'Klicks':>7} {'Impr.':>7} {'CTR':>8} {'Position':>9}")
    for r in rows:
        d = r["keys"][0]
        print(f"{d:<12} {r['clicks']:>7} {r['impressions']:>7} {r['ctr']*100:>7.2f}% {r['position']:>9.1f}")


def cmd_inspect(args):
    creds = get_credentials()
    service = build("searchconsole", "v1", credentials=creds)
    body = {"inspectionUrl": args.url, "siteUrl": SITE_URL}
    resp = service.urlInspection().index().inspect(body=body).execute()
    print(json.dumps(resp, indent=2, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_q = sub.add_parser("queries", help="Top Suchanfragen (query dimension)")
    p_q.add_argument("--days", type=int, default=28)
    p_q.add_argument("--limit", type=int, default=25)
    p_q.set_defaults(func=cmd_queries)

    p_p = sub.add_parser("pages", help="Top Seiten (page dimension)")
    p_p.add_argument("--days", type=int, default=28)
    p_p.add_argument("--limit", type=int, default=25)
    p_p.set_defaults(func=cmd_pages)

    p_d = sub.add_parser("devices", help="Aufschlüsselung nach Gerätetyp")
    p_d.add_argument("--days", type=int, default=28)
    p_d.set_defaults(func=cmd_devices)

    p_i = sub.add_parser("inspect", help="URL Inspection API für eine einzelne URL")
    p_i.add_argument("url")
    p_i.set_defaults(func=cmd_inspect)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

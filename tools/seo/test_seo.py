import unittest
import datetime as dt
from pathlib import Path
import json
from bs4 import BeautifulSoup
from seo import audit, parse_page, shift_months, ROOT

# Anzahl folgt aus data/products.json: je Produkt eine Seite und eine Katalogkarte, dazu 5 weitere Seiten
PRODUCTS = len(json.loads((Path(__file__).resolve().parents[2] / 'data/products.json').read_text(encoding='utf-8')))
# Branchenseiten aus data/site.json
BRANCHEN = len(json.loads((Path(__file__).resolve().parents[2] / 'data/site.json').read_text(encoding='utf-8'))['branchen'])
# Ratgeber: Übersicht plus ein Artikel je Datei in content/ratgeber
RATGEBER = 1 + len(list((Path(__file__).resolve().parents[2] / 'content/ratgeber').glob('*.html')))
# Themen- und Kategorieseiten in content/themen
THEMEN = len(list((Path(__file__).resolve().parents[2] / 'content/themen').glob('*.html')))

class SeoTests(unittest.TestCase):
    def test_regressions(self):
        report = audit()
        self.assertEqual(len(report['pages']),PRODUCTS+BRANCHEN+RATGEBER+THEMEN+5)
        self.assertEqual(report['site_checks']['errors'],[])
        self.assertEqual([(p['url'],p['errors']) for p in report['pages'] if p['errors']],[])

    def test_catalogue_is_reproducible_and_crawlable(self):
        text=(ROOT/'index.html').read_text(encoding='utf-8')
        rendered=text.split('<!-- catalog:start -->')[1].split('<!-- catalog:end -->')[0].strip()
        soup=BeautifulSoup(rendered,'html.parser')
        cards=soup.select('a.pf-pcard[data-cat]')
        self.assertEqual(len(cards),PRODUCTS)
        self.assertEqual(len({a['href'] for a in cards}),PRODUCTS)
        self.assertTrue(all(a.find('img').get('alt') for a in cards))

    def test_parser_catches_invalid_json_and_multiple_canonicals(self):
        result=parse_page('<title>A</title><link rel="canonical" href="a"><link rel="canonical" href="b"><script type="application/ld+json">broken</script>', 'https://example.com/')
        self.assertEqual(result['canonicals'],['a','b'])
        self.assertIn('invalid_json_ld',result['errors'])

    def test_calendar_month_boundary(self):
        self.assertEqual(shift_months(dt.date(2024,3,31),-1),dt.date(2024,2,29))
        self.assertEqual(shift_months(dt.date(2026,9,16),-16),dt.date(2025,5,16))

if __name__=='__main__': unittest.main()

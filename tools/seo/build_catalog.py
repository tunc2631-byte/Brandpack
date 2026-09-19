"""Generate the initial HTML catalogue from one versioned source. No runtime fetch."""
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
def render_cards():
    products = json.loads((ROOT/'tools/seo/data/catalog.json').read_text(encoding='utf-8'))
    cards = []
    for p in products:
        e = lambda key: html.escape(p[key], quote=True)
        cards.append(f'''      <a href="{e('url')}" data-product-category="{html.escape(' '.join(p['tags']))}" class="catalog-card">
        <div class="catalog-image"><img src="{e('img')}" alt="{e('title')}" loading="lazy" decoding="async" width="480" height="480"></div>
        <div class="catalog-info"><h3>{e('title')}</h3>
          <div class="catalog-price-row"><span>ab €{e('price')} / {e('unit')}</span><span class="btn-kaufen">Anfragen →</span></div>
        </div>
      </a>''')
    return '\n'.join(cards)

def main():
    page = ROOT/'index.html'
    text = page.read_text(encoding='utf-8')
    text, count = re.subn(r'<!-- catalog:start -->[\s\S]*?<!-- catalog:end -->', '<!-- catalog:start -->\n'+render_cards()+'\n      <!-- catalog:end -->',text)
    if count != 1: raise RuntimeError('Expected exactly one catalogue marker pair')
    page.write_text(text,encoding='utf-8',newline='\n')

if __name__ == '__main__': main()

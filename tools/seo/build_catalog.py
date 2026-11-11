"""Generate the initial HTML catalogue from data/products.json. No runtime fetch."""
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
def render_cards():
    products = json.loads((ROOT/'data/products.json').read_text(encoding='utf-8'))
    cards = []
    for product in products:
        p = {**product['catalog'], 'url': product['url'], 'img': product['image']}
        e = lambda key: html.escape(p[key], quote=True)
        small = html.escape(p['img'].replace('-960.webp', '-480.webp'), quote=True)
        note = f'\n          <p class="catalog-note">{e("note")}</p>' if p.get('note') else ''
        cards.append(f'''      <a href="{e('url')}" data-product-category="{html.escape(' '.join(p['tags']))}" class="catalog-card">
        <div class="catalog-image"><img src="{e('img')}" srcset="{small} 480w, {e('img')} 960w" sizes="(max-width: 900px) 50vw, 380px" alt="{e('title')}" loading="lazy" decoding="async" width="480" height="480"></div>
        <div class="catalog-info"><h3>{e('title')}</h3>
          <div class="catalog-price-row"><span>ab €{e('price')} / {e('unit')}</span><span class="btn-kaufen">Anfragen →</span></div>{note}
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

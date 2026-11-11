// Prüft data/products.json und assets/pf-pricing.js gegen den Preis-Schnappschuss
// der echten Seiten (tools/qa/price-snapshot.json).   node --test tools/qa/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PF = require(path.join(ROOT, 'assets', 'pf-pricing.js'));
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, 'price-snapshot.json'), 'utf8'));

// "EUR 1.584,00" -> 158400 (Cent)
function cents(text) {
  const m = /^EUR ([\d.]+),(\d\d)$/.exec(text);
  assert.ok(m, `Gesamtpreis nicht lesbar: ${text}`);
  return Number(m[1].replace(/\./g, '')) * 100 + Number(m[2]);
}

// "0,0943 € / Stück" | "2,20 ct / Stück" | "7,00 € / kg" | "0,1350 EUR / Stück"
function unitPrice(text) {
  const m = /^(\d+),(\d+) (€|EUR|ct) \/ (Stück|kg)$/.exec(text);
  assert.ok(m, `Stückpreis nicht lesbar: ${text}`);
  return { scaled: Number(m[1] + m[2]), decimals: m[2].length, cent: m[3] === 'ct', per: m[4] };
}

// num/den kaufmännisch auf `decimals` Stellen gerundet, als ganze Zahl
function roundHalfUp(num, den, decimals) {
  const n = num * 10 ** decimals;
  return Math.floor((2 * n + den) / (2 * den));
}

// Stückpreise, die heute auf der Seite stehen, aber nicht zum Gesamtpreis passen.
// Der Gesamtpreis gilt. Eintrag entfernen, sobald die Anzeige korrigiert ist.
const KNOWN_UNIT_DISPLAY = {
  pommesschuetten: {
    'M · 116 mm | 10.000 Stück': '0,138 € / Stück',   // 1.385 € / 10.000 = 0,1385 €
    'XL · 178 mm | 15.000 Stück': '0,121 € / Stück',  // 1.805 € / 15.000 = 0,1203 €
  },
};

test('jede Produktseite hat genau einen Eintrag in data/products.json', () => {
  const pages = fs.readdirSync(path.join(ROOT, 'produkte'))
    .filter(s => fs.existsSync(path.join(ROOT, 'produkte', s, 'index.html'))).sort();
  assert.deepEqual(products.map(p => p.slug).sort(), pages);
  assert.equal(new Set(products.map(p => p.slug)).size, products.length);
  for (const p of products) assert.equal(p.url, `/produkte/${p.slug}/`);
});

test('der Schnappschuss deckt alle Produkte ab', () => {
  assert.deepEqual(Object.keys(snapshot).sort(), products.map(p => p.slug).sort());
});

for (const product of products) {
  test(`${product.slug}: jede Kombination ergibt denselben Preis wie die Seite`, () => {
    const combos = Object.entries(snapshot[product.slug]);
    assert.equal(combos.length, PF.combinations(product).length, 'Anzahl der Kombinationen');
    for (const [labels, shown] of combos) {
      const sel = {};
      shown.auswahl.forEach((i, g) => {
        const group = product.options[g];
        const choice = group.choices[i];
        if (!group.dynamicLabel) assert.equal(choice.label, labels.split(' | ')[g], `${product.slug}: Beschriftung in "${group.label}"`);
        sel[group.key] = choice.id;
      });
      const q = PF.quote(product, sel);
      if (shown.total === 'Preis auf Anfrage') {
        assert.ok(q.onRequest, `${labels}: sollte "Preis auf Anfrage" sein`);
        continue;
      }
      assert.equal(q.totalCents, cents(shown.total), `${labels}: Gesamtpreis`);
      const known = (KNOWN_UNIT_DISPLAY[product.slug] || {})[labels];
      if (known) {
        assert.equal(shown.per, known, `${labels}: bekannte Abweichung hat sich geändert`);
        continue;
      }
      const up = unitPrice(shown.per);
      assert.equal(up.per, product.unit, `${labels}: Einheit`);
      const [num, den] = q.unitFraction;
      const expected = roundHalfUp(up.cent ? num * 100 : num, den, up.decimals);
      assert.equal(expected, up.scaled, `${labels}: Stückpreis ${shown.per}`);
    }
  });
}

test('jeder "ab"-Preis im Katalog gibt es beim Produkt wirklich', () => {
  for (const p of products) {
    const m = /^(\d+),(\d+)$/.exec(p.catalog.price);
    assert.ok(m, `${p.slug}: Katalogpreis ${p.catalog.price}`);
    const decimals = m[2].length, shown = Number(m[1] + m[2]);
    const hit = PF.combinations(p).some(sel => {
      const q = PF.quote(p, sel);
      return !q.onRequest && roundHalfUp(q.unitFraction[0], q.unitFraction[1], decimals) === shown;
    });
    assert.ok(hit, `${p.slug}: "ab €${p.catalog.price}" kommt in keiner Kombination vor`);
  }
});

test('Standardauswahl und günstigste Kombination lassen sich berechnen', () => {
  for (const p of products) {
    const q = PF.quote(p, PF.defaults(p));
    assert.ok(q.onRequest || q.totalCents > 0, p.slug);
    assert.ok(PF.lowest(p).quote.unit > 0, p.slug);
  }
});

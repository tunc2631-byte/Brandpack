/*
 * PackFactory Preisrechner: berechnet Stückpreis und Gesamtpreis eines
 * Produkts aus data/products.json für eine Auswahl wie
 *   { groesse: 'S', material: 'kraft', menge: '25000' }.
 *
 * Gerechnet wird in ganzen Zahlen, damit keine Rundungsfehler entstehen:
 *   basis "unit":  Tabellenwerte sind Stückpreise in 1/10.000 € (1500 = 15,00 ct),
 *                  bei Kilopreisen entsprechend pro kg.
 *   basis "total": Tabellenwerte sind Gesamtpreise in Cent (ältere Preislisten,
 *                  bei denen der Gesamtpreis vorgegeben ist).
 * Läuft im Browser (window.PFPricing) und in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PFPricing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function pick(table, by, sel) {
    var keys = Array.isArray(by) ? by : [by];
    var v = table;
    for (var i = 0; i < keys.length; i++) {
      v = v == null ? undefined : v[sel[keys[i]]];
      if (v === undefined) throw new Error('Kein Preis für ' + keys[i] + ' = ' + sel[keys[i]]);
    }
    return v;
  }

  function choiceOf(product, key, sel) {
    var group = product.options.filter(function (g) { return g.key === key; })[0];
    if (!group) throw new Error('Unbekannte Auswahl ' + key);
    var choice = group.choices.filter(function (c) { return c.id === sel[key]; })[0];
    if (!choice) throw new Error('Unbekannte Option ' + key + ' = ' + sel[key]);
    return choice;
  }

  function quantity(product, sel) {
    var q = product.pricing.qty;
    if (q.fixed != null) return q.fixed;
    if (q.table) return pick(q.table, q.by, sel);
    return Number(sel[q.by]);
  }

  // Ergebnis: qty, unit (€ pro Stück bzw. kg), total (€), totalCents,
  // unitFraction [Zähler, Nenner] in € für exakte Rundung, per ("Stück"/"kg").
  // Bei Preis auf Anfrage: { onRequest: true }.
  function quote(product, sel) {
    var p = product.pricing;
    for (var i = 0; i < product.options.length; i++) {
      if (choiceOf(product, product.options[i].key, sel).onRequest) return { onRequest: true, per: product.unit };
    }
    var qty = quantity(product, sel);
    var totalCents, fraction;
    if (p.basis === 'total') {
      totalCents = pick(p.table, p.by, sel);
      fraction = [totalCents, 100 * qty];
    } else {
      var u = pick(p.table, p.by, sel);
      (p.modifiers || []).forEach(function (m) {
        var v = pick(m.table, m.by, sel);
        if (m.type === 'factor') {
          var r = m.round || 1;
          u = Math.round(u * v / m.per / r) * r;
        } else if (m.type === 'add') {
          u += v;
        } else {
          throw new Error('Unbekannter Preisaufschlag ' + m.type);
        }
      });
      totalCents = Math.round(u * qty / 100);
      fraction = [u, 10000];
    }
    return {
      qty: qty,
      unit: fraction[0] / fraction[1],
      unitFraction: fraction,
      total: totalCents / 100,
      totalCents: totalCents,
      per: product.unit
    };
  }

  // Alle Kombinationen der Auswahlgruppen, in Seitenreihenfolge.
  function combinations(product) {
    var out = [{}];
    product.options.forEach(function (g) {
      var next = [];
      out.forEach(function (sel) {
        g.choices.forEach(function (c) {
          var s = Object.assign({}, sel);
          s[g.key] = c.id;
          next.push(s);
        });
      });
      out = next;
    });
    return out;
  }

  function defaults(product) {
    var sel = {};
    product.options.forEach(function (g) { sel[g.key] = (g.choices.filter(function (c) { return c.default; })[0] || g.choices[0]).id; });
    return sel;
  }

  // Niedrigster Stückpreis über alle Kombinationen (für "ab"-Preise).
  function lowest(product) {
    var best = null;
    combinations(product).forEach(function (sel) {
      var q = quote(product, sel);
      if (!q.onRequest && (!best || q.unit < best.quote.unit)) best = { sel: sel, quote: q };
    });
    return best;
  }

  return { quote: quote, combinations: combinations, defaults: defaults, lowest: lowest };
});

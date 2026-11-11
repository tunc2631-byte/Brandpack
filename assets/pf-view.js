/*
 * PackFactory Anzeige-Texte für den Produkt-Konfigurator: Preise, Mengen,
 * Hinweise und Anfragetexte. Wird beim Erzeugen der Seiten (Node) und im
 * Browser (window.PFView) gleich verwendet, damit beides übereinstimmt.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./pf-pricing.js'));
  else root.PFView = factory(root.PFPricing);
})(typeof self !== 'undefined' ? self : this, function (PF) {
  'use strict';

  var nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // num/den kaufmännisch gerundet (nur positive Werte)
  function roundHalfUp(num, den) { return Math.floor((2 * num + den) / (2 * den)); }

  function euros(cents) { return nf2.format(cents / 100) + ' €'; }

  // "15,00 ct" bzw. "7,00 €/kg"
  function unitShort(q) {
    var f = q.unitFraction;
    if (q.per === 'kg') return nf2.format(roundHalfUp(f[0] * 100, f[1]) / 100) + ' €/kg';
    return nf2.format(roundHalfUp(f[0] * 10000, f[1]) / 100) + ' ct';
  }
  function unitLong(q) {
    return q.per === 'kg' ? unitShort(q).replace('/kg', ' pro kg') : unitShort(q) + ' pro Stück';
  }
  function qtyText(n, per) { return nf0.format(n) + (per === 'kg' ? ' kg' : ' Stück'); }

  function group(p, key) { return p.options.filter(function (g) { return g.key === key; })[0]; }
  function choice(p, key, id) { return group(p, key).choices.filter(function (c) { return c.id === id; })[0]; }
  function firstQty(p, sel) {
    var s = Object.assign({}, sel);
    s[p.qtyKey] = group(p, p.qtyKey).choices[0].id;
    return s;
  }
  function isCustom(p, sel) {
    return p.options.some(function (g) { var c = choice(p, g.key, sel[g.key]); return c && c.custom; });
  }

  // Mengen-Karte: Menge, Stückpreis und Ersparnis gegenüber der kleinsten Menge
  function tier(p, sel, c) {
    var s = Object.assign({}, sel);
    s[p.qtyKey] = c.id;
    var q = PF.quote(p, s);
    if (q.onRequest) return { qty: c.label, line: 'Preis auf Anfrage', pct: 0 };
    var q0 = PF.quote(p, firstQty(p, s));
    var pct = Math.round((1 - q.unit / q0.unit) * 100);
    return { qty: qtyText(q.qty, p.unit), line: unitShort(q), pct: pct > 0 ? pct : 0 };
  }

  function hints(p, sel, custom) {
    var out = [];
    (p.hints || []).forEach(function (h) {
      var t = h.table;
      h.by.forEach(function (k) { t = t == null ? t : t[sel[k]]; });
      if (t) out.push({ after: h.after, text: t });
    });
    var q = PF.quote(p, sel);
    if (p.pieces && !q.onRequest) {
      var per200 = typeof p.pieces.per200kg === 'number' ? p.pieces.per200kg : p.pieces.per200kg[sel[p.pieces.by]];
      var grams = typeof p.pieces.grams === 'number' ? p.pieces.grams : p.pieces.grams[sel[p.pieces.by]];
      var pieces = Math.round(per200 * q.qty / 200);
      out.push({ after: p.qtyKey, text: 'ca. ' + nf0.format(pieces) + ' Stück · ' + nf2.format(q.unit * grams / 10) + ' ct pro Stück' });
    }
    if (p.sheets && !q.onRequest) {
      var perKg = 0;
      if (isCustom(p, sel)) {
        if (custom && custom.width > 0 && custom.height > 0) perKg = p.sheets.customArea / (custom.width * custom.height);
      } else {
        perKg = p.sheets.perKg[sel[p.sheets.by]];
      }
      out.push({ after: p.qtyKey, text: perKg > 0 ? 'ca. ' + nf0.format(Math.round(q.qty * perKg)) + ' Blatt' : 'Bitte Breite und Höhe eingeben' });
    }
    return out;
  }

  function summary(p, sel) {
    var q = PF.quote(p, sel);
    if (q.onRequest) return { onRequest: true, total: 'Preis auf Anfrage', per: 'Individuelles Angebot', saved: '' };
    var saved = '';
    if (p.qtyKey && sel[p.qtyKey] !== group(p, p.qtyKey).choices[0].id) {
      var q0 = PF.quote(p, firstQty(p, sel));
      if (!q0.onRequest) {
        var cents = roundHalfUp(q0.unitFraction[0] * q.qty * 100, q0.unitFraction[1]) - q.totalCents;
        if (cents >= 100) saved = 'Du sparst ' + nf0.format(Math.floor(cents / 100)) + ' € gegenüber ' + qtyText(q0.qty, p.unit);
      }
    }
    return { onRequest: false, quote: q, total: euros(q.totalCents), per: unitLong(q), saved: saved };
  }

  function parts(p, sel, custom) {
    var q = PF.quote(p, sel);
    var out = p.options.map(function (g) {
      var c = choice(p, g.key, sel[g.key]);
      if (g.key === p.qtyKey && !q.onRequest) return qtyText(q.qty, p.unit);
      var text = g.label + ': ' + c.label;
      if (c.custom) return text + (custom && custom.width && custom.height ? ' ' + custom.width + ' × ' + custom.height + ' mm' : '');
      return text + (c.detail ? ' (' + c.detail + ')' : '');
    });
    if (!p.qtyKey && !q.onRequest) out.push(qtyText(q.qty, p.unit));
    return out;
  }

  function message(p, sel, custom) {
    var s = summary(p, sel);
    var price = s.onRequest ? 'Preis auf Anfrage' : s.per + ' netto, gesamt ' + s.total + ' netto';
    return 'Hallo, ich interessiere mich für ' + p.catalog.title + ' (' + parts(p, sel, custom).join(', ') + ', ' + price + ') und möchte ein Angebot anfragen.';
  }

  function emailBody(p, sel, custom) {
    var s = summary(p, sel);
    return parts(p, sel, custom).join('\n') + '\n' +
      (s.onRequest ? 'Preis: auf Anfrage' : 'Stückpreis: ' + s.per + ' netto\nGesamtpreis: ' + s.total + ' netto');
  }

  function fromPrice(p) {
    return 'ab ' + unitShort(PF.lowest(p).quote);
  }

  return {
    roundHalfUp: roundHalfUp, euros: euros, unitShort: unitShort, unitLong: unitLong, qtyText: qtyText,
    group: group, choice: choice, tier: tier, hints: hints, summary: summary, parts: parts,
    message: message, emailBody: emailBody, fromPrice: fromPrice, isCustom: isCustom
  };
});

# CLAUDE.md — Frontend Website Rules

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

## Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `node serve.mjs` (serves the project root at `http://localhost:3000`)
- `serve.mjs` lives in the project root. Start it in the background before taking any screenshots.
- If the server is already running, do not start a second instance.

## Screenshot Workflow
- Puppeteer is installed at `C:/Users/nateh/AppData/Local/Temp/puppeteer-test/`. Chrome cache is at `C:/Users/nateh/.cache/puppeteer/`.
- **Always screenshot from localhost:** `node screenshot.mjs http://localhost:3000`
- Screenshots are saved automatically to `./temporary screenshots/screenshot-N.png` (auto-incremented, never overwritten).
- Optional label suffix: `node screenshot.mjs http://localhost:3000 label` → saves as `screenshot-N-label.png`
- `screenshot.mjs` lives in the project root. Use it as-is.
- After screenshotting, read the PNG from `temporary screenshots/` with the Read tool — Claude can see and analyze the image directly.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
- Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing

## Output Defaults
- This is the live PackFactory site (static, GitHub Pages publishes `main`). Work inside the existing pages and shared files; do not start a new single-file Tailwind page.
- No Tailwind CDN on the site. Shared code lives in `assets/`, `cart.js` and `data/`.
- Placeholder images only for mockups, never on the live site.
- Mobile-first responsive

## PackFactory: Preise, Produkte, Bilder
- **Redesign-Plan:** https://claude.ai/artifact/TY3XdANshBaC7fiRm71Tc2 (Schritte 1–5, Entscheidungen des Inhabers in Kapitel 11). Jeder Schritt als eigener Pull Request mit Netlify-Vorschau; live erst nach Freigabe.
- **Produktdaten:** `data/products.json` ist die zentrale Quelle für Auswahl, Preise und Katalogkarten. `assets/pf-pricing.js` rechnet daraus Stück- und Gesamtpreise (ganze Zahlen: Stückpreise in 1/10.000 €, Gesamtpreise in Cent).
- **Seiten nie von Hand ändern:** Alle Seiten (Startseite, Produkte, Über uns, Designservice, Impressum, Datenschutz) erzeugt `node tools/build_site.js`. Produktseiten kommen aus `data/products.json` (Auswahl, Preise, Hinweise, passende Produkte) und `content/produkte/<slug>.html` (Titel, Beschreibung, Texte, technische Daten, FAQ); die übrigen Seiten aus `content/seiten/<name>.html`. Kategorien, Branchen und Bestseller der Startseite stehen in `data/site.json`. Design: `assets/pf.css`, Navigation: `assets/pf-site.js`, Startseite (Filter, Formular): `assets/pf-home.js`, Produktseite: `assets/pf-product.js`, Texte für Preise und Anfragen: `assets/pf-view.js`.
- **Preise ändern:** nur in `data/products.json`, dann `node tools/build_site.js`, `node tools/qa/price-snapshot.js` (zeigt genau die gewollten Änderungen) und danach `--update`, zuletzt `node --test tools/qa/*.test.js`.
- **Neues Produkt:** Eintrag in `data/products.json` und Inhaltsdatei in `content/produkte/` anlegen, Kategorie und Branchen setzen, `node tools/build_site.js`, Sitemap ergänzen.
- **Vor jedem Pull Request:** `node tools/qa/price-snapshot.js` (ohne `--update`) muss "unverändert" melden, außer Preise sollten sich ändern. Dazu `python -m unittest discover -s tools/seo -p 'test_*.py'`.
- **Katalogkarten:** Feld `catalog` (Titel, Kategorie), `badge` und `branchen` in `data/products.json`, danach `node tools/build_site.js`. Der "ab"-Preis wird automatisch berechnet.
- **Bilder:** Original (JPEG/PNG) nach `Bilder/` legen, auf der Seite `/Bilder/web/<name>-960.webp` mit `srcset` auf `-480.webp` verwenden (Logos: `/Bilder/logos/<name>-440.webp`), dann `python tools/build_images.py`. Keine großen PNGs direkt einbinden.
- **Nie erfinden:** keine Bewertungen, Zahlen, Zertifikate, Lieferzeiten oder Hersteller auf der Seite. Einkaufspreise und Lieferanten bleiben intern.

## Brand Assets
- Always check the `brand_assets/` folder before designing. It may contain logos, color guides, style guides, or images.
- If assets exist there, use them. Do not use placeholders where real assets are available.
- If a logo is present, use it. If a color palette is defined, use those exact values — do not invent brand colors.

## Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Pick a custom brand color and derive from it.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- **Typography:** Never use the same font for headings and body. Pair a display/serif with a clean sans. Apply tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Images:** Add a gradient overlay (`bg-gradient-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply`.
- **Spacing:** Use intentional, consistent spacing tokens — not random Tailwind steps.
- **Depth:** Surfaces should have a layering system (base → elevated → floating), not all sit at the same z-plane.

## Hard Rules
- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color

"""Erzeugt die Web-Bilder der Seite aus den Originalen.

Jede Seite verweist auf Bilder der Form
    /Bilder/web/<name>-<breite>.webp      (Produkt- und Seitenbilder)
    /Bilder/logos/<name>-<breite>.webp    (Kundenlogos, Transparenz bleibt)
    /Bilder/frei/<name>-<breite>.webp     (freigestellt: weißer Hintergrund wird durchsichtig,
                                           für Bilder auf farbigem Grund, z. B. im Startbereich)
    /Bilder/og/<name>-1200.jpg            (Vorschaubild für WhatsApp & Co.: 1200 × 630, weißer Grund)
Das Skript sucht dazu das Original <name>.(jpeg|jpg|png|webp) in Bilder/ oder
im Projektordner (Groß-/Kleinschreibung und Leerzeichen egal) und schreibt die
fehlenden oder veralteten Dateien.

    python tools/build_images.py          fehlende/veraltete Bilder erzeugen
    python tools/build_images.py --check  nur prüfen, Exit 1 bei Fehlern
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
REF = re.compile(r'/Bilder/(web|logos|frei)/([a-z0-9-]+)-(\d+)\.webp|/Bilder/(og)/([a-z0-9-]+)-(1200)\.jpg')
SOURCE_DIRS = [ROOT / 'Bilder', ROOT]
QUALITY = {'web': 82, 'logos': 86, 'frei': 84, 'og': 84}
EXT = {'og': 'jpg'}


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')).strip('-')


def sources():
    found = {}
    for d in SOURCE_DIRS:
        for f in d.iterdir():
            if f.is_file() and f.suffix.lower() in ('.jpeg', '.jpg', '.png', '.webp'):
                found.setdefault(slug(f.stem), f)
    return found


def references():
    refs = set()
    files = [p for p in ROOT.rglob('*') if p.suffix in ('.html', '.json', '.js', '.py', '.css')
             and not {'.git', 'node_modules', 'dl'} & set(p.relative_to(ROOT).parts)]
    for f in files:
        if f.resolve() == Path(__file__).resolve():
            continue
        refs.update(tuple(x for x in m if x) for m in REF.findall(f.read_text(encoding='utf-8', errors='ignore')))
    return sorted(refs)


def white_to_alpha(im):
    """Weiß wird durchsichtig, Schatten bleiben halbdurchsichtig grau. Auf jedem
    hellen Hintergrund sieht das Bild dann aus wie mit mix-blend-mode: multiply,
    funktioniert aber auch dort, wo der Browser das nicht kann (Safari auf dem iPhone)."""
    import numpy as np
    from PIL import Image
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    inv = 255.0 - rgb
    a = np.clip((inv.max(axis=2) - 3.0) * 255.0 / 252.0, 0, 255)  # fast Weiß zählt als Weiß
    safe = np.where(a > 0, a, 1.0)[..., None]
    col = np.clip(255.0 - inv * 255.0 / safe, 0, 255)
    out = np.dstack([col, a]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def render(src, kind, width, out):
    from PIL import Image  # nur zum Erzeugen nötig, nicht für --check
    im = Image.open(src)
    if kind == 'og':
        # Produkt mittig auf Weiß, mit Rand, damit WhatsApp beim Zuschneiden nichts abschneidet
        im = im.convert('RGB')
        im.thumbnail((560, 560), Image.LANCZOS)
        canvas = Image.new('RGB', (1200, 630), (255, 255, 255))
        canvas.paste(im, ((1200 - im.width) // 2, (630 - im.height) // 2))
        out.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(out, 'JPEG', quality=QUALITY[kind], optimize=True, progressive=True)
        return
    if kind == 'frei':
        im = white_to_alpha(im)
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out, 'WEBP', quality=QUALITY[kind], method=6)
        return
    keep_alpha = kind == 'logos' and im.mode in ('RGBA', 'LA', 'P')
    im = im.convert('RGBA' if keep_alpha else 'RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, 'WEBP', quality=QUALITY[kind], method=6)


def main(check=False):
    src_map = sources()
    problems, written = [], []
    for kind, name, width in references():
        out = ROOT / 'Bilder' / kind / f'{name}-{width}.{EXT.get(kind, "webp")}'
        src = src_map.get(name)
        if src is None:
            problems.append(f'Kein Original für {out.relative_to(ROOT)} gefunden')
            continue
        if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
            continue
        if check and out.exists():
            continue  # Zeitstempel sind nach git checkout nicht verlässlich
        if check:
            problems.append(f'Fehlt: {out.relative_to(ROOT)}')
            continue
        render(src, kind, int(width), out)
        written.append(str(out.relative_to(ROOT)))
    for w in written:
        print('erzeugt', w)
    for p in problems:
        print(p, file=sys.stderr)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main('--check' in sys.argv))

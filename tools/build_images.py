"""Erzeugt die Web-Bilder der Seite aus den Originalen.

Jede Seite verweist auf Bilder der Form
    /Bilder/web/<name>-<breite>.webp      (Produkt- und Seitenbilder)
    /Bilder/logos/<name>-<breite>.webp    (Kundenlogos, Transparenz bleibt)
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
REF = re.compile(r'/Bilder/(web|logos)/([a-z0-9-]+)-(\d+)\.webp')
SOURCE_DIRS = [ROOT / 'Bilder', ROOT]
QUALITY = {'web': 82, 'logos': 86}


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
        refs.update(REF.findall(f.read_text(encoding='utf-8', errors='ignore')))
    return sorted(refs)


def render(src, kind, width, out):
    from PIL import Image  # nur zum Erzeugen nötig, nicht für --check
    im = Image.open(src)
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
        out = ROOT / 'Bilder' / kind / f'{name}-{width}.webp'
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

import re
from pathlib import Path

# Map of non-ASCII chars to safe HTML entities (for use in HTML content)
HTML_ENTITIES = {
    '\xe4': '&auml;',   '\xf6': '&ouml;',   '\xfc': '&uuml;',
    '\xc4': '&Auml;',   '\xd6': '&Ouml;',   '\xdc': '&Uuml;',
    '\xdf': '&szlig;',  '\xb7': '&middot;', '\xd8': '&Oslash;',
    '›': '&rsaquo;', '‹': '&lsaquo;', '—': '&mdash;',
    '–': '&ndash;',  '€': '&euro;',   '\xd7': '&times;',
    '\xb2': '&sup2;',   '\xb3': '&sup3;',   '\xb0': '&deg;',
    '\xe9': '&eacute;', '\xe8': '&egrave;',
}

def fix_html(text):
    # Split on <script> and <style> blocks - these need JS unicode escapes, not HTML entities
    parts = re.split(r'(<script[\s\S]*?</script>|<style[\s\S]*?</style>)', text)
    result = []
    for part in parts:
        if part.startswith('<script') or part.startswith('<style'):
            out = []
            for ch in part:
                cp = ord(ch)
                if cp > 127:
                    hex4 = format(cp, '04X')
                    out.append('\\u' + hex4)
                else:
                    out.append(ch)
            result.append(''.join(out))
        else:
            for ch, entity in HTML_ENTITIES.items():
                part = part.replace(ch, entity)
            out = []
            for ch in part:
                cp = ord(ch)
                if cp > 127:
                    out.append('&#' + str(cp) + ';')
                else:
                    out.append(ch)
            result.append(''.join(out))
    return ''.join(result)

def process_file(path):
    original = path.read_text(encoding='utf-8')
    fixed = fix_html(original)
    if fixed != original:
        path.write_text(fixed, encoding='utf-8')
        return True
    return False

def main():
    root = Path(__file__).parent
    html_files = [f for f in root.glob('**/*.html') if '.git' not in f.parts]

    changed = []
    for f in sorted(html_files):
        if process_file(f):
            changed.append(f)

    if changed:
        print('[fix_encoding] Fixed ' + str(len(changed)) + ' file(s):')
        for f in changed:
            print('  ' + str(f.relative_to(root)))
    else:
        print('[fix_encoding] All files clean.')

if __name__ == '__main__':
    main()

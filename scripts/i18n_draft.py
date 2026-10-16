#!/usr/bin/env python3
"""Developer-only: drafts (or tops up) a Venus language file with Google Translate's free endpoint.

    NODE_PATH=<acorn> node scripts/i18n_strings.cjs > /tmp/strings.json
    NODE_PATH=<acorn> node scripts/i18n_plurals.cjs > work/plurals.json
    python3 scripts/i18n_draft.py <code> <google code> "<English name>" /tmp/strings.json
    node scripts/i18n_cldr.cjs      # language names, times and "and" from CLDR

Keeps {placeholders} and product names as tags, never overwrites a text already in the file (so hand-made fixes
stay) and fills in every CLDR plural form for the {n} texts. Drafts should be read by a speaker before release.
"""
import html, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = ['Venus Patches', 'Google Translate', 'manti.vendicated.dev', '@unknown-user', 'GPL-3.0', 'ReviewDB', 'GitHub', 'Discord', 'Venus', 'Nitro', 'GIF', 'Revenge', 'Vendetta', 'Blurple']
TOKEN = re.compile(r'\{\w+\}|' + '|'.join(re.escape(k) for k in KEEP))
# The plural ("other") English text of each pl()/take()/count() call, and its singular: scripts/i18n_plurals.cjs.
PAIRS = json.load(open(os.path.join(ROOT, 'work', 'plurals.json')))
# A number in each CLDR plural category, per language, so every form gets translated with a real number.
SAMPLES = {"cs": {"one": 1, "few": 2, "other": 5}, "hr": {"one": 1, "few": 2, "other": 5}, "lt": {"one": 1, "few": 2, "other": 10},
           "pl": {"one": 1, "few": 2, "many": 5}, "ro": {"one": 1, "few": 2, "other": 20}, "ru": {"one": 1, "few": 2, "many": 5},
           "uk": {"one": 1, "few": 2, "many": 5}}


def request(gcode, texts):
    body = '&'.join('q=' + urllib.parse.quote(t) for t in texts).encode()
    url = f'https://translate.googleapis.com/translate_a/t?client=dict-chrome-ex&sl=en&tl={gcode}'
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, data=body, headers={'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'})
            result = json.load(urllib.request.urlopen(req, timeout=30))
            return [r[0] if isinstance(r, list) else r for r in result]
        except Exception:
            time.sleep(2 + attempt * 3)
    raise SystemExit('Google Translate failed for ' + gcode)


def protect(text):
    parts = []
    def sub(m):
        parts.append(m.group(0)); return f'<a i={len(parts) - 1}/>'
    return TOKEN.sub(sub, text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')), parts


def restore(text, parts):
    used = []
    def sub(m):
        i = int(m.group(1)); used.append(i); return parts[i] if i < len(parts) else ''
    text = re.sub(r'<a\s+i\s*=\s*"?(\d+)"?\s*/>', sub, text)
    return html.unescape(text).strip() if sorted(used) == list(range(len(parts))) else None


def main():
    code, gcode, name, source = sys.argv[1:5]
    strings = json.load(open(source))
    path = os.path.join(ROOT, f'patches/src/main/resources/venus/i18n/{code}.json')
    result = json.load(open(path, encoding='utf-8'))['strings'] if os.path.exists(path) else {}
    todo = [s for s in strings if s not in result]
    for i in range(0, len(todo), int(os.environ.get("BATCH", "40"))):
        chunk = todo[i:i + int(os.environ.get("BATCH", "40"))]
        protected = [protect(s) for s in chunk]
        for s, (_, parts), answer in zip(chunk, protected, request(gcode, [p[0] for p in protected])):
            back = restore(answer, parts) if isinstance(answer, str) else None
            if back and sorted(re.findall(r'\{\w+\}', back)) == sorted(re.findall(r'\{\w+\}', s)): result[s] = back
        time.sleep(0.4)
    # Tags Google moved or dropped: try again with plain-text markers, one text at a time.
    for s in [s for s in strings if s not in result]:
        parts = TOKEN.findall(s)
        marked = TOKEN.sub(lambda m, it=iter(range(len(parts))): f'[[{next(it)}]]', s)
        answer = request(gcode, [marked])[0]
        if not isinstance(answer, str): continue
        for i, part in enumerate(parts): answer = re.sub(r'\[\[\s*' + str(i) + r'\s*\]\]', lambda m, p=part: p, answer, count=1)
        answer = html.unescape(answer).strip()
        if '[[' not in answer and all(answer.count(p) >= 1 for p in parts) and sorted(re.findall(r'\{\w+\}', answer)) == sorted(re.findall(r'\{\w+\}', s)):
            result[s] = answer
        time.sleep(0.2)
    samples = SAMPLES.get(code)
    if samples:
        for other, one in PAIRS.items():
            if other not in strings or isinstance(result.get(other), dict): continue
            texts = [(one if kind == 'one' else other).replace('{n}', str(n)) for kind, n in samples.items()]
            forms = {}
            for (kind, n), answer in zip(samples.items(), request(gcode, texts)):
                answer = html.unescape(answer)
                if not isinstance(answer, str) or answer.count(str(n)) != 1: forms = None; break
                forms[kind] = answer.replace(str(n), '{n}')
            if forms:
                forms.setdefault('other', forms.get('many') or forms.get('few'))
                result[other] = forms
            time.sleep(0.3)
    # Hand-made fixes (scripts/i18n_overrides/<code>.json) always win over the draft.
    overrides = os.path.join(ROOT, f'scripts/i18n_overrides/{code}.json')
    if os.path.exists(overrides):
        result.update({k: v for k, v in json.load(open(overrides, encoding='utf-8')).items() if k in strings})
    ordered = {s: result[s] for s in strings if s in result}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as out:
        json.dump({'code': code, 'name': name, 'strings': ordered}, out, ensure_ascii=False, indent=1)
        out.write('\n')
    print(code, len(ordered), 'of', len(strings))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Bygger ECT-kompendiet (Obsidian-valvet kompendium/) som en A4-bok i PDF med Pandoc och Typst.

  python3 publish/build.py            bygger export/bok/ECT-kompendium.pdf och export/bok/rapport.md
  python3 publish/build.py --manifest skriver om publish/bok.yaml från valvets mappar (ordning och titlar)

Valvet läses men ändras aldrig; allt som genereras hamnar i export/bok/ (utanför valvet, ignoreras av Git).
Kedja:
  1. publish/bok.yaml anger bokens hierarki: delar (mappar) och kapitel (filer) i ordning.
  2. Varje kapitel förbehandlas: YAML-huvud och %%kommentarer%% tas bort; wikilänkar ([[fil#rubrik|text]]) blir länkar
     inom boken; inbäddade bilder (![[bild.webp|alt]] med följande *Figur ...*-rad) blir figurer med bildtext;
     inbäddade anteckningar (![[anteckning]] eller ![[anteckning#rubrik]]) infogas; callouts (> [!TIP] Titel) blir
     markerade rutor; Mermaid-diagram renderas till vektor-PDF (publish/mermaid.mjs) i en gemensam skala; diagram som
     inte ryms görs om (radbrytning, riktning) i stället för att förminskas; rubriker flyttas en nivå ned
     (delar är nivå 1, kapitel nivå 2) och får unika ankare.
  3. Pandoc översätter den samlade Markdown-filen till Typst (publish/filter.lua, publish/mall.typ).
  4. Typst skapar PDF:en (numrerade rubriker, löpande sidhuvud, sidnummer, innehållsförteckning, bokmärken).
  5. Validering: rubriker, figurer, tabeller och länkar räknas i Typst och jämförs med källan; PDF:ens text jämförs
     ord för ord med källan; sidorna rasteriseras och kontrolleras för tomma sidor och innehåll utanför marginalerna.
  6. Rapporten export/bok/rapport.md listar ostödda konstruktioner, konverteringsfel, varningar och kontroller.
Verktygen (Pandoc 3.13, Typst 0.15.1) hämtas vid behov till ~/.cache/ect-publish och kontrolleras med SHA-256.
Kräver även python3-yaml, Pillow, node och chromium (diagram) samt poppler (pdftotext, pdftoppm, pdfimages, pdfinfo)."""
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tarfile
import unicodedata
import urllib.request
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import yaml
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
VAULT = ROOT / 'kompendium'
PUBLISH = ROOT / 'publish'
MANIFEST = PUBLISH / 'bok.yaml'
OUT = ROOT / 'export' / 'bok'
BUILD = OUT / 'build'
PDF = OUT / 'ECT-kompendium.pdf'
REPORT = OUT / 'rapport.md'
SITE = 'https://ect.matty.se/'
CACHE = Path.home() / '.cache' / 'ect-publish'
TOOLS = {
    'pandoc': ('https://github.com/jgm/pandoc/releases/download/3.13/pandoc-3.13-linux-amd64.tar.gz',
               '38aa33b325a2bc96a4c39409631212db55702f564250bcdbead180b3bf646389', 'pandoc-3.13/bin/pandoc'),
    'typst': ('https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-unknown-linux-musl.tar.xz',
              'a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c', 'typst-x86_64-unknown-linux-musl/typst'),
}
TEXT_WIDTH_PT = (210 - 2 * 25) / 25.4 * 72     # satsytans bredd i mall.typ (25 mm marginal runt om)
TEXT_HEIGHT_PT = (297 - 2 * 25) / 25.4 * 72    # satsytans höjd i mall.typ
FIGURE_HEIGHT_PT = TEXT_HEIGHT_PT - 150       # plats för kapitelrubrik, inledning och bildtext: diagrammet hålls kvar med texten före
DIAGRAM_SCALE = 0.7      # alla diagram i samma skala: Mermaids 16 px (12 pt) blir 8,4 pt, samma textstorlek i alla figurer
IMAGE_TYPES = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf'}
assert VAULT not in OUT.parents and OUT != VAULT, 'Genererade filer får inte hamna i valvet.'


class Report:
    """Samlar ostödda konstruktioner, fel och varningar för rapport.md."""
    def __init__(self):
        self.items = defaultdict(list)

    def add(self, kind, where, text):
        self.items[kind].append((where, text))


report = Report()


def run(cmd, **kw):
    return subprocess.run([str(c) for c in cmd], check=True, **kw)


def tool(name):
    url, digest, member = TOOLS[name]
    path = CACHE / member
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        archive = CACHE / url.rsplit('/', 1)[1]
        print(f'hämtar {name} …')
        urllib.request.urlretrieve(url, archive)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != digest:
            archive.unlink()
            sys.exit(f'{name}: kontrollsumman stämmer inte.')
        with tarfile.open(archive) as tar:
            tar.extractall(CACHE, filter='data')
    return path


def slug(text):
    """Samma ankarregel som kompendiets renderare (tools/markdown-renderer)."""
    text = ''.join(c for c in unicodedata.normalize('NFD', text) if not unicodedata.combining(c)).lower()
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')


def split_frontmatter(text):
    match = re.match(r'\A---\r?\n(.*?)\r?\n---\r?\n', text, re.S)
    if not match:
        return {}, text
    return (yaml.safe_load(match.group(1)) or {}), text[match.end():]


# ───────── Manifest ─────────
def write_manifest():
    files = run(['git', '-C', ROOT, 'ls-files', '-z', '--', 'kompendium/*.md'], capture_output=True, text=True).stdout.split('\0')
    files = sorted(f[len('kompendium/'):] for f in files if f)
    old = yaml.safe_load(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
    replaced = {str(name).lower() for name in (old.get('ersatta_kapitel') or {})}
    files = [f for f in files if Path(f).stem.lower() not in replaced]
    parts = []
    for path in files:
        folder, name = path.split('/', 1) if '/' in path else ('', path)
        if not parts or parts[-1]['mapp'] != folder:
            parts.append({'titel': re.sub(r'^\d+\s+', '', folder), 'mapp': folder, 'kapitel': []})
        parts[-1]['kapitel'].append(name)
    manifest = {'titel': 'ECT-kompendium', 'undertitel': 'Kompendium för ECT-behandlare', 'webbplats': SITE.rstrip('/')}
    nested = {(part['mapp'], entry['fil']): entry for part in old.get('delar') or [] for entry in part['kapitel'] if isinstance(entry, dict)}
    for part in parts:   # underkapitel behålls under sitt kapitel
        subs = {sub for (folder, _), entry in nested.items() if folder == part['mapp'] for sub in entry.get('underkapitel') or []}
        part['kapitel'] = [nested.get((part['mapp'], name), name) for name in part['kapitel'] if name not in subs]
    for key in ('figurpar', 'ersatta_kapitel', 'sidbrytning_fore'):   # bokens egna inställningar behålls när hierarkin skapas på nytt
        if old.get(key):
            manifest[key] = old[key]
    manifest['delar'] = parts
    MANIFEST.write_text('# Bokens hierarki: delar (mappar i valvet) och kapitel (filer) i ordning. Skapas med\n'
                        '# python3 publish/build.py --manifest och kan redigeras (ordning, deltitlar, utelämnade kapitel).\n'
                        + yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False, width=120), encoding='utf-8')
    print('skrev', MANIFEST)


# ───────── Förbehandling ─────────
class Book:
    def __init__(self, manifest):
        self.manifest = manifest
        self.chapters = []   # dict: index, part, path, title, aliases, source, body
        for p, part in enumerate(manifest['delar'], 1):
            # Ett kapitel kan ha underkapitel (bok.yaml: fil: och underkapitel:); de får depth 1 och rubrikerna en nivå lägre
            entries = []
            for entry in part['kapitel']:
                if isinstance(entry, dict):
                    entries += [(entry['fil'], -1)] + [(sub, 1) for sub in entry.get('underkapitel') or []]
                else:
                    entries.append((entry, 0))
            for name, depth in entries:
                # depth -1: kapitel med underkapitel; dess egna avsnitt numreras inte, så att underkapitlen blir x.y.1, x.y.2 ...
                parent, depth = depth < 0, max(depth, 0)
                references = bool(re.fullmatch(r'\d+ Referenser\.md', name))   # delens samlade referenser: onumrerat kapitel
                path = f"{part['mapp']}/{name}" if part['mapp'] else name
                source = (VAULT / path).read_text(encoding='utf-8')
                meta, body = split_frontmatter(source)
                heading = re.search(r'^#\s+(.+?)\s*$', body, re.M)
                title = meta.get('title') or (heading.group(1) if heading else Path(name).stem)
                self.chapters.append({'index': len(self.chapters) + 1, 'part': p, 'path': path, 'title': str(title), 'depth': depth, 'parent': parent or references, 'references': references,
                                      'aliases': meta.get('aliases') or [], 'source': source, 'body': body})
        # Länkmål som i kompendiets renderare: sökväg, sökväg utan .md, filnamn, filnamn utan .md och alias
        self.targets = {}
        for chapter in self.chapters:
            name = chapter['path'].rsplit('/', 1)[-1]
            for key in [chapter['path'], chapter['path'][:-3], name, name[:-3], *map(str, chapter['aliases'])]:
                key = key.lower()
                if key in self.targets and self.targets[key] is not chapter and not chapter['references']:
                    report.add('tvetydigt länkmål', chapter['path'], f'"{key}" pekar på flera kapitel')
                self.targets[key] = chapter
        # Bilagor (bilder m.m.) i valvet, efter sökväg och filnamn (tvetydiga filnamn kräver sökväg)
        self.attachments = {}
        for file in VAULT.rglob('*'):
            if file.is_file() and file.suffix.lower() != '.md':
                rel = file.relative_to(VAULT).as_posix()
                self.attachments[rel.lower()] = file
                key = file.name.lower()
                self.attachments[key] = None if key in self.attachments and self.attachments[key] not in (None, file) else file
        self.anchors = set()
        self.diagrams = {}   # id -> source
        self.used_files = {}

    # Inbäddade bilder: kopieras till build/figurer och får en bredd relativt satsytan
    def figure(self, file, caption, alt, where):
        target = BUILD / 'figurer' / file.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(file, target)
        self.used_files[file.name] = file
        width = None
        try:
            if file.suffix.lower() == '.svg':
                svg = file.read_text(encoding='utf-8')
                box = re.search(r'viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)', svg)
                attr = re.search(r'<svg[^>]*\swidth="([\d.]+)(px)?"', svg)
                width = float(attr.group(1)) * 0.75 if attr else float(box.group(1)) * 0.75 if box else None
            elif file.suffix.lower() != '.pdf':
                with Image.open(file) as image:
                    width = image.width * 72 / 150   # rasterbilder antas 150 dpi; mindre bilder förstoras inte
        except Exception as error:
            report.add('bild', where, f'{file.name}: storleken kunde inte läsas ({error})')
        percent = 100 if width is None else max(30, min(100, round(width / TEXT_WIDTH_PT * 100)))
        alt_attr = f' fig-alt="{alt}"' if alt and caption else ''
        return f'![{caption}](figurer/{file.name}){{width={percent}%{alt_attr}}}'

    def transclude(self, chapter, target, depth):
        name, _, heading = target.partition('#')
        source = self.targets.get(name.lower()) if name else chapter
        if source is None:
            report.add('saknad transklusion', chapter['path'], target)
            return f'*[Saknad inbäddning: {target}]*'
        body = source['body']
        if heading:
            match = re.search(rf'^(#+)\s+{re.escape(heading)}\s*$', body, re.M)
            if not match:
                report.add('saknad transklusion', chapter['path'], target)
                return f'*[Saknad inbäddning: {target}]*'
            level = len(match.group(1))
            end = re.search(rf'^#{{1,{level}}}\s', body[match.end():], re.M)
            body = body[match.start(): match.end() + (end.start() if end else len(body))]
        report.add('transklusion', chapter['path'], f'{target} infogad')
        return self.convert(source, body, depth + 1, transcluded=True)

    def convert(self, chapter, body, depth=0, transcluded=False):
        """Obsidian-Markdown till Pandoc-Markdown för ett kapitel (eller en infogad del)."""
        where = chapter['path']
        i = chapter['index']
        if depth > 3:
            report.add('transklusion', where, 'för djup inbäddning (cirkel?); avbröts')
            return ''
        comments = re.findall(r'%%[\s\S]*?%%', body)
        if comments:
            report.add('kommentar', where, f'{len(comments)} Obsidian-kommentar(er) utelämnade')
        body = re.sub(r'%%[\s\S]*?%%', '', body)
        out, headings, have_h1 = [], Counter(), False
        lines = body.split('\n')
        n = 0
        while n < len(lines):
            line = lines[n]
            # Kodblock: Mermaid renderas, övriga lämnas orörda
            fence = re.match(r'^(\s*)(`{3,}|~{3,})\s*([\w-]*)', line)
            if fence:
                marker, lang = fence.group(2), fence.group(3)
                end = n + 1
                while end < len(lines) and not lines[end].strip().startswith(marker):
                    end += 1
                code = '\n'.join(lines[n + 1:end])
                if lang == 'mermaid':
                    key = 'diagram-' + hashlib.sha1(code.encode()).hexdigest()[:12]
                    self.diagrams[key] = code
                    out.append(f'@@DIAGRAM:{key}@@')
                else:
                    report.add('kodblock', where, f'{lang or "utan språk"} ({end - n - 1} rader) återges som kod')
                    out.extend(lines[n:end + 1])
                n = end + 1
                continue
            # Callouts: > [!TYP] Titel följt av >-rader
            callout = re.match(r'^>\s*\[!([\w-]+)\]([+-]?)\s*(.*)$', line)
            if callout:
                kind, fold, title = callout.group(1).lower(), callout.group(2), callout.group(3).strip()
                if fold:
                    report.add('callout', where, f'hopfällbar callout ({kind}{fold}) visas utfälld')
                if kind not in {'note', 'info', 'tip', 'important', 'warning', 'caution', 'failure', 'danger', 'example', 'quote'}:
                    report.add('callout', where, f'okänd callout-typ "{kind}" visas som anteckning')
                inner = []
                n += 1
                while n < len(lines) and lines[n].startswith('>'):
                    inner.append(re.sub(r'^>\s?', '', lines[n]))
                    n += 1
                out.append(f':::: {{.callout .{kind}}}')
                if title:
                    out += ['::: {.callout-title}', self.inline(chapter, title), ':::']
                out += [self.inline(chapter, x) for x in inner] + ['::::', '']
                continue
            # HTML-block som valvet använder
            if re.match(r'^<div class="letter-list">\s*$', line):
                out.append('::: {.letter-list}'); n += 1; continue
            form = re.match(r'^<div class="(blankett-[\w-]+)">\s*(</div>)?\s*$', line)
            if form:
                if not form.group(2):
                    while n < len(lines) and '</div>' not in lines[n]:
                        n += 1
                route = '#/kompendium/' + '/'.join(map(lambda s: urllib.request.quote(s), chapter['path'].split('/')))
                report.add('html', where, f'formuläret {form.group(1)} fungerar bara på webbplatsen; hänvisning infogad')
                out += ['::: {.notice}', f'Formuläret finns på webbplatsen: <{SITE}{route}>', ':::']
                n += 1
                continue
            if re.match(r'^</div>\s*$', line):
                out.append(':::'); n += 1; continue
            # Rubriker: en nivå ned, unika ankare; manuellt numrerade rubriker numreras inte automatiskt
            heading = re.match(r'^(#{1,6})\s+(.+?)\s*#*\s*$', line)
            if heading:
                level, text = len(heading.group(1)), heading.group(2)
                if transcluded:
                    out.append(f'{"#" * min(6, level + 2)} {self.inline(chapter, text)} {{.unnumbered .unlisted}}')
                    n += 1
                    continue
                if level + chapter['depth'] >= 6:
                    report.add('rubrik', where, f'nivå {level} kan inte flyttas ned: "{text}"')
                if level == 1 and not have_h1:
                    anchor, have_h1 = f'c{i}', True
                    if chapter['references']:
                        self.anchors.add(anchor)
                        out.append(f'{"#" * (level + 1 + chapter["depth"])} {self.inline(chapter, text)} {{#{anchor} .unnumbered .references}}')
                        n += 1
                        continue
                else:
                    base = slug(text)
                    anchor = f'c{i}-{base}' + (f'-{headings[base]}' if headings[base] else '')
                    headings[base] += 1
                self.anchors.add(anchor)
                classes = ' .unnumbered' if chapter['parent'] and level > 1 else ''
                if any(rule['kapitel'] == chapter['path'] and rule['rubrik'] == text for rule in self.manifest.get('sidbrytning_fore') or []):
                    classes += ' .sidbrytning'   # bok.yaml: sidbrytning_fore
                if re.match(r'^\d+(\.\d+)*[.)]?\s', text) and not classes:
                    classes = ' .unnumbered'
                    report.add('manuell numrering', where, f'"{text}" behåller sitt nummer och numreras inte automatiskt')
                out.append(f'{"#" * min(6, level + 1 + chapter["depth"])} {self.inline(chapter, text)} {{#{anchor}{classes}}}')
                n += 1
                continue
            out.append(self.inline(chapter, line, depth))
            n += 1
        text = '\n'.join(out)
        if not transcluded and not have_h1:
            self.anchors.add(f'c{i}')
            text = f'## {chapter["title"]} {{#c{i}}}\n\n' + text
        # Bilder och diagram med bildtext på raden efter (*Figur ...*)
        def embed(match):
            target, _, label = match.group(1).partition('|')
            caption = (match.group(3) or '').strip().strip('*').strip()
            return self.embed(chapter, target.strip(), label.strip(), caption, depth) + match.group(4)
        text = re.sub(r'@@EMBED:(.+?)@@([ \t]*\n(\*Figur[^\n]*\*)[ \t]*)?(\n|$)', embed, text)
        def diagram(match):
            caption = (match.group(3) or '').strip().strip('*').strip()
            return f'@@FIGURE:{match.group(1)}|{caption}@@' + match.group(4)
        text = re.sub(r'@@DIAGRAM:(.+?)@@([ \t]*\n(\*Figur[^\n]*\*)[ \t]*)?(\n|$)', diagram, text)
        return text

    def embed(self, chapter, target, label, caption, depth):
        where = chapter['path']
        if Path(target.split('#')[0]).suffix.lower() in IMAGE_TYPES:
            file = self.attachments.get(target.lower()) or self.attachments.get(Path(target).name.lower())
            if file is None:
                report.add('saknad bild', where, target)
                return f'*[Saknad bild: {target}]*'
            if label and re.fullmatch(r'\d+(x\d+)?', label):
                report.add('bild', where, f'{target}: storleksangivelsen "{label}" ignoreras; bilden anpassas till satsytan')
                label = ''
            return self.figure(file, caption, label or file.stem, where)
        if Path(target.split('#')[0]).suffix and Path(target.split('#')[0]).suffix.lower() != '.md':
            report.add('ostödd inbäddning', where, f'{target}: filtypen kan inte bäddas in; länk till webbplatsen')
            return f'[{label or target}]({SITE}kompendium/{urllib.request.quote(target)})'
        return '\n\n' + self.transclude(chapter, target, depth) + '\n\n'

    def inline(self, chapter, text, depth=0):
        """Wikilänkar, bildinbäddningar och länkar på en rad."""
        where, i = chapter['path'], chapter['index']
        text = re.sub(r'!\[\[([^\]]+)\]\]', lambda m: f'@@EMBED:{m.group(1)}@@', text)
        # Kapitel som inte tas med i boken men ersätts av något i den (bok.yaml: ersatta_kapitel, namn: ankare)
        replaced = {str(k).lower(): v for k, v in (self.manifest.get('ersatta_kapitel') or {}).items()}
        def wikilink(match):
            target, _, label = match.group(1).replace('\\|', '|').partition('|')   # \| i tabeller
            name, _, heading = target.partition('#')
            dest = chapter if not name else self.targets.get(name.strip().lower())
            text_ = label or heading or name
            if dest is None and name.strip().lower() in replaced:
                report.add('ersatt kapitel', where, f'[[{match.group(1)}]] leder till bokens innehållsförteckning')
                return f'[{text_}](#{replaced[name.strip().lower()]})'
            if dest is None:
                report.add('olöst wikilänk', where, f'[[{match.group(1)}]] (texten behålls utan länk)')
                return text_
            anchor = f'c{dest["index"]}' + (f'-{slug(heading)}' if heading else '')
            return f'[{text_}](#{anchor})'
        text = re.sub(r'(?<!!)\[\[([^\]]+)\]\]', wikilink, text)
        keep = '|'.join(re.escape(v) + r'\)' for v in replaced.values())
        text = re.sub(r'\]\(#(?!c\d' + (f'|{keep}' if keep else '') + r')([^)]+)\)', lambda m: f'](#c{i}-{m.group(1)})', text)
        def relative(match):
            report.add('relativ länk', where, f'{match.group(1)} pekar på webbplatsen')
            return f']({SITE}{match.group(1)})'
        text = re.sub(r'\]\((?!https?:|mailto:|#|figurer/)([^)\s]+)\)', relative, text)
        for pattern, name in [(r'==[^=\n]+==', 'markering (==text==) visas som vanlig text'),
                              (r'(?<![\w/&#\]\[(])#[A-Za-zÅÄÖåäö][\w/-]+', 'Obsidian-tagg visas som text'),
                              (r'\^[\w-]{3,}\s*$', 'blockreferens (^id) visas som text')]:
            for found in re.findall(pattern, text):
                report.add('ostödd syntax', where, f'{name}: {found}')
        return text


def fits(size):
    return 'error' not in size and size['width'] * DIAGRAM_SCALE <= TEXT_WIDTH_PT and size['height'] * DIAGRAM_SCALE <= FIGURE_HEIGHT_PT


def variants(source):
    """Omgjorda versioner av ett diagram som inte ryms på sidan i bokens skala, i den ordning de prövas: annan
    radbrytning i rutorna, frågor som sexhörningar i stället för romber (en romb växer med kvadraten på texten),
    vänd riktning (uppifrån och ned blir vänster till höger och tvärtom); i sekvensdiagram bredare spalter så att
    meddelandena bryts på färre rader. Källan i kompendiet ändras inte."""
    def config(text, section, **values):
        lines = ''.join(f'\n    {key}: {value}' for key, value in values.items())
        return f'---\nconfig:\n  {section}:{lines}\n---\n{text}'
    if re.match(r'\s*sequenceDiagram\b', source):
        return [config(source, 'sequence', width=w, actorMargin=m, messageMargin=g, boxMargin=4, noteMargin=4)
                for w, m, g in ((200, 80, 24), (210, 90, 12), (200, 70, 8), (240, 140, 24))]
    head = re.match(r'(\s*)(flowchart|graph)\s+(TD|TB|LR|RL|BT)\b', source)
    if not head:
        return []
    swapped = source[:head.start(3)] + ('LR' if head.group(3) in ('TD', 'TB', 'BT') else 'TD') + source[head.end(3):]
    hexagon = re.sub(r'(\b\w+)\{("[^"{}]*")\}', r'\1{{\2}}', source)
    found = [config(source, 'flowchart', wrappingWidth=320), config(source, 'flowchart', wrappingWidth=140)]
    if hexagon != source:
        found += [hexagon, config(hexagon, 'flowchart', wrappingWidth=320), config(hexagon, 'flowchart', wrappingWidth=420)]
    return found + [swapped, config(swapped, 'flowchart', wrappingWidth=140), config(swapped, 'flowchart', wrappingWidth=320)]


def render_diagrams(book):
    """Renderar alla diagram (cache i export/bok/build/diagram). Diagram som inte ryms i bokens skala prövas i
    omgjorda versioner; den första som ryms väljs, annars den som ger störst skala. Returnerar storlekar och val."""
    target = BUILD / 'diagram'
    target.mkdir(parents=True, exist_ok=True)
    sizes = json.loads((target / 'storlekar.json').read_text()) if (target / 'storlekar.json').exists() else {}

    def render(items):
        todo = [{'id': key, 'source': source} for key, source in items if not (target / f'{key}.pdf').exists() or key not in sizes]
        if todo:
            print(f'renderar {len(todo)} diagram …')
            (BUILD / 'diagram-in.json').write_text(json.dumps(todo, ensure_ascii=False))
            run(['node', PUBLISH / 'mermaid.mjs', BUILD / 'diagram-in.json', target])
            sizes.update(json.loads((target / 'diagram.json').read_text()))
            (target / 'storlekar.json').write_text(json.dumps(sizes, indent=1))

    # Bokversioner: publish/diagram/<id>.mmd, där id är början av källdiagrammets SHA-1 (som i diagrammets nyckel),
    # ersätter diagrammet i boken. Ändras diagrammet i kompendiet får det en ny nyckel och bokversionen rapporteras
    # som inaktuell.
    own = {path.stem: path.read_text(encoding='utf-8') for path in sorted((PUBLISH / 'diagram').glob('*.mmd'))}
    for stem in own:
        if f'diagram-{stem}' not in book.diagrams:
            report.add('inaktuell bokversion', f'publish/diagram/{stem}.mmd', 'diagrammet finns inte längre i kompendiet; uppdatera eller ta bort filen')
    sources = {}
    for key, code in book.diagrams.items():
        stem = key.removeprefix('diagram-')
        sources[key] = (f'{key}-bok-' + hashlib.sha1(own[stem].encode()).hexdigest()[:6], own[stem]) if stem in own else (key, code)
    render(sources.values())
    chosen = {key: rendered for key, (rendered, _) in sources.items()}
    for key, (rendered, _) in sources.items():
        if rendered != key:
            report.add('diagram omgjort', key, f'bokversion publish/diagram/{key.removeprefix("diagram-")}.mmd används')
    alternatives = {key: [(f'{key}-v{i}', source) for i, source in enumerate(variants(code), 1)]
                    for key, code in book.diagrams.items()
                    if chosen[key] == key and 'error' not in sizes.get(key, {'error': 1}) and not fits(sizes[key])}
    render([item for items in alternatives.values() for item in items])
    def scale(key):
        size = sizes.get(key, {'error': 1})
        return 0 if 'error' in size else min(DIAGRAM_SCALE, TEXT_WIDTH_PT / size['width'], FIGURE_HEIGHT_PT / size['height'])
    for key, items in alternatives.items():
        candidates = [key] + [variant for variant, _ in items]
        chosen[key] = next((c for c in candidates if fits(sizes.get(c, {'error': 1}))), max(candidates, key=scale))
    return sizes, chosen


def pair_figures(text, chapter, manifest):
    """Figurpar enligt bok.yaml (figurpar: kapitel och två bildfiler): den andra figuren flyttas upp bredvid den första,
    båda lika höga och med var sin bildtext (#figure-row i mallen), så att de hamnar på samma sida."""
    for spec in manifest.get('figurpar') or []:
        if spec['kapitel'] != chapter['path']:
            continue
        found = []
        for name in spec['figurer']:
            match = re.search(r'!\[((?:[^\]\\]|\\.)*)\]\(figurer/' + re.escape(name) + r'\)\{[^}]*\}\n?', text)
            if not match:
                report.add('figurpar', chapter['path'], f'{name} hittades inte; figurerna står var för sig')
                break
            found.append((match, name))
        else:
            items = []
            for match, name in found:
                file = BUILD / 'figurer' / name
                if file.suffix.lower() == '.svg':
                    box = re.search(r'viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)', file.read_text(encoding='utf-8'))
                    aspect = float(box.group(1)) / float(box.group(2))
                else:
                    with Image.open(file) as image:
                        aspect = image.width / image.height
                caption = re.sub(r'\\(.)', r'\1', match.group(1))
                items.append(f'("figurer/{name}", {json.dumps(caption, ensure_ascii=False)}, {aspect:.4f})')
            first, second = found[0][0], found[1][0]
            row = '```{=typst}\n#figure-row(' + ', '.join(items) + ')\n```\n'
            text = text[:second.start()] + text[second.end():]
            text = text[:first.start()] + row + text[first.end():]
            report.add('figurpar', chapter['path'], f'{" och ".join(spec["figurer"])} står sida vid sida')
    return text


def place_figures(text, book, sizes, chosen, where):
    """Alla diagram i samma skala (DIAGRAM_SCALE), så att texten i figurerna är lika stor. Ett diagram som inte ryms
    ens i omgjord form förminskas och rapporteras."""
    def figure(match):
        key, caption = match.group(1).split('|', 1)
        size = sizes.get(chosen.get(key, key), {})
        if 'error' in size or not size:
            report.add('diagramfel', where, f'{key}: {size.get("error", "renderades inte")}; källkoden återges')
            return f'```\n{book.diagrams[key]}\n```'
        if re.search(r'-v\d+$', chosen[key]):
            report.add('diagram omgjort', where, f'{key} ryms inte i bokens skala; omgjord version {chosen[key]} används')
        w, h = size['width'], size['height']
        scale = min(DIAGRAM_SCALE, TEXT_WIDTH_PT / w, FIGURE_HEIGHT_PT / h)
        if scale < DIAGRAM_SCALE:
            report.add('diagram förminskat', where, f'{chosen[key]}: {w:.0f} x {h:.0f} pt ryms inte; skala {scale:.2f} i stället för {DIAGRAM_SCALE}')
        percent = round(w * scale / TEXT_WIDTH_PT * 100, 2)
        return f'![{caption}](diagram/{chosen[key]}.pdf){{width={percent}%}}'
    return re.sub(r'@@FIGURE:(.+?)@@', figure, text)


def source_words(markdown):
    text = re.sub(r'```.*?```', ' ', markdown, flags=re.S)
    text = re.sub(r'\$\$.*?\$\$|\$[^$\n]+\$', ' ', text, flags=re.S)
    text = re.sub(r'\]\([^)]*\)|\{[^}\n]*\}|<https?://[^>]+>|https?://\S+|@@[^@]+@@', ' ', text)
    return set(re.findall(r'[A-Za-zÅÄÖåäöÉéÜü]{4,}', text))


def main():
    if '--manifest' in sys.argv or not MANIFEST.exists():
        write_manifest()
        if '--manifest' in sys.argv:
            return
    pandoc, typst = tool('pandoc'), tool('typst')
    manifest = yaml.safe_load(MANIFEST.read_text(encoding='utf-8'))
    if BUILD.exists():
        for old in BUILD.glob('*'):
            if old.is_file():
                old.unlink()
        shutil.rmtree(BUILD / 'figurer', ignore_errors=True)
    BUILD.mkdir(parents=True, exist_ok=True)
    book = Book(manifest)
    print(f'{len(manifest["delar"])} delar, {len(book.chapters)} kapitel och underkapitel')

    converted = {c['index']: book.convert(c, c['body']) for c in book.chapters}
    sizes, chosen = render_diagrams(book)
    commit = run(['git', '-C', ROOT, 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True).stdout.strip()
    dirty = run(['git', '-C', ROOT, 'status', '--porcelain', '--', 'kompendium'], capture_output=True, text=True).stdout.strip()
    meta = {'title': manifest['titel'], 'subtitle': manifest.get('undertitel', ''), 'lang': 'sv',
            'version': commit + (' (med ändringar som inte är committade)' if dirty else ''),
            'date': date.today().isoformat(), 'site': manifest.get('webbplats', '')}
    parts = ['---\n' + yaml.safe_dump(meta, allow_unicode=True) + '---\n']
    for p, part in enumerate(manifest['delar'], 1):
        parts.append(f'# {part["titel"]} {{#d{p}}}\n')
        for chapter in (c for c in book.chapters if c['part'] == p):
            parts.append(place_figures(pair_figures(converted[chapter['index']], chapter, manifest), book, sizes, chosen, chapter['path']) + '\n')
    markdown = '\n'.join(parts)
    # Länkar till rubriker som inte finns leder till kapitlet i stället (rapporteras)
    def check_anchor(match):
        anchor = match.group(1)
        if anchor in book.anchors or re.fullmatch(r'd\d+', anchor) or anchor in (manifest.get('ersatta_kapitel') or {}).values():
            return match.group(0)
        chapter = re.match(r'(c\d+)', anchor).group(1)
        report.add('saknat ankare', anchor, f'rubriken finns inte; länken leder till kapitlets början')
        return f'](#{chapter})'
    markdown = re.sub(r'\]\(#(c\d+[^)]*)\)', check_anchor, markdown)
    (BUILD / 'bok.md').write_text(markdown, encoding='utf-8')

    print('pandoc …')
    result = subprocess.run([pandoc, BUILD / 'bok.md', '-f', 'markdown+pipe_tables+task_lists+tex_math_dollars+fenced_divs'
                             '+implicit_figures+link_attributes+header_attributes+strikeout+raw_html+lists_without_preceding_blankline', '-t', 'typst',
                             '--template', PUBLISH / 'mall.typ', '--lua-filter', PUBLISH / 'filter.lua',
                             '--resource-path', BUILD, '--wrap=none', '-o', BUILD / 'bok.typ'], capture_output=True, text=True)
    for line in result.stderr.splitlines():
        if line.startswith('RAPPORT:'):
            kind, _, text = line[len('RAPPORT:'):].partition(':')
            if kind != 'kodblock':   # kodblock rapporteras redan av förbehandlingen
                report.add(kind, 'Pandoc', text)
        elif line.strip():
            report.add('pandoc-varning', 'Pandoc', line.strip())
    if result.returncode:
        sys.exit('Pandoc misslyckades:\n' + result.stderr)

    print('typst …')
    result = subprocess.run([typst, 'compile', '--root', BUILD, BUILD / 'bok.typ', PDF], capture_output=True, text=True)
    typst_messages = [line for line in result.stderr.splitlines() if line.strip()]
    if result.returncode:
        REPORT.write_text('# Bygget misslyckades\n\n```\n' + result.stderr + '\n```\n', encoding='utf-8')
        sys.exit('Typst misslyckades:\n' + result.stderr)
    for line in typst_messages:
        if line.startswith('warning:'):
            report.add('typst-varning', 'Typst', line[len('warning:'):].strip())

    checks = validate(book, converted, typst)
    write_report(book, manifest, checks, meta)
    print('sparad', PDF)
    print('rapport', REPORT)


# ───────── Validering ─────────
def query(typst, selector, field=None):
    cmd = [typst, 'query', '--root', BUILD, BUILD / 'bok.typ', selector] + (['--field', field] if field else [])
    return json.loads(run(cmd, capture_output=True, text=True).stdout)


def validate(book, converted, typst):
    checks = []
    def check(name, ok, detail):
        checks.append((name, ok, detail))

    levels = Counter(query(typst, 'heading.where(outlined: true)', 'level'))   # inte innehållsförteckningens rubrik
    parts, chapters = len(book.manifest['delar']), sum(1 for c in book.chapters if c['depth'] == 0)   # underkapitel är nivå 3
    check('Delar (nivå 1)', levels[1] == parts, f'{levels[1]} i boken, {parts} i manifestet')
    check('Kapitel (nivå 2)', levels[2] == chapters, f'{levels[2]} i boken, {chapters} i manifestet')
    kinds = Counter(query(typst, 'figure', 'kind'))
    images = sum(len(re.findall(r'!\[\[[^\]]+\.(?:png|jpe?g|gif|webp|svg|pdf)(?:\|[^\]]*)?\]\]', c['body'], re.I)) for c in book.chapters)
    diagrams = sum(len(re.findall(r'^```mermaid', c['body'], re.M)) for c in book.chapters)
    tables = sum(len(re.findall(r'^\|.*\|\s*\n\|\s*:?-', c['body'], re.M)) for c in book.chapters)
    final = (BUILD / 'bok.md').read_text(encoding='utf-8')
    in_book = len(re.findall(r'\]\((?:figurer|diagram)/', final)) + len(re.findall(r'\("figurer/', final))   # även figurpar
    placed = len(query(typst, 'image'))
    check('Bilder och diagram', in_book == placed == images + diagrams,
          f'{images} bilder och {diagrams} diagram i källan; {placed} i boken, varav {kinds.get("image", 0)} med bildtext; '
          f'diagrammen i skala {DIAGRAM_SCALE} utom {len(report.items.get("diagram förminskat", []))} förminskade')
    check('Tabeller', kinds.get('table', 0) == tables, f'{tables} i källan, {kinds.get("table", 0)} i boken')
    links = query(typst, 'link', 'dest')
    internal = [l for l in links if isinstance(l, str) and l.startswith('<')] + [l for l in links if isinstance(l, dict)]
    external = [l for l in links if isinstance(l, str) and not l.startswith('<')]
    unresolved = len(report.items.get('olöst wikilänk', [])) + len(report.items.get('saknat ankare', []))
    check('Interna länkar', unresolved == 0, f'{len(internal)} länkar inom boken, alla mål finns (Typst kontrollerar varje ankare); '
          f'{unresolved} olösta eller omdirigerade')
    check('Externa länkar', True, f'{len(external)} länkar till webbplatser')

    info = run(['pdfinfo', PDF], capture_output=True, text=True).stdout
    pages = int(re.search(r'Pages:\s+(\d+)', info).group(1))
    size = re.search(r'Page size:\s+([\d.]+) x ([\d.]+)', info)
    check('Sidformat A4', abs(float(size.group(1)) - 595.28) < 1 and abs(float(size.group(2)) - 841.89) < 1, f'{size.group(1)} x {size.group(2)} pt, {pages} sidor')
    outline = run(['pdftotext', '-f', '1', '-l', '1', PDF, '-'], capture_output=True, text=True).stdout   # verifierar läsbarhet
    raster = run(['pdfimages', '-list', PDF], capture_output=True, text=True).stdout.splitlines()[2:]
    raster_sources = sum(1 for c in book.chapters for f in re.findall(r'!\[\[([^\]|]+\.(?:png|jpe?g|gif|webp))', c['body'], re.I))
    check('Rasterbilder i PDF:en', len(raster) >= raster_sources, f'{len(raster)} bildobjekt för {raster_sources} rasterbilder i källan')

    # Textens fullständighet: varje ord (minst fyra bokstäver) i källan ska finnas i PDF:ens text
    # Typst avstavar med mjukt bindestreck (U+00AD); textutdraget kan tappa mellanrum på hårt justerade rader,
    # så ord söks både som ord och som delsträng i texten utan mellanrum
    text = run(['pdftotext', PDF, '-'], capture_output=True, text=True).stdout
    text += '\n' + run(['pdftotext', '-raw', PDF, '-'], capture_output=True, text=True).stdout
    text = re.sub(r'\u00ad\s*', '', text)
    text = re.sub(r'(\w)-\n(\w)', r'\1\2', text)
    pdf_words = set(re.findall(r'[A-Za-zÅÄÖåäöÉéÜü]{4,}', text)) | set(re.findall(r'[A-Za-zÅÄÖåäöÉéÜü]{4,}', text.replace('\n', '')))
    missing_total, coverage = 0, []
    for chapter in book.chapters:
        words = source_words(converted[chapter['index']])
        flat = re.sub(r'\s+', '', text).lower()
        missing = sorted(w for w in words if w not in pdf_words and w.lower() not in flat)
        missing_total += len(missing)
        if missing:
            coverage.append(f'{chapter["path"]}: {", ".join(missing[:12])}' + (' …' if len(missing) > 12 else ''))
    check('Textens fullständighet', missing_total == 0,
          'alla ord i källan finns i PDF:en' if not missing_total else f'{missing_total} ord hittades inte i PDF:ens text (se nedan)')
    titles_missing = [c['title'] for c in book.chapters if c['title'] not in text.replace('\n', ' ')]
    check('Kapitelrubriker', not titles_missing, 'alla kapitelrubriker finns i PDF:en' if not titles_missing else ', '.join(titles_missing))

    # Sidrendering: tomma sidor och text utanför marginalerna
    (OUT / 'kontroll').mkdir(exist_ok=True)
    for old in (OUT / 'kontroll').glob('*.png'):
        old.unlink()
    run(['pdftoppm', '-png', '-r', '12', PDF, OUT / 'kontroll' / 'sida'])
    blank = []
    for image_path in sorted((OUT / 'kontroll').glob('sida-*.png')):
        with Image.open(image_path) as image:
            gray = image.convert('L')
            dark = sum(gray.histogram()[:200])
            if dark < 3:
                blank.append(int(re.search(r'(\d+)\.png$', image_path.name).group(1)))
        image_path.unlink()
    check('Tomma sidor', not blank, f'{len(blank)} tomma sidor'
          + (f': {", ".join(map(str, blank[:30]))}' if blank else ''))
    bbox = run(['pdftotext', '-bbox', PDF, '-'], capture_output=True, text=True).stdout
    # Text (även i diagram) får inte gå utanför sidans kanter eller ned i sidfoten
    outside, bottom = [], 841.89 - 18
    for number, page in enumerate(re.findall(r'<page [^>]*>(.*?)</page>', bbox, re.S), 1):
        for x0, y0, x1, y1, word in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', page):
            if float(x1) > 595.28 - 14 or float(x0) < 14 or float(y1) > bottom or float(y0) < 14:
                outside.append(f's. {number}: {word}')
    check('Innehåll inom sidan', not outside, 'inget innehåll utanför sidans kanter' if not outside else f'{len(outside)} ord: ' + '; '.join(outside[:20]))
    for p in [1, 2, 3]:
        run(['pdftoppm', '-png', '-r', '50', '-f', str(p), '-l', str(p), PDF, OUT / 'kontroll' / 'exempel'])
    return checks, coverage, pages


def write_report(book, manifest, result, meta):
    checks, coverage, pages = result
    lines = [f'# Byggrapport: {meta["title"]}', '',
             f'Byggd {meta["date"]} från version {meta["version"]} med Pandoc 3.13 och Typst 0.15.1. '
             f'{len(manifest["delar"])} delar, {sum(1 for c in book.chapters if c["depth"] == 0)} kapitel, '
             f'{sum(1 for c in book.chapters if c["depth"])} underkapitel, {pages} sidor A4.', '',
             f'PDF: `{PDF.relative_to(ROOT)}`  ', f'Mellanfiler: `{BUILD.relative_to(ROOT)}/` (bok.md, bok.typ, figurer, diagram)', '',
             '## Kontroller', '', '| Kontroll | Resultat | Detaljer |', '| :--- | :--- | :--- |']
    lines += [f'| {name} | {"OK" if ok else "**Avvikelse**"} | {detail} |' for name, ok, detail in checks]
    if coverage:
        lines += ['', '### Ord som inte hittades i PDF:ens text', '',
                  'Ord i källan som inte återfinns i PDF:ens textlager (ofta ord som avstavats över sidbrytning eller står i diagram).', '']
        lines += [f'- {line}' for line in coverage]
    lines += ['', '## Konverteringar, ostödda konstruktioner och varningar', '']
    order = ['olöst wikilänk', 'saknat ankare', 'saknad bild', 'saknad transklusion', 'diagramfel', 'ostödd inbäddning',
             'ostödd syntax', 'html', 'html-inline', 'div', 'callout', 'tvetydigt länkmål', 'transklusion', 'relativ länk',
             'manuell numrering', 'rubrik', 'kodblock', 'kommentar', 'bild', 'pandoc-varning', 'typst-varning']
    kinds = order + sorted(k for k in report.items if k not in order)
    if not report.items:
        lines.append('Inga.')
    for kind in kinds:
        items = report.items.get(kind)
        if not items:
            continue
        lines += [f'### {kind[0].upper() + kind[1:]} ({len(items)})', '']
        lines += [f'- `{where}`: {text}' for where, text in items[:60]]
        if len(items) > 60:
            lines.append(f'- … och {len(items) - 60} till')
        lines.append('')
    REPORT.write_text('\n'.join(lines) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()

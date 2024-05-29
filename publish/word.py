#!/usr/bin/env python3
"""Word-kopia av boken: export/bok/ECT-kompendium.docx.

Bygger på bokens mellanfil export/bok/build/bok.md (skapas av `npm run bok`), så kapitel, ordning, numrering och
bildtexter är desamma som i PDF:en. Formatet följer publish/mall.typ: Noto Sans överallt (brödtext 10 pt, tabeller
9 pt, rubriker 26/18/13/11 pt, nivå 4 i accentfärg), A4 med 25 mm marginal, marginaljusterad brödtext, tabeller med
enbart vågräta linjer, kursiva bildtexter, sidnummer i sidfoten och en innehållsförteckning som Word uppdaterar när
dokumentet öppnas. Diagram och figurer bäddas in som PNG i hög upplösning. Sidbrytningarna sätts av Word och kan
därför falla annorlunda än i PDF:en.

Kör: npm run word   (eller python3 publish/word.py efter npm run bok)
"""
import re
import shutil
import subprocess
import urllib.parse
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / 'export' / 'bok' / 'build'
WORK = BUILD / 'word'
OUT = ROOT / 'export' / 'bok' / 'ECT-kompendium.docx'
PANDOC = next(Path.home().glob('.cache/ect-publish/pandoc-*/bin/pandoc'), None)
FONT, ACCENT, INK = 'Noto Sans', '075D95', '0F0F0F'
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def run(args, **kw):
    return subprocess.run([str(a) for a in args], check=True, **kw)


# ───────── Bilder: PDF-diagram, SVG och WebP blir PNG (Word visar inte PDF eller WebP) ─────────
def png(source):
    target = WORK / (source.stem + '.png')
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return target
    if source.suffix == '.pdf':
        run(['pdftocairo', '-png', '-r', '220', '-singlefile', source, target.with_suffix('')])
    elif source.suffix == '.svg':
        run(['rsvg-convert', '-z', '2.5', '-o', target, source])
    else:
        with Image.open(source) as image:
            image.convert('RGB').save(target)
    return target


def prepare_markdown():
    text = (BUILD / 'bok.md').read_text(encoding='utf-8')
    # Figurpar (Typst-block i boken) blir två vanliga figurer med var sin bildtext
    def figure_row(match):
        items = re.findall(r'\("([^"]+)", "((?:[^"\\]|\\.)*)", [\d.]+\)', match.group(1))
        return '\n\n'.join(f'![{caption}]({path}){{width=48%}}' for path, caption in items)
    text = re.sub(r'```\{=typst\}\n#figure-row\((.*?)\)\n```', figure_row, text, flags=re.S)
    text = re.sub(r'```\{=typst\}\n.*?\n```', '', text, flags=re.S)   # övriga Typst-block gäller bara PDF:en
    def image(match):   # även bilder vars bildtext innehåller länkar; %20 i sökvägen avkodas
        return '](' + png(BUILD / urllib.parse.unquote(match.group(1))).name.replace(' ', '%20') + ')'
    text = re.sub(r'\]\(((?:figurer|diagram)/[^)]+?\.(?:pdf|svg|webp|png|jpe?g))\)', image, text)
    (WORK / 'bok.md').write_text(text, encoding='utf-8')


# ───────── Mall: pandocs standardmall med bokens typsnitt, storlekar, färger och A4-sida ─────────
def register_namespaces(xml):
    for prefix, uri in re.findall(r'xmlns:(\w+)="([^"]+)"', xml):
        ET.register_namespace(prefix, uri)


def q(tag):
    return f'{{{W}}}{tag}'


def set_child(parent, tag, attrs=None, first=False):
    for old in parent.findall(q(tag)):
        parent.remove(old)
    element = ET.Element(q(tag), {q(k): v for k, v in (attrs or {}).items()})
    parent.insert(0, element) if first else parent.append(element)
    return element


def props(style, kind):
    element = style.find(q(kind))
    if element is None:
        element = ET.SubElement(style, q(kind))
    return element


def run_props(rpr, size=None, bold=None, italic=None, color=None):
    set_child(rpr, 'rFonts', {'ascii': FONT, 'hAnsi': FONT, 'cs': FONT, 'eastAsia': FONT}, first=True)
    for tag, on in (('b', bold), ('i', italic)):
        if on is not None:
            set_child(rpr, tag, None if on else {'val': '0'})
    if color:
        set_child(rpr, 'color', {'val': color})
    if size:
        set_child(rpr, 'sz', {'val': str(size * 2)})
        set_child(rpr, 'szCs', {'val': str(size * 2)})


def style_by_name(root, name):
    for style in root.findall(q('style')):
        n = style.find(q('name'))
        if n is not None and n.get(q('val')).lower() == name.lower():   # Words inbyggda format heter t.ex. "heading 1"
            return style
    return None


def ensure_style(root, name, kind='paragraph', based='Normal'):
    style = style_by_name(root, name)
    if style is None:
        style = ET.SubElement(root, q('style'), {q('type'): kind, q('customStyle'): '1', q('styleId'): name.replace(' ', '')})
        ET.SubElement(style, q('name'), {q('val'): name})
        ET.SubElement(style, q('basedOn'), {q('val'): based})
    return style


def paragraph(style, before=None, after=None, line=None, justify=None, page_break=None, keep_next=None):
    ppr = props(style, 'pPr')
    if page_break is not None:
        set_child(ppr, 'pageBreakBefore', None if page_break else {'val': '0'})
    if keep_next:
        set_child(ppr, 'keepNext')
    if before is not None or after is not None or line is not None:
        attrs = {}
        if before is not None: attrs['before'] = str(before)
        if after is not None: attrs['after'] = str(after)
        if line is not None: attrs.update({'line': str(line), 'lineRule': 'auto'})
        set_child(ppr, 'spacing', attrs)
    if justify is not None:
        set_child(ppr, 'jc', {'val': 'both' if justify else 'left'})


def build_styles(xml):
    register_namespaces(xml)
    root = ET.fromstring(xml)
    defaults = root.find(q('docDefaults')).find(q('rPrDefault')).find(q('rPr'))
    run_props(defaults, size=10)
    set_child(defaults, 'lang', {'val': 'sv-SE', 'eastAsia': 'sv-SE', 'bidi': 'ar-SA'})
    for style in root.findall(q('style')):   # alla stycke- och teckenformat, även kod och citat, får Noto Sans
        if style.get(q('type')) in ('paragraph', 'character', 'table'):
            run_props(props(style, 'rPr'))
    for name in ('Normal', 'Body Text', 'First Paragraph', 'Compact'):
        style = style_by_name(root, name)
        if style is not None:
            run_props(props(style, 'rPr'), size=10)
            paragraph(style, before=0, after=0 if name == 'Compact' else 200, line=300, justify=name != 'Compact')
    sizes = {'Heading 1': (26, None), 'Heading 2': (18, None), 'Heading 3': (13, None), 'Heading 4': (11, ACCENT),
             'Heading 5': (10, None), 'Heading 6': (10, None)}
    for name, (size, color) in sizes.items():
        style = style_by_name(root, name)
        if style is None:
            continue
        run_props(props(style, 'rPr'), size=size, bold=name not in ('Heading 5', 'Heading 6'),
                  italic=name in ('Heading 5', 'Heading 6'), color=color or INK)
        paragraph(style, before={1: 0, 2: 0, 3: 320, 4: 260, 5: 200, 6: 200}[int(name[-1])], after=140,
                  page_break=name in ('Heading 1', 'Heading 2'), keep_next=True, justify=False)
    for name, size, color in (('Title', 32, INK), ('Subtitle', 14, '3C3C3C'), ('Author', 10, '464646'), ('Date', 10, '464646')):
        style = style_by_name(root, name)
        if style is not None:
            run_props(props(style, 'rPr'), size=size, bold=name == 'Title', color=color)
            paragraph(style, justify=False)
    for name in ('Image Caption', 'Table Caption', 'Caption'):
        style = style_by_name(root, name)
        if style is not None:
            run_props(props(style, 'rPr'), size=9, italic=True, color=INK)
            paragraph(style, before=60, after=200, justify=True)
    for name in ('TOC Heading',):
        style = style_by_name(root, name)
        if style is not None:
            run_props(props(style, 'rPr'), size=20, bold=True, color=INK)
    link = style_by_name(root, 'Hyperlink')
    if link is not None:
        run_props(props(link, 'rPr'), color=ACCENT)
    # Rutor (callouts) och upplysningar: vänsterlinje i accentfärg och ljus bakgrund
    for name, fill in (('Callout', 'EEF4F9'), ('Notice', 'F5F5F5')):
        style = ensure_style(root, name)
        run_props(props(style, 'rPr'), size=10)
        paragraph(style, before=40, after=40, line=280, justify=True)
        ppr = props(style, 'pPr')
        borders = set_child(ppr, 'pBdr')
        ET.SubElement(borders, q('left'), {q('val'): 'single', q('sz'): '18', q('space'): '8', q('color'): ACCENT})
        set_child(ppr, 'shd', {'val': 'clear', 'color': 'auto', 'fill': fill})
        set_child(ppr, 'ind', {'left': '170', 'right': '113'})
    # Tabeller: 9 pt, kraftig linje över och under rubrikraden och under tabellen, tunna linjer mellan raderna
    table = style_by_name(root, 'Table')
    if table is not None:
        run_props(props(table, 'rPr'), size=9)
        paragraph(table, before=0, after=0, line=250, justify=False)
        tblpr = props(table, 'tblPr')
        borders = set_child(tblpr, 'tblBorders')
        for side, size, color in (('top', '7', '282828'), ('left', None, None), ('bottom', '7', '282828'), ('right', None, None),
                                  ('insideH', '3', 'C8C8C8'), ('insideV', None, None)):
            attrs = {q('val'): 'single', q('sz'): size, q('space'): '0', q('color'): color} if size else {q('val'): 'nil'}
            ET.SubElement(borders, q(side), attrs)
        margins = set_child(tblpr, 'tblCellMar')
        for side, value in (('top', '60'), ('left', '100'), ('bottom', '60'), ('right', '100')):
            ET.SubElement(margins, q(side), {q('w'): value, q('type'): 'dxa'})
        for old in table.findall(q('tblStylePr')):
            table.remove(old)
        first = ET.SubElement(table, q('tblStylePr'), {q('type'): 'firstRow'})
        frpr = ET.SubElement(first, q('rPr'))
        ET.SubElement(frpr, q('b'))
        tcpr = ET.SubElement(first, q('tcPr'))
        tcb = ET.SubElement(tcpr, q('tcBorders'))
        ET.SubElement(tcb, q('bottom'), {q('val'): 'single', q('sz'): '5', q('space'): '0', q('color'): '282828'})
    reorder(root)
    return ET.tostring(root, encoding='unicode', xml_declaration=False)


# Elementordning enligt WordprocessingML-schemat (Word avvisar fel ordning)
ORDER = {
    'style': 'name aliases basedOn next link autoRedefine hidden uiPriority semiHidden unhideWhenUsed qFormat locked personal personalCompose personalReply rsid pPr rPr tblPr trPr tcPr tblStylePr',
    'pPr': 'pStyle keepNext keepLines pageBreakBefore framePr widowControl numPr suppressLineNumbers pBdr shd tabs suppressAutoHyphens kinsoku wordWrap overflowPunct topLinePunct autoSpaceDE autoSpaceDN bidi adjustRightInd snapToGrid spacing ind contextualSpacing mirrorIndents suppressOverlap jc textDirection textAlignment textboxTightWrap outlineLvl divId cnfStyle rPr sectPr pPrChange',
    'rPr': 'rStyle rFonts b bCs i iCs caps smallCaps strike dstrike outline shadow emboss imprint noProof snapToGrid vanish webHidden color spacing w kern position sz szCs highlight u effect bdr shd fitText vertAlign rtl cs em lang eastAsianLayout specVanish oMath',
    'tblPr': 'tblStyle tblpPr tblOverlap bidiVisual tblStyleRowBandSize tblStyleColBandSize tblW jc tblCellSpacing tblInd tblBorders shd tblLayout tblCellMar tblLook tblCaption tblDescription',
}


def reorder(element):
    for child in element:
        reorder(child)
    local = element.tag.split('}')[-1]
    if local in ORDER:
        rank = {name: i for i, name in enumerate(ORDER[local].split())}
        children = sorted(list(element), key=lambda c: rank.get(c.tag.split('}')[-1], len(rank)))
        for child in list(element):
            element.remove(child)
        element.extend(children)


FOOTER = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="{W}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>
<w:r><w:rPr><w:rFonts w:ascii="{FONT}" w:hAnsi="{FONT}"/><w:color w:val="505050"/><w:sz w:val="17"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>
<w:r><w:rPr><w:rFonts w:ascii="{FONT}" w:hAnsi="{FONT}"/><w:color w:val="505050"/><w:sz w:val="17"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
<w:r><w:rPr><w:rFonts w:ascii="{FONT}" w:hAnsi="{FONT}"/><w:color w:val="505050"/><w:sz w:val="17"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>
<w:r><w:rPr><w:rFonts w:ascii="{FONT}" w:hAnsi="{FONT}"/><w:color w:val="505050"/><w:sz w:val="17"/></w:rPr><w:t>1</w:t></w:r>
<w:r><w:rPr><w:rFonts w:ascii="{FONT}" w:hAnsi="{FONT}"/><w:color w:val="505050"/><w:sz w:val="17"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>
</w:p></w:ftr>'''


def build_reference():
    default = WORK / 'standard.docx'
    with default.open('wb') as handle:
        run([PANDOC, '--print-default-data-file', 'reference.docx'], stdout=handle)
    reference = WORK / 'mall.docx'
    with zipfile.ZipFile(default) as source, zipfile.ZipFile(reference, 'w', zipfile.ZIP_DEFLATED) as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename == 'word/styles.xml':
                data = build_styles(data.decode('utf-8')).encode('utf-8')
                data = b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + data
            elif item.filename == 'word/theme/theme1.xml':
                # Temats rubrik- och brödtextsnitt pekar också på Noto Sans
                data = re.sub(rb'(<a:(?:major|minor)Font><a:latin typeface=")[^"]*', rb'\1' + FONT.encode(), data)
            elif item.filename == 'word/document.xml':
                text = data.decode('utf-8')
                sect = ('<w:sectPr><w:footerReference w:type="default" r:id="rIdSidfot"/>'
                        '<w:pgSz w:w="11906" w:h="16838"/>'
                        '<w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="567" w:footer="567" w:gutter="0"/>'
                        '</w:sectPr>')
                text = re.sub(r'<w:sectPr\b.*?</w:sectPr>|<w:sectPr\b[^>]*/>', sect, text, flags=re.S)
                if 'xmlns:r=' not in text:
                    text = text.replace('<w:document ', '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ', 1)
                data = text.encode('utf-8')
            elif item.filename == 'word/_rels/document.xml.rels':
                data = data.replace(b'</Relationships>', b'<Relationship Id="rIdSidfot" '
                                    b'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" '
                                    b'Target="footer1.xml"/></Relationships>')
            elif item.filename == '[Content_Types].xml':
                data = data.replace(b'</Types>', b'<Override PartName="/word/footer1.xml" '
                                    b'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>')
            target.writestr(item, data)
        target.writestr('word/footer1.xml', FOOTER)
    return reference


LUA = r'''
-- Word: rutor och upplysningar får egna stycketyper; bokstavslistor A, B, C; övriga Typst-rester tas bort
function Div(div)
  if div.classes:includes('callout') then
    local blocks = {}
    for _, block in ipairs(div.content) do
      if block.t == 'Div' and block.classes:includes('callout-title') then
        table.insert(blocks, pandoc.Para({ pandoc.Strong(pandoc.utils.blocks_to_inlines(block.content)) }))
      else
        table.insert(blocks, block)
      end
    end
    return pandoc.Div(blocks, pandoc.Attr('', {}, { ['custom-style'] = 'Callout' }))
  end
  if div.classes:includes('notice') then
    return pandoc.Div(div.content, pandoc.Attr('', {}, { ['custom-style'] = 'Notice' }))
  end
  if div.classes:includes('letter-list') then
    return div:walk({ OrderedList = function(list)
      list.listAttributes = pandoc.ListAttributes(list.listAttributes.start, 'UpperAlpha', 'Period')
      return list
    end }).content
  end
end
-- Avdelare (---) blir luft som i boken, inte en heldragen linje
function HorizontalRule() return {} end
function RawBlock(raw) if raw.format ~= 'openxml' then return {} end end
function RawInline(raw)
  if raw.format == 'html' and raw.text:match('^<br%s*/?>$') then return pandoc.LineBreak() end
  if raw.format ~= 'openxml' then return {} end
end
'''


# ───────── Efterbearbetning: listtecken som i boken, inbäddat typsnitt och Word-inställningar ─────────
FONT_FILES = {'Regular': 'NotoSans-Regular.ttf', 'Bold': 'NotoSans-Bold.ttf', 'Italic': 'NotoSans-Italic.ttf',
              'BoldItalic': 'NotoSans-BoldItalic.ttf'}
BULLETS = ['•', '‣', '–']


def bullets(xml):
    """Punktlistornas tecken som i boken (•, ‣, –) i Noto Sans, med bokens kortare indrag."""
    def level(match):
        lvl, ilvl = match.group(0), int(match.group(1))
        indent = f'<w:ind w:left="{300 + ilvl * 300}" w:hanging="220" />'
        lvl = re.sub(r'<w:ind [^>]*/>', indent, lvl)
        if '<w:numFmt w:val="bullet"' in lvl and '☐' not in lvl:
            lvl = re.sub(r'<w:lvlText w:val="[^"]*" />', f'<w:lvlText w:val="{BULLETS[ilvl % 3]}" />', lvl)
            lvl = re.sub(r'<w:rPr>.*?</w:rPr>', '', lvl, flags=re.S)
            lvl = lvl.replace('</w:lvl>', f'<w:rPr><w:rFonts w:ascii="{FONT}" w:hAnsi="{FONT}" w:cs="{FONT}" /></w:rPr></w:lvl>')
        return lvl
    return re.sub(r'<w:lvl w:ilvl="(\d)".*?</w:lvl>', level, xml, flags=re.S)


def obfuscate(data, key):
    """Inbäddat typsnitt enligt ECMA-376: de första 32 byten XOR:as med nyckelns GUID i omvänd byteordning."""
    guid = bytes.fromhex(key.strip('{}').replace('-', ''))[::-1]
    head = bytes(b ^ guid[i % 16] for i, b in enumerate(data[:32]))
    return head + data[32:]


def finish(path):
    import uuid
    keys = {style: '{' + str(uuid.uuid4()).upper() + '}' for style in FONT_FILES}
    temp = path.with_suffix('.tmp')
    with zipfile.ZipFile(path) as source, zipfile.ZipFile(temp, 'w', zipfile.ZIP_DEFLATED) as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename == 'word/numbering.xml':
                data = bullets(data.decode('utf-8')).encode('utf-8')
            elif item.filename == 'word/fontTable.xml':
                text = re.sub(rf'<w:font w:name="{FONT}">.*?</w:font>', '', data.decode('utf-8'), flags=re.S)
                embeds = ''.join(f'<w:embed{style} r:id="rIdFont{style}" w:fontKey="{key}" />' for style, key in keys.items())
                text = text.replace('</w:fonts>', f'<w:font w:name="{FONT}"><w:charset w:val="00" /><w:family w:val="swiss" />'
                                    f'<w:pitch w:val="variable" />{embeds}</w:font></w:fonts>')
                data = text.encode('utf-8')
            elif item.filename == 'word/settings.xml':
                text = data.decode('utf-8')
                text = text.replace('<w:embedSystemFonts />', '<w:embedTrueTypeFonts /><w:embedSystemFonts />', 1)
                text = re.sub(r'(<w:defaultTabStop [^>]*/>)', r'\1<w:autoHyphenation />', text, count=1)
                text = text.replace('<w:rsids>', '<w:updateFields w:val="true" /><w:rsids>', 1)
                text = text.replace('<w:themeFontLang w:val="en-US" />', '<w:themeFontLang w:val="sv-SE" />')
                text = text.replace('<w:decimalSymbol w:val="." />', '<w:decimalSymbol w:val="," />')
                text = text.replace('<w:listSeparator w:val="," />', '<w:listSeparator w:val=";" />')
                data = text.encode('utf-8')
            elif item.filename == '[Content_Types].xml':
                for extension, kind in ((b'odttf', b'application/vnd.openxmlformats-officedocument.obfuscatedFont'),
                                        (b'png', b'image/png'), (b'jpeg', b'image/jpeg'), (b'jpg', b'image/jpeg')):
                    if b'Extension="' + extension + b'"' not in data:
                        data = data.replace(b'<Default ', b'<Default Extension="' + extension + b'" ContentType="' + kind + b'" /><Default ', 1)
            target.writestr(item, data)
        rels = ''.join(f'<Relationship Id="rIdFont{style}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" '
                       f'Target="fonts/{style}.odttf"/>' for style in FONT_FILES)
        target.writestr('word/_rels/fontTable.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                        f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{rels}</Relationships>')
        for style, name in FONT_FILES.items():
            font = next(Path(p) for p in ('/usr/share/fonts/noto', '/usr/share/fonts/truetype/noto') if (Path(p) / name).exists()) / name
            target.writestr(f'word/fonts/{style}.odttf', obfuscate(font.read_bytes(), keys[style]))
    temp.replace(path)


def main():
    if PANDOC is None:
        sys.exit('Pandoc saknas i ~/.cache/ect-publish; kör npm run bok först.')
    if not (BUILD / 'bok.md').exists():
        sys.exit('export/bok/build/bok.md saknas; kör npm run bok först.')
    WORK.mkdir(parents=True, exist_ok=True)
    prepare_markdown()
    reference = build_reference()
    (WORK / 'word.lua').write_text(LUA, encoding='utf-8')
    run([PANDOC, WORK / 'bok.md', '-f', 'markdown+pipe_tables+task_lists+tex_math_dollars+fenced_divs+implicit_figures'
         '+link_attributes+header_attributes+strikeout+raw_html+lists_without_preceding_blankline',
         '-t', 'docx', '--reference-doc', reference, '--lua-filter', WORK / 'word.lua', '--resource-path', WORK,
         '--number-sections', '--toc', '--toc-depth=2', '-M', 'toc-title=Innehåll', '-o', OUT])
    finish(OUT)
    print('sparad', OUT)


if __name__ == '__main__':
    main()

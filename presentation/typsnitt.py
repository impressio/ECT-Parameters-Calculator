"""Byter presentationens typsnitt till Noto Sans och bäddar in det, så att PowerPoint och LibreOffice visar samma sak.

Mallen använder Verdana. Verdana finns i Windows och macOS men inte i Linux, där LibreOffice ersätter det med Noto Sans
när bilderna och filmen renderas. Verdana är bredare med högre gemener, så samma punktstorlek såg större ut och bröts
annorlunda i PowerPoint. Med Noto Sans i filen och inbäddat (EOT, som PowerPoint lagrar inbäddade typsnitt) använder
båda programmen samma typsnitt. Noto Sans har licensen SIL Open Font License och får bäddas in.

Inbäddningen begränsas till tecknen i presentationen plus Latin-1 och vanliga skiljetecken och symboler."""
import io
import re
import struct
import zipfile
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

FONT = 'Noto Sans'
FILES = {'regular': Path('/usr/share/fonts/noto/NotoSans-Regular.ttf'),
         'bold': Path('/usr/share/fonts/noto/NotoSans-Bold.ttf')}
BASE_CHARS = ''.join(map(chr, range(0x20, 0x7F))) + ''.join(map(chr, range(0xA0, 0x100))) + \
    '‐‑‒–—‘’‚“”„•…‰‹›€−×÷±≤≥≈≠°µΩ→←↑↓·'
NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
RT_FONT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font'


def eot(ttf_bytes):
    """Okomprimerad Embedded OpenType (version 0x00020001) runt ett TrueType-typsnitt."""
    font = TTFont(io.BytesIO(ttf_bytes))
    os2, head, name = font['OS/2'], font['head'], font['name']
    p = os2.panose
    panose = bytes([p.bFamilyType, p.bSerifStyle, p.bWeight, p.bProportion, p.bContrast,
                    p.bStrokeVariation, p.bArmStyle, p.bLetterForm, p.bMidline, p.bXHeight])

    def text(name_id):
        value = name.getDebugName(name_id) or ''
        data = value.encode('utf-16-le')
        return struct.pack('<H', len(data)) + data

    header = struct.pack('<IIII', 0, len(ttf_bytes), 0x00020001, 0) + panose + struct.pack(
        '<BBIHH', 1, os2.fsSelection & 1, os2.usWeightClass, os2.fsType, 0x504C)
    header += struct.pack('<IIII', os2.ulUnicodeRange1, os2.ulUnicodeRange2, os2.ulUnicodeRange3, os2.ulUnicodeRange4)
    header += struct.pack('<II', os2.ulCodePageRange1, os2.ulCodePageRange2)
    header += struct.pack('<IIIIII', head.checkSumAdjustment, 0, 0, 0, 0, 0)[:-2]   # checksumma, Reserved1-4, Padding1
    header += text(1) + b'\0\0' + text(2) + b'\0\0' + text(5) + b'\0\0' + text(4) + b'\0\0' + struct.pack('<H', 0)
    total = len(header) + len(ttf_bytes)
    return struct.pack('<I', total) + header[4:] + ttf_bytes


def subset_font(path, chars):
    options = subset.Options()
    options.name_IDs = ['*']
    options.layout_features = ['*']
    options.notdef_outline = True
    options.hinting = True
    font = TTFont(path)
    sub = subset.Subsetter(options)
    sub.populate(text=chars)
    sub.subset(font)
    out = io.BytesIO()
    font.save(out)
    return out.getvalue()


def embed(path):
    """Byter Verdana mot Noto Sans i alla delar av presentationen och bäddar in Noto Sans (vanlig och fet)."""
    path = Path(path)
    with zipfile.ZipFile(path) as z:
        items = [(info, z.read(info.filename)) for info in z.infolist()]
    chars = set(BASE_CHARS)
    out = []
    for info, data in items:
        if info.filename.endswith('.xml') or info.filename.endswith('.rels'):
            text = data.decode('utf-8')
            text = re.sub(r'typeface="Verdana"( panose="[0-9A-F]*")?', f'typeface="{FONT}" panose="020B0502040504020204"', text)
            text = text.replace('<vt:lpstr>Verdana</vt:lpstr>', f'<vt:lpstr>{FONT}</vt:lpstr>')   # docProps/app.xml
            for t in re.findall(r'<a:t>([^<]*)</a:t>', text):
                chars.update(t)
            data = text.encode('utf-8')
        out.append((info, data))
    chars = ''.join(sorted(chars))
    fonts = {style: eot(subset_font(file, chars)) for style, file in FILES.items()}
    final = []
    for info, data in out:
        name = info.filename
        if name == '[Content_Types].xml' and b'Extension="fntdata"' not in data:
            data = data.replace(b'<Default ', b'<Default Extension="fntdata" ContentType="application/x-fontdata"/><Default ', 1)
        elif name == 'ppt/_rels/presentation.xml.rels':
            text = data.decode('utf-8')
            rels = ''.join(f'<Relationship Id="rIdFont{style.title()}" Type="{RT_FONT}" Target="fonts/{FONT.replace(" ", "")}-{style}.fntdata"/>'
                           for style in fonts)
            data = text.replace('</Relationships>', rels + '</Relationships>').encode('utf-8')
        elif name == 'ppt/presentation.xml':
            text = data.decode('utf-8')
            text = re.sub(r'<p:presentation ([^>]*?)saveSubsetFonts="1"', r'<p:presentation \1', text)
            text = text.replace('<p:presentation ', '<p:presentation embedTrueTypeFonts="1" saveSubsetFonts="1" ', 1)
            lst = (f'<p:embeddedFontLst><p:embeddedFont><p:font typeface="{FONT}" panose="020B0502040504020204" pitchFamily="34" charset="0"/>'
                   + ''.join(f'<p:{style} r:id="rIdFont{style.title()}"/>' for style in fonts) + '</p:embeddedFont></p:embeddedFontLst>')
            # Ordning i p:presentation: ... sldSz, notesSz, smartTags, embeddedFontLst, custShowLst, ..., defaultTextStyle
            text = re.sub(r'(<p:notesSz [^>]*/>)', r'\1' + lst, text, count=1)
            data = text.encode('utf-8')
        final.append((info, data))
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for info, data in final:
            z.writestr(info, data)
        for style, data in fonts.items():
            z.writestr(f'ppt/fonts/{FONT.replace(" ", "")}-{style}.fntdata', data)
    return {style: len(data) for style, data in fonts.items()}

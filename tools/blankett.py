"""Tar fram kompendiets Word-mall för ECT-listan ur den lokala blanketten.

  python3 tools/blankett.py "ECT - Mall.docx" "kompendium/Blanketter/ECT-lista.docx"

Ändringar mot originalet:
  - Datumet uppe till höger ("År ____ Månad __ Dag __") blir en datumkontroll i formatet 2026-01-01: i Word väljs
    datumet i en kalender,
    och kompendiets formulär fyller i det före nedladdningen (assets/kompendium/blankett.js).
  - Tabellens kolumnrubriker får 9 pt i stället för 10 pt.
  - Rubriken ECT-LISTA börjar vid tabellens vänsterkant och datumet slutar vid tabellens högerkant.
  - Personuppgifter och organisationsdata tas bort: skapare och senast ändrad av, utskriftsdatum, anpassade
    egenskaper (känslighetsetikett) och SharePoint-data (customXml), kopplad mall med sökväg samt Words
    revisions-id (rsid), antal sparningar och redigeringstid.

Kör skriptet igen på en ny version av blanketten när den ändras. Originalet läggs inte i Git."""
import re
import sys
import zipfile
from pathlib import Path

PLACEHOLDER = '____-____-____'   # tomt datum att fylla i för hand; samma text i blankett.js
HEADER_SIZE = 18                                  # halvpunkter: 9 pt
DROP = re.compile(r'^(customXml/.*|docProps/custom\.xml)$')


def date_control(run_props):
    """Datumkontroll (w:sdt) med svensk kalender; texten visas tills ett datum väljs."""
    return ('<w:sdt><w:sdtPr>' + run_props + '<w:alias w:val="Datum"/><w:tag w:val="ect-datum"/><w:id w:val="1867021"/>'
            '<w:showingPlcHdr/><w:date><w:dateFormat w:val="yyyy-MM-dd"/><w:lid w:val="sv-SE"/>'
            '<w:storeMappedDataAs w:val="dateTime"/><w:calendar w:val="gregorian"/></w:date></w:sdtPr>'
            f'<w:sdtContent><w:r>{run_props}<w:t xml:space="preserve">{PLACEHOLDER}</w:t></w:r></w:sdtContent></w:sdt>')


def heading_row(xml):
    """Rubrikraden: ECT-LISTA vid tabellens vänsterkant och datumet högerjusterat vid tabellens högerkant.

    Tabellen fyller satsytans bredd (sidbredd minus marginaler), så rubriken får inget indrag och datumet ett
    högerjusterat tabbstopp vid satsytans högerkant; de många tabbarna i originalet ersätts av en."""
    section = re.search(r'<w:pgSz w:w="(\d+)"[^>]*/><w:pgMar w:top="\d+" w:right="(\d+)" w:bottom="\d+" w:left="(\d+)"', xml)
    width = int(section.group(1)) - int(section.group(2)) - int(section.group(3))
    start = xml.index('<w:body><w:p ') + len('<w:body>')
    end = xml.index('</w:p>', start)
    paragraph = xml[start:end]
    paragraph = paragraph.replace('<w:ind w:firstLine="462"/><w:jc w:val="both"/>',
                                  f'<w:tabs><w:tab w:val="right" w:pos="{width}"/></w:tabs><w:ind w:left="0" w:firstLine="0"/>')
    tab = '<w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:tab/></w:r>'
    first = paragraph.index('<w:t>LISTA</w:t></w:r>') + len('<w:t>LISTA</w:t></w:r>')
    paragraph = paragraph[:first] + tab + paragraph[paragraph.index('<w:sdt>', first):]
    return xml[:start] + paragraph + xml[end:]


def document(xml):
    # Datumet: körningarna "År", " ________ Månad ____ ", "Da" och "g ____" ersätts av en datumkontroll
    start = xml.index('<w:t>År</w:t>')
    start = xml.rindex('<w:r ', 0, start) if xml.rfind('<w:r ', 0, start) > xml.rfind('<w:r>', 0, start) else xml.rindex('<w:r>', 0, start)
    end = xml.index('<w:t>g ____</w:t></w:r>', start) + len('<w:t>g ____</w:t></w:r>')
    props = re.search(r'<w:rPr>.*?</w:rPr>', xml[start:end]).group(0)
    xml = xml[:start] + date_control(props) + xml[end:]
    xml = heading_row(xml)
    # Kolumnrubrikerna: första raden i första tabellen
    row_start = xml.index('<w:tr ')
    row_end = xml.index('</w:tr>', row_start)
    row = xml[row_start:row_end]
    row = row.replace('<w:sz w:val="20"/><w:szCs w:val="20"/>', f'<w:sz w:val="{HEADER_SIZE}"/><w:szCs w:val="{HEADER_SIZE}"/>')
    size = f'<w:rPr><w:sz w:val="{HEADER_SIZE}"/><w:szCs w:val="{HEADER_SIZE}"/></w:rPr>'
    row = re.sub(r'(<w:r(?: [^>]*)?>)(<w:t[ >])', r'\1' + size + r'\2', row)   # körningar utan egen storlek (Namn, Avdelning)
    row = re.sub(r'(<w:pStyle w:val="TableParagraph"/><w:jc w:val="center"/>)(</w:pPr>)', r'\1' + size + r'\2', row)
    return xml[:row_start] + row + xml[row_end:]


def without_rsids(text):
    """Tar bort Words revisions-id (rsid), som kan kopplas till originalfilens redigeringshistorik."""
    text = re.sub(r' w:rsid\w*="[0-9A-F]{8}"', '', text)
    text = re.sub(r'<w:rsid w:val="[0-9A-F]{8}"/>', '', text)   # i formatmallar
    return re.sub(r'<w:rsids>.*?</w:rsids>', '', text, flags=re.S)


def clean_xml(name, text):
    if name.startswith('word/') and name.endswith('.xml'):
        text = without_rsids(text)
    if name.endswith('.rels'):
        return re.sub(r'<Relationship [^>]*Target="[^"]*(customXml/[^"]*|custom\.xml)"[^>]*/>', '', text)
    if name == '[Content_Types].xml':
        return re.sub(r'<Override [^>]*PartName="/(customXml/[^"]*|docProps/custom\.xml)"[^>]*/>', '', text)
    if name == 'docProps/core.xml':
        text = re.sub(r'<dc:creator>[^<]*</dc:creator>', '<dc:creator></dc:creator>', text)
        text = re.sub(r'<cp:lastModifiedBy>[^<]*</cp:lastModifiedBy>', '<cp:lastModifiedBy></cp:lastModifiedBy>', text)
        text = re.sub(r'<cp:lastPrinted>[^<]*</cp:lastPrinted>', '', text)
        text = re.sub(r'<cp:revision>[^<]*</cp:revision>', '<cp:revision>1</cp:revision>', text)
        return re.sub(r'<dc:title>[^<]*</dc:title>', '<dc:title>ECT-lista</dc:title>', text)
    if name == 'docProps/app.xml':
        text = re.sub(r'<(Company|Manager)>[^<]*</\1>', r'<\1></\1>', text)
        text = re.sub(r'<TotalTime>[^<]*</TotalTime>', '<TotalTime>0</TotalTime>', text)
        return text.replace('<vt:lpstr>ECT – JOURNAL</vt:lpstr>', '<vt:lpstr>ECT-lista</vt:lpstr>')
    if name == 'word/settings.xml':
        return re.sub(r'<w:attachedTemplate [^>]*/>', '', text)
    if name == 'word/document.xml':
        return document(text)
    return text


def main(source, target):
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source) as z:
        items = [(info, z.read(info.filename)) for info in z.infolist() if not DROP.match(info.filename)]
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
        for info, data in items:
            if info.filename.endswith('.xml') or info.filename.endswith('.rels'):
                data = clean_xml(info.filename, data.decode('utf-8')).encode('utf-8')
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)
    print('sparad', target)


if __name__ == '__main__':
    main(*sys.argv[1:3])

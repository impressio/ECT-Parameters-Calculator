"""Tar bort personuppgifter och organisationsdata ur en PowerPoint-fil.

Mallen kommer från VGR:s dokumentbibliotek och bar med sig:
  - ppt/authors.xml: namn, e-post och konto-id för personer som kommenterat mallen;
  - docProps/core.xml: skapare och senast ändrad av;
  - docProps/custom.xml: VGR:s känslighetsetikett (MSIP) med organisations-id;
  - customXml/: SharePoint-data från dokumentbiblioteket.
De delarna tas bort (med sina relationer och innehållstyper), och skapare och senast ändrad av töms.
Används av build.py och ljud.py; kör direkt för att rensa en fil: python3 presentation/metadata.py FIL.pptx"""
import re
import sys
import zipfile
from pathlib import Path

DROP = re.compile(r'^(ppt/authors\.xml|docProps/custom\.xml|customXml/.*)$')


def clean(path):
    path = Path(path)
    with zipfile.ZipFile(path) as z:
        items = [(info, z.read(info.filename)) for info in z.infolist()]
    removed = [info.filename for info, _ in items if DROP.match(info.filename)]
    out = []
    for info, data in items:
        name = info.filename
        if DROP.match(name):
            continue
        if name.endswith('.rels'):
            text = data.decode('utf-8')
            # Relationer till borttagna delar (författare, anpassade egenskaper, customXml)
            text = re.sub(r'<Relationship [^>]*Target="[^"]*(authors\.xml|custom\.xml|customXml/[^"]*)"[^>]*/>', '', text)
            data = text.encode('utf-8')
        elif name == '[Content_Types].xml':
            text = data.decode('utf-8')
            text = re.sub(r'<Override [^>]*PartName="/(ppt/authors\.xml|docProps/custom\.xml|customXml/[^"]*)"[^>]*/>', '', text)
            data = text.encode('utf-8')
        elif name == 'docProps/core.xml':
            text = data.decode('utf-8')
            text = re.sub(r'<dc:creator>[^<]*</dc:creator>', '<dc:creator></dc:creator>', text)
            text = re.sub(r'<cp:lastModifiedBy>[^<]*</cp:lastModifiedBy>', '<cp:lastModifiedBy></cp:lastModifiedBy>', text)
            data = text.encode('utf-8')
        elif name == 'docProps/app.xml':
            text = data.decode('utf-8')
            text = re.sub(r'<(Company|Manager)>[^<]*</\1>', r'<\1></\1>', text)
            data = text.encode('utf-8')
        out.append((info, data))
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for info, data in out:
            z.writestr(info, data)
    return removed


if __name__ == '__main__':
    for file in sys.argv[1:]:
        print(file, 'borttaget:', ', '.join(clean(file)) or 'inget')

# ECT Parameters

An interactive teaching resource on the stimulus parameters of electroconvulsive therapy (ECT) for the MECTA spECTrum 5000Q: pulse width, frequency, duration and current, the resulting charge, voltage and energy, and what the pulses do to neurons. Live at [ect.matty.se](https://ect.matty.se). In Swedish the site also contains an ECT compendium for treatment teams, which is also available as a typeset A4 book: [`export/bok/ECT-kompendium.pdf`](export/bok/ECT-kompendium.pdf).

## 1. Running locally

The site is static HTML, CSS and JavaScript with CDN libraries (Chart.js with its annotation plugin, MathJax, Mermaid) and the Inter font; there is no build step. The compendium fetches its Markdown chapters and a WebAssembly renderer, which browsers block for pages opened from disk, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000), or [http://localhost:8000/#/kompendium/](http://localhost:8000/#/kompendium/) for the compendium. Add `?lang=sv` or `?lang=en` to choose the language; the choice is remembered.

## 2. Calculator and simulations

- **Calculator:** sliders for pulse width, frequency, duration, current and impedance; the charge (mC), voltage and energy, the current and voltage over time, and the dose table by sex and age.
- **Neuron stimulation:** a cross-section through scalp, skull and cortex under the two electrodes, with six pyramidal neurons at three distances and the alternating pulse polarity; the strength-duration curve, rheobase and chronaxie.
- **Action potential in a single neuron:** one pulse at a node of Ranvier of a human myelinated nerve fiber at 37 °C (Hodgkin-Huxley-type model after Schwarz, Reid and Bostock 1995, with the parameters of Wesselink et al. 1999; resting potential set to −70 mV as at the cell body), with the membrane, ion channels and the phases of the action potential.
- **Pulse train along a myelinated axon:** the device's pulse train applied to a myelinated axon, with direct excitation near the electrode and saltatory conduction along the nodes of Ranvier.
- **Synaptic transmission:** the steps of chemical transmission and the excitatory postsynaptic potential (EPSP).

The models are schematic illustrations for teaching, not quantitative predictions. Interface texts are in `assets/i18n/en.json` and `sv.json`; Swedish uses decimal commas.

## 3. Compendium

The Markdown files in `kompendium/` are the sources of the Swedish compendium and are edited directly in this repository; figures are in `kompendium/Figurer/`, which holds only images embedded in a chapter (the test checks this). Each part folder except *11 Källor och litteraturöversikt* (itself the bibliography) ends with a file *NN Referenser* that holds the reference lists of all chapters in the part, in chapter order; the chapters themselves end without them. File names match the chapter titles, with ` - ` for a colon. The same file name may occur in several folders; the renderer only rejects a link that uses such an ambiguous name, so link to these files with the folder path (`[[05 Dosering/08 Referenser|Referenser]]`). Local reference material in `kompendium/Referenser/` is ignored by Git and never published. Use hyphens (-), not dashes.

The chapters are rendered in the browser by a Rust renderer compiled to WebAssembly (`assets/kompendium/ect_markdown.wasm`). It handles internal links (`[[chapter|text]]`), embedded images, callouts, tables, checklists, formulas and HTML sanitizing; JavaScript loads the module, fetches the chapters and handles navigation and search. Rendered chapters are kept for the visit, and the previous and next chapters are prepared in advance; the search text is downloaded on the first search, and MathJax runs only on chapters with formulas. Node.js 20 or later is needed for the commands below, but no npm packages:

```bash
npm run build:index        # rebuild the chapter index (index.json) and search text (search.json) after editing chapters
npm run build:kompendium   # rebuild the WebAssembly renderer after changing the Rust code (needs rustup)
npm run test:kompendium    # render every chapter and check links, images, checklists and diagrams
npm run export:pdf         # quick A5 e-book PDF for review as rendered by the site: export/ECT-kompendium.pdf (not committed; needs chromium)
npm run word               # Word copy of the book after npm run bok: export/bok/ECT-kompendium.docx (same fonts and styles; not committed)
npm run bok                # whole compendium as an A4 book (Pandoc + Typst): export/bok/ECT-kompendium.pdf and rapport.md
```

The Rust toolchain and WebAssembly target are pinned in `tools/markdown-renderer/rust-toolchain.toml` and the dependencies in `Cargo.lock`. Changes to the Rust code require rebuilding the `.wasm` file and committing it with them; the build folder `target/` is ignored by Git. `.nojekyll` makes GitHub Pages serve the files as they are, so the Markdown chapters are not converted by Jekyll.

The forms in section 10 run entirely in the browser. The ECT journal form draws the answers onto `kompendium/Blanketter/ECT-journal.pdf` with pdf-lib, which is kept in `assets/kompendium/vendor/` (version and SHA-256 in `pdf-lib.LICENSE.txt`) instead of being loaded from a CDN, so no third-party code runs on the page where patient data is entered. The workflow `.github/workflows/pdf-lib.yml` checks npm on the first of every month and, if there is a newer version, fetches it with `npm run vendor:pdf-lib -- VERSION`, runs the compendium tests and opens a pull request for review; master is never changed automatically. It needs *Allow GitHub Actions to create and approve pull requests* (Settings → Actions → General). With pdf-lib listed in `package.json`, Dependabot alerts (Settings → Code security) also report known vulnerabilities.

### Book (A4, Pandoc and Typst)

`publish/build.py` builds the compendium as a typeset A4 book for distribution, treating the vault `kompendium/` as read-only source; everything it generates goes to `export/bok/`. The finished book `export/bok/ECT-kompendium.pdf` is committed; the report and intermediate files are ignored by Git. `publish/bok.yaml` is the explicit hierarchy: parts (vault folders) and chapters (files) in order; `python3 publish/build.py --manifest` regenerates it from the tracked files. Each chapter is preprocessed: front matter and `%%comments%%` are removed, wikilinks (`[[file#heading|text]]`) become links within the book, embedded images (`![[image|alt]]` with the following `*Figur …*` line) become figures with their caption, embedded notes are inserted, callouts become boxes, Mermaid diagrams are rendered to vector PDF in Chromium (`publish/mermaid.mjs`, same Mermaid version and theme as the site, tighter spacing for print), and headings move one level down under the parts with unique anchors. All diagrams are printed at one scale so their text is the same size; a diagram that does not fit is replaced by a book version from `publish/diagram/<id>.mmd` (named after the start of the SHA-1 of the source diagram, reported as stale when the source changes) or by an automatically redesigned variant (other line wrapping, hexagonal decisions, turned direction). Pandoc 3.13 (`publish/filter.lua`) converts the result to Typst, and Typst 0.15.1 (`publish/mall.typ`) typesets it: title page, table of contents, numbered parts, chapters and sections (headings that already carry a manual number keep it and are not numbered again), running headers, page numbers and PDF bookmarks, A4 with 25 mm margins, Noto Sans throughout with Swedish hyphenation, tables with horizontal rules only and column widths from their content, subsections kept on one page when they fit, chapters with subchapters (`fil:` and `underkapitel:` in `bok.yaml`, numbered 5.1.1 and so on, each on a new page), each part's chapter *Referenser* set unnumbered at the end of the part, and a page break before the headings listed under `sidbrytning_fore` in `bok.yaml`. Both tools are downloaded on first use to `~/.cache/ect-publish` and verified by SHA-256.

The build validates the result and writes `export/bok/rapport.md`: parts, chapters, images, diagrams, tables and links are counted in the Typst document and compared with the source; every word of the source is looked up in the PDF's text; pages are rasterized to find unexpected blank pages and content outside the page. The report also lists unsupported or converted constructs (raw HTML, forms that only work on the website, relative links, unresolved wikilinks, missing images or anchors, Pandoc and Typst warnings).

## 4. Presentation

`presentation/ECT vid bordet.pptx` is a Swedish slide deck for the treatment team (about 30 minutes plus questions), built on the Sahlgrenska University Hospital template. It is generated by `presentation/build.py` from `mall.pptx` (the original template, whose instruction slides the script removes), the images in `bilder/` and the speaker notes in `anteckningar.json`, one entry per slide. The template's Verdana is replaced by Noto Sans, which `presentation/typsnitt.py` embeds (subset, as EOT) so that PowerPoint shows the same font and line breaks as LibreOffice and the video; Verdana is not available on Linux, where LibreOffice substitutes Noto Sans. `presentation/metadata.py` removes the metadata the template brought from the hospital's document library (author list with names and email addresses, creator, sensitivity label and SharePoint data) from the template and from both generated presentations. Edit the slides in the script and the notes in the JSON file, then run:

```bash
python3 presentation/build.py          # needs python-pptx, lxml, fontTools and Noto Sans; writes ECT vid bordet.pptx
```

The film slides link to TED.com and YouTube; no videos are stored in the repository.

The speaker notes are written for text-to-speech (units and abbreviations spelled out). `presentation/transkript.py` writes them to `presentation/tal/`: one text file per slide and `manus.txt` with all notes in order, separated by the ElevenLabs v3 and v4 audio tag `[long pause]`. Each slide starts with a pace tag, `[calm, measured pace]` or, on slides with measured values, `[slow, deliberate pace]`; the overall tempo is set with the voice's Speed setting:

```bash
python3 presentation/transkript.py     # run after build.py; writes presentation/tal/
```

`presentation/ljud.py` synchronizes a recorded narration with the slides. `tidslinje` transcribes the audio with whisper.cpp (`whisper-cli` and a ggml model) and stores where each slide starts in `presentation/tal/tidslinje.json`; `bygg` adds a pause after each slide change (`--paus`, default 1.0 s; the speaking rate is unchanged), splits the audio into one WAV clip per slide and writes `ECT vid bordet med ljud.pptx`, where each slide plays its clip automatically and advances when it ends (a hidden autoplay audio object that only PowerPoint reads, and a transition sound that only LibreOffice Impress reads), and the video `ECT vid bordet.mp4` (1920 × 1080). It needs ffmpeg, LibreOffice and pdftoppm. The narration audio and the clips are ignored by Git; the narrated presentation and the video are committed.

```bash
python3 presentation/ljud.py tidslinje narration.wav --modell ggml-large-v3-turbo-q5_0.bin
python3 presentation/ljud.py bygg narration.wav
```

## 5. Project structure

```
ECT-Parameters-Calculator/
├── assets/
│   ├── i18n/
│   │   ├── en.json                  # English texts
│   │   └── sv.json                  # Swedish texts
│   ├── icons/
│   │   └── favicon.ico              # browser icon
│   ├── images/
│   │   ├── 5000Q.png                # MECTA spECTrum 5000Q
│   │   ├── flag-se.png              # language buttons
│   │   └── flag-us.png
│   └── kompendium/
│       ├── ect_markdown.wasm        # Markdown renderer (Rust)
│       ├── blankett.js              # date form that fills in and downloads the Word templates
│       ├── datum.js                 # Swedish date picker (ÅÅÅÅ-MM-DD) used by the forms
│       ├── expand-content.js        # full-width figures and tables
│       ├── journal.js               # web form for the ECT journal; draws the answers onto the PDF with pdf-lib
│       ├── vendor/                  # pdf-lib (MIT), served from the site so form data never leaves the browser
│       ├── index.json               # chapter index
│       ├── kompendium.css           # compendium layout
│       ├── kompendium.js            # navigation and search
│       ├── search.json              # search text, loaded on the first search
│       ├── THIRD_PARTY_LICENSES.txt # licenses of the Rust crates
│       └── wasm-loader.js           # WebAssembly loader
├── css/
│   └── styles.css                   # layout and typography
├── js/
│   ├── i18n.js                      # text lookup
│   ├── illustration.js              # shared drawing helpers
│   ├── main.js                      # calculator, language
│   ├── neuron-sim.js                # neuron stimulation
│   └── single-neuron.js             # action potential, axon, synapse
├── kompendium/                      # compendium chapters (Markdown, Swedish)
│   ├── 01 Start och introduktion/
│   ├── 02 Indikationer och bedömning/
│   ├── 03 Apparatur och fysik/
│   ├── 04 Elektrodplacering/
│   ├── 05 Dosering/
│   ├── 06 Anestesi/
│   ├── 07 Behandlingsgenomförande/
│   ├── 08 Biverkningar och komplikationer/
│   ├── 09 Uppföljning och underhållsbehandling/
│   ├── 10 Lathundar, checklistor och blanketter/
│   ├── 11 Källor och litteraturöversikt/
│   ├── Blanketter/                  # forms used by the compendium: ECT-lista.docx (Word) and ECT-journal.pdf
│   └── Figurer/                     # compendium figures
├── presentation/
│   ├── bilder/                      # images embedded in the slides
│   ├── anteckningar.json            # speaker notes, one entry per slide
│   ├── build.py                     # builds the slides from the template, images and notes (python-pptx)
│   ├── ljud.py                      # syncs a recorded narration: per-slide audio, narrated pptx and video
│   ├── tal/                         # transcripts for text-to-speech, manus.txt and tidslinje.json
│   ├── transkript.py                # writes the transcripts from the speaker notes
│   ├── metadata.py                  # removes personal and organizational metadata inherited from the template
│   ├── typsnitt.py                  # replaces Verdana with Noto Sans and embeds it for PowerPoint
│   ├── ECT vid bordet.pptx          # presentation for the treatment team (Swedish)
│   └── mall.pptx                    # original Sahlgrenska template (Instruktionssida.pptx)
├── .github/workflows/pdf-lib.yml    # monthly check for a new pdf-lib version (pull request for review)
├── export/bok/ECT-kompendium.pdf    # the compendium as an A4 book (npm run bok); the rest of export/ is not committed
├── publish/                         # A4 book: build.py (pipeline), bok.yaml (hierarchy), filter.lua, mall.typ, mermaid.mjs, diagram/ (book versions of diagrams)
├── tools/
│   ├── blankett.py                  # makes the ECT-lista template: date control, header size, no personal metadata
│   ├── build-index.mjs              # builds index.json and search.json
│   ├── build-renderer.mjs           # builds the WebAssembly renderer
│   ├── export-pdf.mjs               # exports the compendium as an A5 e-book PDF (title page, contents, bookmarks)
│   ├── markdown-renderer/           # Rust source of the renderer
│   │   ├── src/lib.rs               # Markdown to HTML
│   │   ├── Cargo.lock               # pinned dependencies
│   │   ├── Cargo.toml               # crate and build settings
│   │   └── rust-toolchain.toml      # pinned Rust toolchain
│   ├── test-renderer.mjs            # renders and checks all chapters
│   └── vendor-pdf-lib.mjs           # fetches a pdf-lib version into assets/kompendium/vendor/
├── .gitattributes                   # line-ending normalization
├── .gitignore                       # files kept out of Git
├── .nojekyll                        # GitHub Pages: no Jekyll
├── CNAME                            # GitHub Pages domain
├── index.html                       # calculator and compendium
├── LICENSE                          # all rights reserved
├── package.json                     # npm scripts
└── README.md                        # this file
```

## 6. License

All rights reserved; see [LICENSE](LICENSE). The site is for education only and is not intended to guide clinical decisions.

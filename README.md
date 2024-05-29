# ECT Parameters

An interactive teaching resource on the stimulus parameters of electroconvulsive therapy (ECT) for the MECTA spECTrum 5000Q: pulse width, frequency, duration and current, the resulting charge, voltage and energy, and what the pulses do to neurons. Live at [ect.matty.se](https://ect.matty.se). In Swedish the site also contains an ECT compendium for treatment teams.

## 1. Running locally

The site is static HTML, CSS and JavaScript with CDN libraries (Chart.js with its annotation plugin, MathJax, Mermaid) and the Inter font; there is no build step. The compendium fetches its Markdown chapters and a WebAssembly renderer, which browsers block for pages opened from disk, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000), or [http://localhost:8000/#/kompendium/](http://localhost:8000/#/kompendium/) for the compendium. Add `?lang=sv` or `?lang=en` to choose the language; the choice is remembered.

## 2. Calculator and simulations

- **Calculator:** sliders for pulse width, frequency, duration, current and impedance; the charge (mC), voltage and energy, the current and voltage over time, and the dose table by sex and age.
- **Neuron stimulation:** a cross-section through scalp, skull and cortex under the two electrodes, with six pyramidal neurons at three distances and the alternating pulse polarity; the strength-duration curve, rheobase and chronaxie.
- **Action potential in a single neuron:** a Hodgkin-Huxley model of one pulse, with the membrane, ion channels and the phases of the action potential.
- **Pulse train along a myelinated axon:** the device's pulse train applied to a myelinated axon, with direct excitation near the electrode and saltatory conduction along the nodes of Ranvier.
- **Synaptic transmission:** the steps of chemical transmission and the excitatory postsynaptic potential (EPSP).

The models are schematic illustrations for teaching, not quantitative predictions. Interface texts are in `assets/i18n/en.json` and `sv.json`; Swedish uses decimal commas.

## 3. Compendium

The Markdown files in `kompendium/` are the sources of the Swedish compendium and are edited directly in this repository; figures are in `kompendium/Figurer/`. Local reference material in `kompendium/Referenser/` is ignored by Git and never published. Use hyphens (-), not dashes.

The chapters are rendered in the browser by a Rust renderer compiled to WebAssembly (`assets/kompendium/ect_markdown.wasm`). It handles internal links (`[[chapter|text]]`), embedded images, callouts, tables, checklists, formulas and HTML sanitizing; JavaScript loads the module, fetches the chapters and handles navigation and search. Node.js 20 or later is needed for the commands below, but no npm packages:

```bash
npm run build:index        # rebuild the chapter index and search text after editing chapters
npm run build:kompendium   # rebuild the WebAssembly renderer after changing the Rust code (needs rustup)
npm run test:kompendium    # render every chapter and check links, images, checklists and diagrams
```

The Rust toolchain and WebAssembly target are pinned in `tools/markdown-renderer/rust-toolchain.toml` and the dependencies in `Cargo.lock`. Changes to the Rust code require rebuilding the `.wasm` file and committing it with them; the build folder `target/` is ignored by Git. `.nojekyll` makes GitHub Pages serve the files as they are, so the Markdown chapters are not converted by Jekyll.

## 4. Project structure

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
│       ├── expand-content.js        # full-width figures and tables
│       ├── index.json               # chapter index, search text
│       ├── kompendium.css           # compendium layout
│       ├── kompendium.js            # navigation and search
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
├── kompendium/                      # compendium chapters (Markdown)
│   └── Figurer/                     # compendium figures
├── tools/
│   ├── build-index.mjs              # builds index.json
│   ├── build-renderer.mjs           # builds the WebAssembly renderer
│   ├── markdown-renderer/           # Rust source of the renderer
│   └── test-renderer.mjs            # renders and checks all chapters
├── .nojekyll                        # GitHub Pages: no Jekyll
├── CNAME                            # GitHub Pages domain
├── index.html                       # calculator and compendium
├── LICENSE                          # all rights reserved
├── package.json                     # npm scripts
└── README.md                        # this file
```

## 5. License

All rights reserved; see [LICENSE](LICENSE). The site is for education only and is not intended to guide clinical decisions.

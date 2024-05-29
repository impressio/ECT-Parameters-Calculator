// Typst-mall för ECT-kompendiet som bok (Pandoc-mall: variabler inom dollartecken fylls i av Pandoc).
// A4 med 25 mm marginal runt om; texten är lika bred som tabellerna och figurerna. Ett typsnitt (Noto Sans, samma som
// diagrammen) överallt. Numrerade delar (nivå 1), kapitel (nivå 2) och avsnitt (nivå 3), löpande sidhuvud, sidnummer,
// innehållsförteckning och PDF-bokmärken.

#let accent = rgb("#075d95")
#let sans = "Noto Sans"
// Måtten speglas i publish/build.py (TEXT_WIDTH_PT, TEXT_HEIGHT_PT)
#let margin = 25mm
#let text-height = 297mm - 2 * margin

#set document(title: [$title$], keywords: ("ECT", "elektrokonvulsiv terapi"))
#set page(paper: "a4", margin: margin)
#set text(lang: "sv", region: "se", font: sans, size: 10pt, hyphenate: true)
// Radavstånd för det breda satsmåttet (omkring 90 tecken): luftigare än standard så att ögat hittar nästa rad
#set par(justify: true, leading: 0.8em, spacing: 1.1em)
#show math.equation: set text(font: "New Computer Modern Math")
#show raw: set text(font: sans, size: 9pt)
#show raw.where(block: true): block.with(fill: luma(246), inset: 8pt, radius: 2pt, width: 100%)
#show link: set text(fill: accent)
// Listor: punkten eller numret indraget från textkanten, radbrytningar i linje med punktens text
// Ett mönster för radavstånd: inom stycken och mellan punkter i en lista (även underlistor) samma radavstånd
// (par.leading); mellan stycken, listor, tabeller och rutor samma styckeavstånd (par.spacing).
#set list(indent: 0.5em, body-indent: 0.45em)
#set enum(indent: 0.5em, body-indent: 0.45em)
#set block(spacing: 1.1em)
#show quote.where(block: true): it => block(inset: (left: 10pt, y: 4pt), stroke: (left: 2pt + luma(200)), it.body)

// Sammanhållet innehåll: listor, tabeller, figurer och rutor bryts inte över sidor om de ryms på högst en halv sida
// (då flyttas de hela till nästa sida); längre innehåll bryts som vanligt. Underkapitel (avsnitt på nivå 3 och 4,
// publish/filter.lua) hålls på samma sida om de ryms på en sida.
// I referenskapitlen (flow = true, publish/filter.lua) löper texten fritt utan att hållas samman
#let flow = state("flow", false)
#let keep(it, limit: 0.5) = context {
  if flow.get() { return it }
  let height = measure(block(width: page.width - 2 * margin, it)).height
  block(breakable: height > text-height * limit, width: 100%, spacing: par.spacing, it)
}
// Bara yttersta listan hålls samman; underlistor ligger kvar i sin punkt med vanligt radavstånd
#let list-depth = state("list-depth", 0)
#let keep-list(it) = {
  list-depth.update(d => d + 1)
  context if list-depth.get() == 1 { keep(it) } else { it }
  list-depth.update(d => d - 1)
}
#let section(body) = keep(body, limit: 1)
#show list: keep-list
#show enum: keep-list
#show terms: keep-list

// Rubriker: delar 1, kapitel 1.1, avsnitt 1.1.1; djupare nivåer onumrerade. Rubriker hålls ihop med följande text.
#set heading(numbering: "1.1.1")
#show heading: set text(font: sans, fill: luma(15))
#show heading: set par(justify: false)
#show heading: set text(hyphenate: false)
#show heading.where(level: 4): set heading(numbering: none)
#show heading.where(level: 5): set heading(numbering: none)
#show heading.where(level: 6): set heading(numbering: none)
#show heading.where(level: 1): it => if not it.outlined {
  // Innehållsförteckningens rubrik
  block(below: 18pt, text(size: 20pt, weight: "bold", it.body))
} else {
  pagebreak(weak: true)
  v(30%)
  text(size: 12pt, fill: accent, tracking: 0.12em, weight: "medium")[DEL #counter(heading).display("1")]
  v(4pt)
  block(text(size: 22pt, weight: "bold", it.body))
  pagebreak(weak: true)
}
// Kapitel: ny sida, nummer och namn på samma rad, överst i satsytan som all annan text
#show heading.where(level: 2): it => {
  pagebreak(weak: true)
  block(above: 0pt, below: 14pt, text(size: 18pt, weight: "bold", {
    if it.numbering != none { text(fill: accent, counter(heading).display("1.1")); h(0.55em) }
    it.body
  }))
}
#show heading.where(level: 3): set text(size: 13pt)
#show heading.where(level: 3): set block(above: 1.6em, below: 0.7em)
// Nivå 4 i accentfärg: skiljer rubriken från fetstilta inledningsord i listor och text
#show heading.where(level: 4): set text(size: 11pt, fill: accent)
#show heading.where(level: 4): set block(above: 1.3em, below: 0.6em)
#show heading.where(level: 5): set text(size: 10pt, style: "italic")
#show heading.where(level: 6): set text(size: 10pt, style: "italic")

// Figurer och tabeller: centrerade; bildtexten står som i källan ("Figur 1: ..."), ingen automatisk numrering
#set figure(numbering: none, gap: 0.6em)
#show figure: set block(above: 1.3em, below: 1.3em)
#show figure.where(kind: table): set block(above: 1em, below: 1.1em)
#show figure: set align(center)
#show figure: keep
// Bildtext i marginaljustering (sista raden vänsterställd), inte centrerad
#show figure.caption: it => block(width: 100%, align(left, par(justify: true, text(size: 9pt, style: "italic", it.body))))
// Tabeller med enbart vågräta linjer (Tschichold): kraftig linje över och under rubrikraden, tunna mellan raderna
#set table(inset: (x: 5pt, y: 3.5pt), stroke: (_, y) => (
  top: if y == 0 { 0.9pt + luma(40) } else if y == 1 { 0.6pt + luma(40) } else { 0.35pt + luma(200) },
))
#show table: it => block(stroke: (bottom: 0.9pt + luma(40)), it)
#show table: set text(size: 9pt)
#show table: set par(justify: false, leading: 0.5em)
#show table: set align(left)
#show table.cell.where(y: 0): set text(weight: "bold", hyphenate: false)

// Obsidian-callouts och upplysningar
#let callout-styles = (
  note: (accent, "Obs"), info: (accent, "Info"), tip: (rgb("#0b7a3e"), "Tips"), important: (rgb("#6a3fa0"), "Viktigt"),
  warning: (rgb("#9a5a00"), "Varning"), caution: (rgb("#c93413"), "Försiktighet"), failure: (rgb("#c93413"), "Fel"),
  danger: (rgb("#c93413"), "Fara"), example: (rgb("#6a3fa0"), "Exempel"), quote: (luma(90), "Citat"),
)
#let callout(kind: "note", title: none, body) = {
  let (color, label) = callout-styles.at(kind, default: callout-styles.note)
  keep(block(width: 100%, inset: (left: 11pt, right: 9pt, y: 8pt), fill: color.lighten(93%), stroke: (left: 2.5pt + color),
    breakable: true, above: 1.1em, below: 1.1em, {
      text(weight: "bold", size: 9pt, fill: color, if title == none { label } else { title })
      v(3pt)
      body
    }))
}
// Små tabeller med egna underrubriker sida vid sida (publish/filter.lua)
#let pairs(..cells) = block(breakable: true, width: 100%, grid(columns: (1fr, 1fr), column-gutter: 16pt, row-gutter: 6pt,
  ..cells.pos().map(cell => block(breakable: false, width: 100%, cell))))
// Figurer sida vid sida, lika höga, med var sin bildtext (bok.yaml: figurpar)
#let figure-row(..items, gap: 16pt) = context {
  let items = items.pos()
  let height = (page.width - 2 * margin - gap * (items.len() - 1)) / items.map(item => item.at(2)).sum()
  block(breakable: false, width: 100%, grid(columns: items.map(item => item.at(2) * height), column-gutter: gap, align: top,
    ..items.map(item => figure(image(item.at(0), width: 100%), caption: item.at(1)))))
}
#let notice(body) = keep(block(width: 100%, inset: 9pt, fill: luma(245), stroke: (left: 2.5pt + accent), body))
// Avdelare (--- i källan; Pandoc skriver #divider()): ett luftigt avsnittsbyte i stället för en heldragen linje
#let divider() = v(0.5em)
#let horizontalrule = divider()

// Sidhuvud: delens namn på vänstersidor, kapitlets nummer och namn på högersidor; inte på sidor där en del eller ett
// kapitel börjar. Sidnummer i sidfoten.
#let starts-here() = query(heading.where(level: 1).or(heading.where(level: 2))).any(h => h.location().page() == here().page())
#let running-header = context {
  let chapters = query(heading.where(level: 2).before(here()))
  if not starts-here() and chapters.len() > 0 {
    let chapter = chapters.last()
    let part = query(heading.where(level: 1).before(here())).last()
    set text(size: 8pt, fill: luma(95))
    if calc.even(here().page()) { part.body; h(1fr) } else {
      h(1fr)
      if chapter.numbering != none { numbering("1.1", ..counter(heading).at(chapter.location()).slice(0, 2)); h(0.5em) }
      chapter.body
    }
    v(-5pt)
    line(length: 100%, stroke: 0.4pt + luma(175))
  }
}
#let page-footer(style) = context {
  let parts = query(heading.where(level: 1)).any(h => h.location().page() == here().page())
  if not parts { align(center, text(size: 8pt, fill: luma(80), counter(page).display(style))) }
}

// Titelsida
#set page(header: none, footer: none)
#block(height: 100%, {
  v(22%)
  text(size: 32pt, weight: "bold", [$title$])
  v(8pt)
  $if(subtitle)$text(size: 14pt, fill: luma(60), [$subtitle$])$endif$
  v(1fr)
  set text(size: 9.5pt, fill: luma(70))
  ([$if(edition)$$edition$$endif$], [$if(version)$Version $version$$endif$], [$if(date)$$date$$endif$]).filter(x => x != []).join(linebreak())
})

// Innehåll (romersk sidnumrering)
#set page(footer: page-footer("i"))
#counter(page).update(1)
#show outline.entry.where(level: 1): it => { v(9pt, weak: true); strong(it) }
#metadata("innehåll") <innehall>
// Delar, kapitel och underkapitel (nivå 3 med kapitelankare c<nummer>); vanliga avsnitt visas inte
#show outline.entry.where(level: 3): it => if it.element.has("label") and str(it.element.label).match(regex("^c\\d+$$")) != none { it }
#outline(title: [Innehåll], depth: 3, indent: 1.2em)

// Innehållet (arabisk sidnumrering från 1)
#pagebreak(weak: true)
#set page(header: running-header, footer: page-footer("1"))
#counter(page).update(1)

$body$

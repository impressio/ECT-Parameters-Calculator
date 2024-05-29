use percent_encoding::{utf8_percent_encode, AsciiSet, NON_ALPHANUMERIC};
use pulldown_cmark::{html, CodeBlockKind, CowStr, Event, Options, Parser, Tag, TagEnd};
use regex::{Captures, Regex};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;
use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};

// Patterns are compiled once per module instance, not on every render (or, for slugs, every heading)
macro_rules! pattern { ($name:ident, $re:expr) => { static $name: LazyLock<Regex> = LazyLock::new(|| Regex::new($re).unwrap()); }; }
pattern!(NOT_SLUG, "[^a-z0-9]+");
pattern!(FRONTMATTER, r"\A---\r?\n[\s\S]*?\r?\n---\r?\n");
pattern!(COMMENT, r"%%[\s\S]*?%%");
pattern!(EMBED, r"!\[\[([^\]]+)\]\]([ \t]*\r?\n(?:\*Figur[^\n]*\*[ \t]*\r?\n)?)?");
pattern!(CALLOUT, r"(?m)^>\s*\[![\w-]+\][-+]?\s*(.*)$");
pattern!(WIKILINK, r"\[\[([^\]]+)\]\]");
pattern!(MATH, r"\$\$[\s\S]*?\$\$|\$[^\s$][^$\n]*?\$");
pattern!(MATH_PLACEHOLDER, r"ECTMATHPLACEHOLDER(\d+)END");
const URL_SEGMENT: &AsciiSet = &NON_ALPHANUMERIC.remove(b'-').remove(b'.').remove(b'_').remove(b'~');
#[derive(Deserialize)]
struct Chapter { file: String, #[serde(default)] aliases: Vec<String> }
#[derive(Deserialize)]
struct Request { markdown: String, current: String, documents: Vec<Chapter>, files: Vec<String> }
fn escaped(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&#39;")
}
fn slug(text: &str) -> String {
    let text: String = text.nfd().filter(|c| !is_combining_mark(*c)).collect::<String>().to_lowercase();
    NOT_SLUG.replace_all(&text, "-").trim_matches('-').to_string()
}
fn encoded_path(file: &str) -> String {
    file.split('/').map(|part| utf8_percent_encode(part, URL_SEGMENT).to_string()).collect::<Vec<_>>().join("/")
}
fn route(file: &str, heading: &str) -> String {
    let mut result = format!("#/kompendium/{}", encoded_path(file));
    if !heading.is_empty() { result.push_str(&format!("?section={}", slug(heading))); }
    result
}
fn render(request: &Request) -> Result<String, String> {
    let mut targets = HashMap::new();
    for chapter in &request.documents {
        let filename = chapter.file.rsplit('/').next().unwrap();
        for key in [chapter.file.clone(), chapter.file.trim_end_matches(".md").to_string(), filename.to_string(), filename.trim_end_matches(".md").to_string()]
            .into_iter().chain(chapter.aliases.iter().cloned()) {
            let key = key.to_lowercase();
            if let Some(old) = targets.insert(key.clone(), chapter.file.as_str()) {
                if old != chapter.file { return Err(format!("Tvetydig länk: {key}")); }
            }
        }
    }
    if !request.documents.iter().any(|chapter| chapter.file == request.current) { return Err("Okänt kapitel".into()); }
    let mut images: HashMap<String, Option<&str>> = HashMap::new();
    for file in request.files.iter().filter(|file| file.starts_with("Figurer/")) {
        images.insert(file.to_lowercase(), Some(file));
        let basename = file.rsplit('/').next().unwrap().to_lowercase();
        if images.contains_key(&basename) { images.insert(basename, None); }
        else { images.insert(basename, Some(file)); }
    }
    let mut md = FRONTMATTER.replace(&request.markdown, "").to_string();
    md = COMMENT.replace_all(&md, "").into_owned();
    md = EMBED.replace_all(&md, |caps: &Captures| {
        let mut parts = caps[1].splitn(2, '|');
        let target = parts.next().unwrap();
        let label = parts.next().filter(|label| !label.chars().all(|c| c.is_ascii_digit() || c == 'x'));
        match images.get(&target.to_lowercase()).and_then(|value| *value) {
            Some(file) => {
                let alt = label.unwrap_or(file.rsplit('/').next().unwrap().trim_end_matches(".png"));
                format!("[![{}](kompendium/{})](kompendium/{}){}", alt.replace('[', "").replace(']', ""), encoded_path(file), encoded_path(file), caps.get(2).map_or("", |m| m.as_str()))
            }
            None => String::new(),
        }
    }).into_owned();
    md = CALLOUT.replace_all(&md, "> **$1**").into_owned();
    let mut missing = Vec::new();
    md = WIKILINK.replace_all(&md, |caps: &Captures| {
        let mut parts = caps[1].splitn(2, '|');
        let target = parts.next().unwrap(); let label = parts.next();
        let mut location = target.splitn(2, '#');
        let name = location.next().unwrap(); let heading = location.next().unwrap_or("");
        let dest = if name.is_empty() { Some(request.current.as_str()) } else { targets.get(&name.to_lowercase()).copied() };
        match dest {
            Some(file) => format!("[{}]({})", label.unwrap_or(if name.is_empty() { heading } else { name }), route(file, heading)),
            None => { missing.push(target.to_string()); String::new() }
        }
    }).into_owned();
    if !missing.is_empty() { return Err(format!("Länkmål saknas: {}", missing.join(", "))); }
    let mut math = Vec::new();
    md = MATH.replace_all(&md, |caps: &Captures| {
        math.push(caps[0].to_string()); format!("ECTMATHPLACEHOLDER{}END", math.len() - 1)
    }).into_owned();
    let restore = |text: &str| MATH_PLACEHOLDER.replace_all(text, |caps: &Captures| math[caps[1].parse::<usize>().unwrap()].clone()).into_owned();
    let events: Vec<_> = Parser::new_ext(&md, Options::ENABLE_TABLES | Options::ENABLE_TASKLISTS | Options::ENABLE_STRIKETHROUGH | Options::ENABLE_FOOTNOTES).collect();
    let mut rewritten = Vec::new(); let mut mermaid = false; let mut headings = HashMap::new();
    for (i, event) in events.iter().enumerate() {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                let text: String = events[i + 1..].iter().take_while(|e| !matches!(e, Event::End(TagEnd::Heading(_))))
                    .filter_map(|e| match e { Event::Text(t) | Event::Code(t) => Some(t.as_ref()), _ => None }).collect();
                let base = slug(&restore(&text)); let count = headings.entry(base.clone()).or_insert(0usize);
                let id = if *count == 0 { base } else { format!("{base}-{count}") }; *count += 1;
                rewritten.push(Event::Html(CowStr::from(format!("<{level} id=\"{id}\">"))));
            }
            Event::End(TagEnd::Heading(level)) => rewritten.push(Event::Html(CowStr::from(format!("</{level}>\n")))),
            Event::Start(Tag::CodeBlock(CodeBlockKind::Fenced(lang))) if lang.as_ref() == "mermaid" => {
                mermaid = true; rewritten.push(Event::Html(CowStr::from("<details class=\"diagram-source\" open><summary>Diagram</summary><pre class=\"mermaid\">")));
            }
            Event::End(TagEnd::CodeBlock) if mermaid => {
                mermaid = false; rewritten.push(Event::Html(CowStr::from("</pre></details>\n")));
            }
            _ => rewritten.push(event.clone()),
        }
    }
    let mut output = String::new(); html::push_html(&mut output, rewritten.into_iter());
    output = MATH_PLACEHOLDER.replace_all(&output, |caps: &Captures| escaped(&math[caps[1].parse::<usize>().unwrap()])).into_owned();
    let mut clean = ammonia::Builder::default();
    clean.add_tags(&["input", "details", "summary"]).add_generic_attributes(&["class", "id"])
        .add_tag_attributes("input", &["type", "checked", "disabled"]).add_tag_attributes("details", &["open"])
        .url_schemes(HashSet::from(["http", "https", "mailto"]));
    Ok(clean.clean(&output).to_string())
}

// Small UTF-8 ABI: JavaScript owns allocation and release of input/output buffers.
#[no_mangle]
pub extern "C" fn alloc(length: usize) -> *mut u8 {
    Box::into_raw(vec![0u8; length].into_boxed_slice()) as *mut u8
}
/// # Safety
/// `pointer` and `length` must name a live buffer returned by alloc or render_json.
#[no_mangle]
pub unsafe extern "C" fn dealloc(pointer: *mut u8, length: usize) {
    if !pointer.is_null() { drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(pointer, length))); }
}
/// # Safety
/// Input must be a live buffer returned by alloc with at least length bytes.
#[no_mangle]
pub unsafe extern "C" fn render_json(pointer: *const u8, length: usize) -> u64 {
    let result = if length > 2_000_000 { Err("Kapitlet är för stort".to_string()) }
        else { serde_json::from_slice::<Request>(std::slice::from_raw_parts(pointer, length)).map_err(|e| e.to_string()).and_then(|request| render(&request)) };
    let json = match result { Ok(html) => serde_json::json!({"html": html}), Err(error) => serde_json::json!({"error": error}) };
    let bytes = json.to_string().into_bytes().into_boxed_slice(); let len = bytes.len(); let ptr = Box::into_raw(bytes) as *mut u8;
    ((ptr as u64) << 32) | len as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request(md: &str) -> Request { Request { markdown: md.into(), current: "01 Start/01 Start.md".into(), documents: vec![Chapter {file:"01 Start/01 Start.md".into(),  aliases:vec!["Start".into()]}], files:vec!["Figurer/En bild.png".into()] } }
    #[test] fn wiki_links_math_and_safe_html() {
        let html = render(&request("---\ntitle: Start\n---\n# Räkneregler\n[[Start]]\n\n![[Figurer/En bild.png]]\n\n![[Bilder/Privat.png]]\n*Figur 2: Utelämnas*\n\n> [!TIP] Tips\n> Text\n\n$Q$ och $$\\frac{I}{1000}$$\n\n- [ ] Kontroll\n\n<script>alert(1)</script><img src=x onerror=alert(1)>\n[x](javascript:alert(1))")).unwrap();
        assert!(html.contains("id=\"rakneregler\"")); assert!(html.contains("#/kompendium/01%20Start/01%20Start.md"));
        assert!(html.contains("Figurer/En%20bild.png")); assert!(!html.contains("Privat")); assert!(!html.contains("Utelämnas"));
        assert!(html.contains("\\frac{I}{1000}")); assert!(html.contains("checkbox")); assert!(html.contains("Tips"));
        assert!(!html.contains("<script")); assert!(!html.contains("onerror")); assert!(!html.contains("javascript:"));
    }
    #[test] fn diagrams_are_text_until_mermaid_runs() {
        let html = render(&request("```mermaid\ngraph TD\nA[\"<b>Hej</b>\"] --> B[Slut]\n```\n")).unwrap();
        assert!(html.contains("class=\"mermaid\"")); assert!(html.contains("&lt;b&gt;")); assert!(html.contains("<details"));
    }
    #[test] fn missing_links_fail_instead_of_silently_disappearing() { assert!(render(&request("[[Saknas]]")).is_err()); }
}

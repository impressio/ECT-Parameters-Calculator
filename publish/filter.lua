-- Pandoc-filter för boken (Markdown till Typst), används av publish/build.py.
--  * Callouts (förbehandlade till ::: {.callout .tip} med en titel-div) blir #callout(...) i mallen.
--  * Bokstavslistor (::: {.letter-list}) numreras A, B, C.
--  * Figurer: bildtexten skrivs som den står i källan ("Figur 1: ..."); Typst numrerar inte figurer och tabeller.
--  * Allt som filtret inte känner igen och som Typst inte kan visa rapporteras på stderr med prefixet RAPPORT:.

local stringify = pandoc.utils.stringify

local function report(kind, text)
  io.stderr:write('RAPPORT:' .. kind .. ':' .. text:gsub('\n', ' '):sub(1, 160) .. '\n')
end

local function typst(blocks)
  local text = pandoc.write(pandoc.Pandoc(blocks), 'typst'):gsub('%s+$', '')
  return text
end

function Div(div)
  if div.classes:includes('callout') then
    local kind = 'note'
    for _, class in ipairs(div.classes) do
      if class ~= 'callout' then kind = class end
    end
    local title = 'none'
    local body = {}
    for _, block in ipairs(div.content) do
      if block.t == 'Div' and block.classes:includes('callout-title') then
        title = '[' .. typst(block.content) .. ']'
      else
        table.insert(body, block)
      end
    end
    local blocks = { pandoc.RawBlock('typst', '#callout(kind: "' .. kind .. '", title: ' .. title .. ')[') }
    for _, block in ipairs(body) do table.insert(blocks, block) end
    table.insert(blocks, pandoc.RawBlock('typst', ']'))
    return blocks
  end
  if div.classes:includes('letter-list') then
    return div:walk({
      OrderedList = function(list)
        list.listAttributes = pandoc.ListAttributes(list.listAttributes.start, 'UpperAlpha', 'Period')
        return list
      end,
    }).content
  end
  if div.classes:includes('notice') then
    local blocks = { pandoc.RawBlock('typst', '#notice[') }
    for _, block in ipairs(div.content) do table.insert(blocks, block) end
    table.insert(blocks, pandoc.RawBlock('typst', ']'))
    return blocks
  end
  -- Callout-titeln behandlas av den omgivande callouten (filtret går inifrån och ut)
  if div.classes:includes('callout-title') then return nil end
  if #div.classes > 0 then report('div', 'Okänd blockklass: ' .. table.concat(div.classes, ' ')) end
  return div.content
end

function RawBlock(raw)
  if raw.format ~= 'typst' then
    report('html', raw.text)
    return {}
  end
end

function RawInline(raw)
  if raw.format == 'html' and raw.text:match('^<br%s*/?>$') then return pandoc.LineBreak() end
  if raw.format ~= 'typst' then
    report('html-inline', raw.text)
    return {}
  end
end

function CodeBlock(code)
  report('kodblock', (code.classes[1] or 'utan språk') .. ': ' .. code.text)
end

-- Bild eller diagram utan bildtext (ensam i ett stycke): centrerad och hållen samman som en figur
function Para(para)
  if #para.content == 1 and para.content[1].t == 'Image' then
    return { pandoc.RawBlock('typst', '#keep(align(center)['), para, pandoc.RawBlock('typst', '])') }
  end
end

function Image(image)
  -- Alt-texten följer med till Typst (tillgänglighet); bildtexten sätts av figuren
  if image.attributes['alt'] then image.attributes['alt'] = nil end
  return image
end

-- Kryssrutelistor (- [ ] / - [x]): kryssrutan ersätter punkten på den nivån; underlistor behåller sina punkter
function BulletList(list)
  for _, item in ipairs(list.content) do
    local first = item[1] and item[1].content and item[1].content[1]
    if not (first and first.t == 'Str' and (first.text == '☐' or first.text == '☒')) then return nil end
  end
  return {
    pandoc.RawBlock('typst', '#[#set list(marker: ([], [•], [–]), body-indent: 0.35em)'),
    list,
    pandoc.RawBlock('typst', ']'),
  }
end

-- Tabeller med relativa kolumnbredder (från källans streckrad) behåller full bredd, men bredderna fördelas efter
-- innehållet. Varje kolumn får minst plats för sitt längsta ord, med luft (kolumnrubrikens ord räknas som fet stil);
-- återstoden fördelas efter textmängd och kolumnrubrikens längsta rad (helst på en rad, långa rubriker på högst två). Radbyte sker därmed mellan ord (t.ex. före enheter som Hz eller före en
-- parentes), inte inuti dem. Tabeller utan bredder (smala tabeller) lämnas orörda.
local WIDTH = 453.5                     -- satsytans bredd i punkter (mall.typ)
local CHAR, BOLD, AIR = 4.6, 4.8, 14    -- teckenbredd i punkter (9 pt Noto Sans, normal och fet), cellmarginal och luft

function Table(tbl)
  local n = #tbl.colspecs
  for _, spec in ipairs(tbl.colspecs) do
    if type(spec[2]) ~= 'number' then return nil end
  end
  local need, maxlen, total, count, heading = {}, {}, {}, {}, {}
  for i = 1, n do need[i], maxlen[i], total[i], count[i], heading[i] = 0, 1, 0, 0, 0 end
  local function scan(rows, header)
    for _, row in ipairs(rows) do
      local col = 1
      for _, cell in ipairs(row.cells) do
        if cell.col_span == 1 and col <= n then
          -- radbrytningar (t.ex. enhet på egen rad i kolumnrubriken) räknas som radslut
          local text = stringify(cell.contents:walk({ LineBreak = function() return pandoc.Str('\n') end }))
          local bold = header
          cell.contents:walk({ Strong = function() bold = true end })   -- fetstil kräver bredare kolumn
          for word in text:gmatch('%S+') do
            need[col] = math.max(need[col], (utf8.len(word) or #word) * (bold and BOLD or CHAR) + AIR)
          end
          if header then
            -- kolumnrubriken ska helst rymmas på två rader
            local widest = 0
            for line in (text .. '\n'):gmatch('(.-)\n') do widest = math.max(widest, utf8.len(line) or #line) end
            local lines = widest > 30 and 2 or 1   -- korta rubrikrader ryms på en rad, långa på högst två
            heading[col] = math.max(heading[col], math.min(widest * BOLD / lines, WIDTH * 0.4) + AIR)
          else
            local len = 0   -- längsta raden i cellen (radbrytningar räknas)
            for line in (text .. '\n'):gmatch('(.-)\n') do len = math.max(len, utf8.len(line) or #line) end
            maxlen[col] = math.max(maxlen[col], len)
            total[col] = total[col] + len
            count[col] = count[col] + 1
          end
        end
        col = col + cell.col_span
      end
    end
  end
  scan(tbl.head.rows, true)
  for _, body in ipairs(tbl.bodies) do scan(body.head, true); scan(body.body, false) end
  local wish, sum_need, sum_wish = {}, 0, 0
  for i = 1, n do
    local mean = count[i] > 0 and total[i] / count[i] or maxlen[i]
    wish[i] = math.max(need[i], heading[i], math.sqrt(math.min(maxlen[i], 70) * math.max(mean, 1)) * CHAR * 1.6 + AIR)
    sum_need, sum_wish = sum_need + need[i], sum_wish + wish[i]
  end
  local widths = {}
  for i = 1, n do
    if sum_need >= WIDTH then widths[i] = need[i] / sum_need                     -- ryms inte: i proportion till behovet
    elseif sum_wish <= WIDTH then widths[i] = wish[i] / sum_wish                 -- allt ryms: utökas i proportion
    else widths[i] = (need[i] + (WIDTH - sum_need) * (wish[i] - need[i]) / (sum_wish - sum_need)) / WIDTH end
  end
  for i = 1, n do tbl.colspecs[i] = { tbl.colspecs[i][1], widths[i] } end
  return tbl
end

-- Följder av minst två små tabeller (högst tre kolumner) med var sin underrubrik (nivå 5 eller 6) ställs två och
-- två sida vid sida (#pairs i mallen).
local function small_pair(blocks, i)
  local h, t = blocks[i], blocks[i + 1]
  return h and t and h.t == 'Header' and h.level >= 5 and t.t == 'Table' and #t.colspecs <= 3
end

-- Underkapitel (rubrik på nivå 3 eller 4 med innehållet fram till nästa rubrik på samma eller högre nivå) omsluts
-- med #section[...] i mallen, som håller dem på samma sida om de ryms. Rubriker inuti öppna rutor (callouts)
-- räknas inte som gränser.
local function depth_change(block)
  if block.t ~= 'RawBlock' or block.format ~= 'typst' then return 0 end
  local _, open = block.text:gsub('%[', '')
  local _, close = block.text:gsub('%]', '')
  return open - close
end

function sections(blocks, level)
  if level > 4 then return blocks end
  local out, i, depth = {}, 1, 0
  while i <= #blocks do
    local block = blocks[i]
    if depth == 0 and block.t == 'Header' and block.level == level then
      local body, j, inner = {}, i + 1, 0
      while j <= #blocks do
        local b = blocks[j]
        if inner == 0 and b.t == 'Header' and b.level <= level then break end
        inner = inner + depth_change(b)
        table.insert(body, b)
        j = j + 1
      end
      -- underkapitel (kapitelankare c<nummer> på nivå 3) börjar på ny sida; sidbrytningen står utanför blocket
      if (level == 3 and block.identifier:match('^c%d+$')) or block.classes:includes('sidbrytning') then
        table.insert(out, pandoc.RawBlock('typst', '#pagebreak(weak: true)'))
      end
      table.insert(out, pandoc.RawBlock('typst', '#section['))
      table.insert(out, block)
      for _, b in ipairs(sections(body, level + 1)) do table.insert(out, b) end
      table.insert(out, pandoc.RawBlock('typst', ']'))
      i = j
    else
      depth = depth + depth_change(block)
      table.insert(out, block)
      i = i + 1
    end
  end
  return out
end

function Pandoc(doc)
  local out, i = {}, 1
  local blocks = doc.blocks
  while i <= #blocks do
    local j = i
    while small_pair(blocks, j) do j = j + 2 end
    if j - i >= 4 then
      table.insert(out, pandoc.RawBlock('typst', '#pairs['))
      for k = i, j - 1, 2 do
        if k > i then table.insert(out, pandoc.RawBlock('typst', '][')) end
        table.insert(out, blocks[k])
        table.insert(out, blocks[k + 1])
      end
      table.insert(out, pandoc.RawBlock('typst', ']'))
      i = j
    else
      table.insert(out, blocks[i])
      i = i + 1
    end
  end
  -- Referenskapitel (klass references): texten löper fritt (flow i mallen) fram till nästa kapitel eller del.
  -- Markeringarna sätts efter avsnittsindelningen, så att de alltid står utanför avsnittens block.
  local wrapped, marked, inflow = sections(out, 3), {}, false
  for _, block in ipairs(wrapped) do
    if block.t == 'Header' and block.level <= 2 and inflow then
      table.insert(marked, pandoc.RawBlock('typst', '#flow.update(false)'))
      inflow = false
    end
    table.insert(marked, block)
    if block.t == 'Header' and block.level == 2 and block.classes:includes('references') then
      table.insert(marked, pandoc.RawBlock('typst', '#flow.update(true)'))
      inflow = true
    end
  end
  if inflow then table.insert(marked, pandoc.RawBlock('typst', '#flow.update(false)')) end
  doc.blocks = marked
  return doc
end

-- Rubriker som börjar med ett nummer ("1. ECT-behandlaren"): punkten skyddas, annars läser Typst rubriktexten som en
-- numrerad lista (indragen rubrik med glapp efter numret)
function Header(header)
  local first = header.content[1]
  if first and first.t == 'Str' and first.text:match('^%d+%.$') then
    header.content[1] = pandoc.RawInline('typst', first.text:sub(1, -2) .. '\\.')
    return header
  end
end

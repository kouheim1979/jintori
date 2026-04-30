#!/usr/bin/env node
import fs from 'node:fs/promises';

const DEFAULT_SOURCE = 'https://raw.githubusercontent.com/geolonia/japanese-prefectures/90c5b4b8260de058d3db61b3cb8bfb6f67a81f9a/map-full.svg';
const source = process.argv[2] || DEFAULT_SOURCE;

if (!source) {
  console.error('SVG source is required.');
  process.exit(1);
}

const CODE_TO_ID = {
  '01':'hokkaido','02':'aomori','03':'iwate','04':'miyagi','05':'akita','06':'yamagata','07':'fukushima','08':'ibaraki','09':'tochigi','10':'gunma','11':'saitama','12':'chiba','13':'tokyo','14':'kanagawa','15':'niigata','16':'toyama','17':'ishikawa','18':'fukui','19':'yamanashi','20':'nagano','21':'gifu','22':'shizuoka','23':'aichi','24':'mie','25':'shiga','26':'kyoto','27':'osaka','28':'hyogo','29':'nara','30':'wakayama','31':'tottori','32':'shimane','33':'okayama','34':'hiroshima','35':'yamaguchi','36':'tokushima','37':'kagawa','38':'ehime','39':'kochi','40':'fukuoka','41':'saga','42':'nagasaki','43':'kumamoto','44':'oita','45':'miyazaki','46':'kagoshima','47':'okinawa'
};

async function loadSvg(input) {
  if (/^https?:\/\//.test(input)) {
    const res = await fetch(input);
    if (!res.ok) throw new Error(`Failed to fetch SVG: ${res.status}`);
    return await res.text();
  }
  return await fs.readFile(input, 'utf8');
}

function normalizeSvg(raw) {
  const names = new Map([...raw.matchAll(/<g[^>]*data-code="(\d{2})"[^>]*data-name="([^"]+)"[^>]*>/g)].map((m)=>[m[1],m[2]]));
  let count = 0;
  let svg = raw.replace(/<\?xml[\s\S]*?\?>\s*/g, '').replace(/<!DOCTYPE[\s\S]*?>\s*/gi, '').trim();
  svg = svg.replace(/<svg\b([^>]*)>/, (_m, attrs) => `<svg id="japanMap" data-source="geolonia-gfdl"${attrs}>`);
  svg = svg.replace(/<g\b([^>]*\bdata-code="(\d{2})"[^>]*)>/g, (m, attrs, code) => {
    const id = CODE_TO_ID[code];
    if (!id) return m;
    count++;
    const label = names.get(code) || id;
    let out = attrs;
    out = out.replace(/\sclass="([^"]*)"/, (_x, cls)=>` class="${cls} pref-shape"`);
    if (!/\sclass=/.test(out)) out += ' class="pref-shape"';
    if (!/\sdata-pref-id=/.test(out)) out += ` data-pref-id="${id}"`;
    if (!/\saria-label=/.test(out)) out += ` aria-label="${label}"`;
    return `<g${out}>`;
  });
  if (count !== 47) throw new Error(`Expected 47 prefectures, found ${count}`);
  return svg;
}

function replaceIndex(indexHtml, inlineSvg) {
  let out = indexHtml;
  out = out.replace(/<svg id="japanMap"[\s\S]*?<\/svg>/, inlineSvg);
  out = out.replace('※ 現在の地図は仮素材です。実データ由来SVGへ置換予定。', '※ Geolonia japanese-prefectures (GFDL) を加工した地図を使用しています。');
  out = out.replace(/地図データ出典：[\s\S]*?<\/div>/, '地図データ出典：<br>Geolonia japanese-prefectures map-full.svg を加工して作成。<br>同SVGは Wikipedia 日本地図.svg をベースとし、ライセンスは GFDL とされています。<br>一部離島は元データ仕様により省略されています。</div>');
  out = out.replace('.map-inner{min-width:320px}#japanMap{min-width:320px}', '.map-inner{min-width:320px}#japanMap{min-width:320px;width:100%;max-height:70vh}');
  out = out.replace('#japanMap{width:100%;background:#eaf4ff;border:3px solid var(--c-line);border-radius:var(--r-lg)}.pref-shape{fill:var(--c-paper);stroke:var(--c-line);stroke-width:1.1;cursor:pointer}.pref-shape:hover{fill:#ffe7a8}.player{fill:var(--c-sun)}.enemy{fill:var(--c-hero)}.answer{fill:var(--c-deep)}', '#japanMap{width:100%;background:#eaf4ff;border:3px solid var(--c-line);border-radius:var(--r-lg)}#japanMap .pref-shape{fill:var(--c-paper);stroke:var(--c-line);stroke-width:1;cursor:pointer}#japanMap .pref-shape:hover{fill:var(--c-sun)}#japanMap .pref-shape.player{fill:var(--c-sun)}#japanMap .pref-shape.enemy{fill:var(--c-hero)}#japanMap .pref-shape.answer{fill:var(--c-deep)}#japanMap .boundary-line{stroke:var(--c-line);stroke-width:.5;fill:none;pointer-events:none}');
  out = out.replace(/const SHAPES=\{[\s\S]*?\};/, '');
  out = out.replace(/function drawMap\(\)\{[\s\S]*?\}\nfunction validateData\(\)\{[\s\S]*?\}\n/, `function drawMap(){const prefs=[...document.querySelectorAll('#japanMap .pref-shape')];prefs.forEach((pref)=>{pref.classList.remove('player','enemy','answer');pref.style.pointerEvents='auto';pref.onclick=(e)=>{const el=e.currentTarget.closest('.pref-shape');if(el&&el.dataset.prefId)answer(el.dataset.prefId);};});}
function validateData(){const w=[];const ids=PREFS.map(p=>p.id);if(PREFS.length!==47)w.push('PREFS 47件でない');if(new Set(ids).size!==47)w.push('id重複');if(!japanMap)w.push('#japanMap欠落');if(!japanMap.dataset.source)w.push('data-source欠落');const VALID_DATA_SOURCES=['learning-simplified-map','mlit-n03-derived','gsi-derived','geolonia-gfdl'];if(!VALID_DATA_SOURCES.includes(japanMap.dataset.source))w.push('data-source不正');const prefEls=[...japanMap.querySelectorAll('.pref-shape')];if(prefEls.length!==47)w.push('.pref-shape が47件でない');const prefIds=prefEls.map(el=>el.dataset.prefId).filter(Boolean);if(prefIds.length!==47)w.push('data-pref-id が47件でない');if(prefIds.some(id=>!ids.includes(id)))w.push('data-pref-id と PREFS id が不一致');if(ids.some(id=>!prefIds.includes(id)))w.push('PREFS id が地図に不足');const emptyN=PREFS.filter(p=>!p.neighbors.length).length;if(emptyN>2)w.push('neighbors空が多すぎる');if(PREFS.some(p=>p.specialties.includes('郷土料理')))w.push('specialtiesダミー');if(PREFS.some(p=>p.landmarks.includes('名所')))w.push('landmarksダミー');if(w.length){if(japanMap.dataset.source!=='geolonia-gfdl'){warning.classList.remove('hidden');warning.textContent='現在の地図は学習用簡略版です。';}console.warn(w);}}
`);
  return out;
}

const rawSvg = await loadSvg(source);
const inlineSvg = normalizeSvg(rawSvg);
const indexPath = new URL('../index.html', import.meta.url);
const index = await fs.readFile(indexPath, 'utf8');
const next = replaceIndex(index, inlineSvg);
await fs.writeFile(indexPath, next, 'utf8');
console.log('Updated index.html with Geolonia SVG');

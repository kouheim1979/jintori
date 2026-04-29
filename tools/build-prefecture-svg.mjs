import fs from 'node:fs/promises';

/**
 * Build 47 prefecture SVG paths from GeoJSON and embed into index.html.
 *
 * Usage:
 *   node tools/build-prefecture-svg.mjs ./data/prefectures.geojson
 */

const input = process.argv[2];
if (!input) {
  console.error('GeoJSON file path is required. Example: node tools/build-prefecture-svg.mjs ./data/prefectures.geojson');
  process.exit(1);
}

const PREF_ORDER = [
  'hokkaido','aomori','iwate','miyagi','akita','yamagata','fukushima','ibaraki','tochigi','gunma','saitama','chiba','tokyo','kanagawa','niigata','toyama','ishikawa','fukui','yamanashi','nagano','gifu','shizuoka','aichi','mie','shiga','kyoto','osaka','hyogo','nara','wakayama','tottori','shimane','okayama','hiroshima','yamaguchi','tokushima','kagawa','ehime','kochi','fukuoka','saga','nagasaki','kumamoto','oita','miyazaki','kagoshima','okinawa'
];

const nameToId = new Map([
['北海道','hokkaido'],['青森県','aomori'],['岩手県','iwate'],['宮城県','miyagi'],['秋田県','akita'],['山形県','yamagata'],['福島県','fukushima'],['茨城県','ibaraki'],['栃木県','tochigi'],['群馬県','gunma'],['埼玉県','saitama'],['千葉県','chiba'],['東京都','tokyo'],['神奈川県','kanagawa'],['新潟県','niigata'],['富山県','toyama'],['石川県','ishikawa'],['福井県','fukui'],['山梨県','yamanashi'],['長野県','nagano'],['岐阜県','gifu'],['静岡県','shizuoka'],['愛知県','aichi'],['三重県','mie'],['滋賀県','shiga'],['京都府','kyoto'],['大阪府','osaka'],['兵庫県','hyogo'],['奈良県','nara'],['和歌山県','wakayama'],['鳥取県','tottori'],['島根県','shimane'],['岡山県','okayama'],['広島県','hiroshima'],['山口県','yamaguchi'],['徳島県','tokushima'],['香川県','kagawa'],['愛媛県','ehime'],['高知県','kochi'],['福岡県','fukuoka'],['佐賀県','saga'],['長崎県','nagasaki'],['熊本県','kumamoto'],['大分県','oita'],['宮崎県','miyazaki'],['鹿児島県','kagoshima'],['沖縄県','okinawa']
]);
const idToName = new Map([...nameToId.entries()].map(([k, v]) => [v, k]));

const pickName = (p = {}) => {
  const first = p.pref || p.nam_ja || p.name || p.N03_001 || p.N03_004;
  if (typeof first === 'string' && nameToId.has(first.trim())) return first.trim();
  for (const v of Object.values(p)) {
    if (typeof v !== 'string') continue;
    const n = v.trim();
    if (nameToId.has(n)) return n;
  }
  return first;
};

const toPolys = (g) => g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
const fmt = (n) => Number(n.toFixed(2)).toString();

const simplifyRing = (ring, eps = 0.08) => {
  if (!Array.isArray(ring) || ring.length <= 6) return ring;
  const out = [ring[0]];
  let prev = ring[0];
  for (let i = 1; i < ring.length - 1; i++) {
    const pt = ring[i];
    const dx = pt[0] - prev[0];
    const dy = pt[1] - prev[1];
    if ((dx * dx + dy * dy) >= eps * eps) {
      out.push(pt);
      prev = pt;
    }
  }
  out.push(ring[ring.length - 1]);
  return out;
};

const ringD = (ring, pj) => {
  const reduced = simplifyRing(ring);
  return reduced.map((pt, i) => `${i ? 'L' : 'M'}${fmt(pj(pt)[0])} ${fmt(pj(pt)[1])}`).join('') + 'Z';
};

const geo = JSON.parse(await fs.readFile(input, 'utf8'));
if (!Array.isArray(geo.features)) throw new Error('Invalid GeoJSON: FeatureCollection required');

const byId = new Map();
const warnings = [];
for (const f of geo.features) {
  const prefName = pickName(f.properties);
  const id = nameToId.get(prefName);
  if (!id) continue;
  const bucket = byId.get(id) || [];
  bucket.push(f);
  byId.set(id, bucket);
}

if (byId.size !== 47) {
  const missing = PREF_ORDER.filter((id) => !byId.has(id));
  warnings.push(`missing prefectures: ${missing.join(', ')}`);
  throw new Error(`Expected 47 prefectures, got ${byId.size}`);
}

const geometryById = new Map();
for (const id of PREF_ORDER) {
  const features = byId.get(id) || [];
  const all = [];
  for (const f of features) all.push(...toPolys(f.geometry));
  if (all.length === 0) warnings.push(`no polygon geometry: ${id}`);
  geometryById.set(id, { type: 'MultiPolygon', coordinates: all });
}

let minLon = 180, maxLon = 120, minLat = 90, maxLat = 20;
for (const g of geometryById.values()) {
  for (const poly of toPolys(g)) for (const ring of poly) for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }
}

const vb = { x: 120, y: 50, w: 620, h: 640, pad: 20 };
const s = Math.min((vb.w - vb.pad * 2) / (maxLon - minLon), (vb.h - vb.pad * 2) / (maxLat - minLat));
const ox = vb.x + (vb.w - (maxLon - minLon) * s) / 2;
const oy = vb.y + (vb.h - (maxLat - minLat) * s) / 2;
const pj = ([lon, lat]) => [ox + (lon - minLon) * s, oy + (maxLat - lat) * s];

const shapeLines = PREF_ORDER.map((id) => {
  const g = geometryById.get(id);
  const d = toPolys(g).map((poly) => poly.map((ring) => ringD(ring, pj)).join('')).join('');
  if (d.length < 40) warnings.push(`path too short: ${id} (${d.length})`);
  return `  ${id}: ${JSON.stringify(d)}`;
});
const shapesBlock = `const SHAPES = {\n${shapeLines.join(',\n')}\n};`;

let html = await fs.readFile('index.html', 'utf8');
const shapesRe = /const SHAPES\s*=\s*\{[\s\S]*?\};/;
if (!shapesRe.test(html)) throw new Error('SHAPES block not found in index.html');
html = html.replace(shapesRe, shapesBlock);
html = html.replace(/(<svg id="japanMap"[^>]*data-source=")([^"]+)(")/, '$1mlit-n03-derived$3');
html = html.replace(/地図データ出典：[^<]+/, '地図データ出典：国土数値情報（行政区域データ N03）を加工して作成（GeoJSON→SVG埋め込み）。');

await fs.writeFile('index.html', html, 'utf8');

const totalPathChars = shapeLines.reduce((sum, line) => sum + line.length, 0);
console.log(`features: ${geo.features.length}`);
console.log(`prefectures: ${byId.size}`);
console.log('updated: index.html');
console.log('data-source: mlit-n03-derived');
console.log(`total-path-chars: ${totalPathChars}`);
if (warnings.length) {
  console.log('warnings:');
  for (const w of warnings) console.log(`- ${w}`);
}

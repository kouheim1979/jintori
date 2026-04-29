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

const nameToId = new Map([
['北海道','hokkaido'],['青森県','aomori'],['岩手県','iwate'],['宮城県','miyagi'],['秋田県','akita'],['山形県','yamagata'],['福島県','fukushima'],['茨城県','ibaraki'],['栃木県','tochigi'],['群馬県','gunma'],['埼玉県','saitama'],['千葉県','chiba'],['東京都','tokyo'],['神奈川県','kanagawa'],['新潟県','niigata'],['富山県','toyama'],['石川県','ishikawa'],['福井県','fukui'],['山梨県','yamanashi'],['長野県','nagano'],['岐阜県','gifu'],['静岡県','shizuoka'],['愛知県','aichi'],['三重県','mie'],['滋賀県','shiga'],['京都府','kyoto'],['大阪府','osaka'],['兵庫県','hyogo'],['奈良県','nara'],['和歌山県','wakayama'],['鳥取県','tottori'],['島根県','shimane'],['岡山県','okayama'],['広島県','hiroshima'],['山口県','yamaguchi'],['徳島県','tokushima'],['香川県','kagawa'],['愛媛県','ehime'],['高知県','kochi'],['福岡県','fukuoka'],['佐賀県','saga'],['長崎県','nagasaki'],['熊本県','kumamoto'],['大分県','oita'],['宮崎県','miyazaki'],['鹿児島県','kagoshima'],['沖縄県','okinawa']
]);

const pickName = (p={}) => p.pref || p.nam_ja || p.name || p.N03_004 || p.N03_001;
const polys = (g) => g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
const ringD = (ring, pj) => ring.map((pt,i)=>`${i?'L':'M'}${pj(pt)[0].toFixed(2)} ${pj(pt)[1].toFixed(2)}`).join('') + 'Z';

const geo = JSON.parse(await fs.readFile(input, 'utf8'));
if (!geo.features) throw new Error('Invalid GeoJSON: FeatureCollection required');

const byId = new Map();
for (const f of geo.features) {
  const id = nameToId.get(pickName(f.properties));
  if (id) byId.set(id, f);
}
if (byId.size !== 47) throw new Error(`Expected 47 prefectures, got ${byId.size}`);

let minLon=180,maxLon=120,minLat=90,maxLat=20;
for (const f of byId.values()) for (const poly of polys(f.geometry)) for (const ring of poly) for (const [lon,lat] of ring){
  minLon=Math.min(minLon,lon);maxLon=Math.max(maxLon,lon);minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);
}
const vb={x:120,y:50,w:620,h:640,pad:20};
const s=Math.min((vb.w-vb.pad*2)/(maxLon-minLon),(vb.h-vb.pad*2)/(maxLat-minLat));
const ox=vb.x+(vb.w-(maxLon-minLon)*s)/2, oy=vb.y+(vb.h-(maxLat-minLat)*s)/2;
const pj=([lon,lat])=>[ox+(lon-minLon)*s, oy+(maxLat-lat)*s];

const html = await fs.readFile('index.html', 'utf8');
const ids=[...html.matchAll(/id:'([^']+)'/g)].map(m=>m[1]).slice(0,47);
const paths = ids.map(id=>{
  const name=[...nameToId].find(([,v])=>v===id)[0];
  const d=polys(byId.get(id).geometry).map(poly=>poly.map(r=>ringD(r,pj)).join('')).join('');
  return `<path d="${d}" class="pref-shape" data-pref-id="${id}" aria-label="${name}"></path>`;
});

console.log(paths.join('\n'));
console.error('Generated 47 path elements. Paste them into index.html drawMap() data source.');

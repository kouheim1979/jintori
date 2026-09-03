#!/usr/bin/env node
/**
 * build-prefecture-svg.mjs
 *
 * 国土数値情報 N03（行政区域）を、Geolonia map-full.svg と同様に
 * 「都道府県単位で操作できるSVG」へ変換する。
 *
 * 推奨:
 *   node tools/build-prefecture-svg.mjs \
 *     --input-dir data/n03-prefectures \
 *     --output public/map-full.svg
 *
 * 互換:
 *   node tools/build-prefecture-svg.mjs input.geojson output.svg
 */

import fs from "node:fs";
import path from "node:path";

const PREFECTURES = [
  { name: "北海道", code: "01", slug: "hokkaido", region: "hokkaido" },
  { name: "青森県", code: "02", slug: "aomori", region: "tohoku" },
  { name: "岩手県", code: "03", slug: "iwate", region: "tohoku" },
  { name: "宮城県", code: "04", slug: "miyagi", region: "tohoku" },
  { name: "秋田県", code: "05", slug: "akita", region: "tohoku" },
  { name: "山形県", code: "06", slug: "yamagata", region: "tohoku" },
  { name: "福島県", code: "07", slug: "fukushima", region: "tohoku" },
  { name: "茨城県", code: "08", slug: "ibaraki", region: "kanto" },
  { name: "栃木県", code: "09", slug: "tochigi", region: "kanto" },
  { name: "群馬県", code: "10", slug: "gunma", region: "kanto" },
  { name: "埼玉県", code: "11", slug: "saitama", region: "kanto" },
  { name: "千葉県", code: "12", slug: "chiba", region: "kanto" },
  { name: "東京都", code: "13", slug: "tokyo", region: "kanto" },
  { name: "神奈川県", code: "14", slug: "kanagawa", region: "kanto" },
  { name: "新潟県", code: "15", slug: "niigata", region: "chubu" },
  { name: "富山県", code: "16", slug: "toyama", region: "chubu" },
  { name: "石川県", code: "17", slug: "ishikawa", region: "chubu" },
  { name: "福井県", code: "18", slug: "fukui", region: "chubu" },
  { name: "山梨県", code: "19", slug: "yamanashi", region: "chubu" },
  { name: "長野県", code: "20", slug: "nagano", region: "chubu" },
  { name: "岐阜県", code: "21", slug: "gifu", region: "chubu" },
  { name: "静岡県", code: "22", slug: "shizuoka", region: "chubu" },
  { name: "愛知県", code: "23", slug: "aichi", region: "chubu" },
  { name: "三重県", code: "24", slug: "mie", region: "kinki" },
  { name: "滋賀県", code: "25", slug: "shiga", region: "kinki" },
  { name: "京都府", code: "26", slug: "kyoto", region: "kinki" },
  { name: "大阪府", code: "27", slug: "osaka", region: "kinki" },
  { name: "兵庫県", code: "28", slug: "hyogo", region: "kinki" },
  { name: "奈良県", code: "29", slug: "nara", region: "kinki" },
  { name: "和歌山県", code: "30", slug: "wakayama", region: "kinki" },
  { name: "鳥取県", code: "31", slug: "tottori", region: "chugoku" },
  { name: "島根県", code: "32", slug: "shimane", region: "chugoku" },
  { name: "岡山県", code: "33", slug: "okayama", region: "chugoku" },
  { name: "広島県", code: "34", slug: "hiroshima", region: "chugoku" },
  { name: "山口県", code: "35", slug: "yamaguchi", region: "chugoku" },
  { name: "徳島県", code: "36", slug: "tokushima", region: "shikoku" },
  { name: "香川県", code: "37", slug: "kagawa", region: "shikoku" },
  { name: "愛媛県", code: "38", slug: "ehime", region: "shikoku" },
  { name: "高知県", code: "39", slug: "kochi", region: "shikoku" },
  { name: "福岡県", code: "40", slug: "fukuoka", region: "kyushu-okinawa" },
  { name: "佐賀県", code: "41", slug: "saga", region: "kyushu-okinawa" },
  { name: "長崎県", code: "42", slug: "nagasaki", region: "kyushu-okinawa" },
  { name: "熊本県", code: "43", slug: "kumamoto", region: "kyushu-okinawa" },
  { name: "大分県", code: "44", slug: "oita", region: "kyushu-okinawa" },
  { name: "宮崎県", code: "45", slug: "miyazaki", region: "kyushu-okinawa" },
  { name: "鹿児島県", code: "46", slug: "kagoshima", region: "kyushu-okinawa" },
  { name: "沖縄県", code: "47", slug: "okinawa", region: "kyushu-okinawa" },
];

const PREF_BY_NAME = new Map(PREFECTURES.map((p, index) => [p.name, { ...p, order: index }]));
const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 1000;
const MARGIN = 24;

// Geolonia の「縦横比のため一部離島省略」に近づける実用範囲。
// 沖縄本島・先島諸島、主要な小笠原諸島は概ね含み、
// 南鳥島・沖ノ鳥島など表示を極端に横長/縦長にする離島を除外する。
const COMPACT_BOUNDS = {
  minLon: 121.0,
  minLat: 24.0,
  maxLon: 147.0,
  maxLat: 46.5,
};

const options = parseArgs(process.argv.slice(2));

try {
  main(options);
} catch (error) {
  console.error("\n[ERROR] SVG生成に失敗しました。");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(argv.length === 0 ? 1 : 0);
  }

  // 旧形式: input.geojson output.svg
  if (!argv[0].startsWith("-")) {
    return {
      inputFiles: [argv[0]],
      inputDir: null,
      output: argv[1] ?? "./public/map-full.svg",
      compact: true,
      strict: true,
    };
  }

  const result = {
    inputFiles: [],
    inputDir: null,
    output: "./public/map-full.svg",
    compact: true,
    strict: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    switch (arg) {
      case "--input": {
        const value = requireValue(argv, ++i, arg);
        result.inputFiles.push(value);
        break;
      }
      case "--input-dir":
        result.inputDir = requireValue(argv, ++i, arg);
        break;
      case "--output":
        result.output = requireValue(argv, ++i, arg);
        break;
      case "--keep-all-islands":
        result.compact = false;
        break;
      case "--allow-incomplete":
        result.strict = false;
        break;
      default:
        throw new Error(`不明なオプションです: ${arg}\n--help で使い方を確認してください。`);
    }
  }

  if (!result.inputDir && result.inputFiles.length === 0) {
    throw new Error("--input または --input-dir を指定してください。");
  }

  return result;
}

function requireValue(argv, index, optionName) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${optionName} の値がありません。`);
  }
  return value;
}

function printHelp() {
  console.log(`
国土数値情報 N03 → 都道府県SVG

推奨:
  node tools/build-prefecture-svg.mjs \\
    --input-dir data/n03-prefectures \\
    --output public/map-full.svg

単一ファイル:
  node tools/build-prefecture-svg.mjs \\
    --input data/prefectures.geojson \\
    --output public/map-full.svg

旧形式も使用可能:
  node tools/build-prefecture-svg.mjs data/prefectures.geojson public/map-full.svg

オプション:
  --keep-all-islands   南鳥島・沖ノ鳥島等を含め、入力の全離島を残す
  --allow-incomplete   47都道府県が揃っていなくてもエラーにしない
  -h, --help           ヘルプ
`);
}

function main(opts) {
  const files = resolveInputFiles(opts);
  const features = files.flatMap((file) => readGeoJson(file).features);
  const prefMap = groupFeaturesByPrefecture(features);

  validatePrefectures(prefMap, opts.strict);

  const displayBounds = opts.compact ? COMPACT_BOUNDS : null;
  const allProjectedPoints = collectAllProjectedPoints(prefMap, displayBounds);
  const bounds = getBounds(allProjectedPoints);
  const transform = createTransform(bounds);
  const prefecturePaths = buildPrefecturePaths(prefMap, transform, displayBounds);

  validateRenderedPaths(prefecturePaths, opts.strict);

  const svg = renderSvg(prefecturePaths, {
    compact: opts.compact,
    sourceFileCount: files.length,
  });

  ensureDirectory(path.dirname(opts.output));
  fs.writeFileSync(opts.output, svg, "utf8");

  const sizeKb = Math.round(fs.statSync(opts.output).size / 1024);
  console.log("[OK] SVGを生成しました。");
  console.log(`入力ファイル数: ${files.length}`);
  console.log(`都道府県数: ${prefecturePaths.length}`);
  console.log(`表示モード: ${opts.compact ? "compact（一部遠隔離島を省略）" : "all islands"}`);
  console.log(`出力: ${opts.output}`);
  console.log(`サイズ: 約 ${sizeKb} KB`);
}

function resolveInputFiles(opts) {
  const files = [...opts.inputFiles];

  if (opts.inputDir) {
    if (!fs.existsSync(opts.inputDir)) {
      throw new Error(`入力ディレクトリが見つかりません: ${opts.inputDir}`);
    }

    const dirFiles = fs
      .readdirSync(opts.inputDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".geojson"))
      .map((entry) => path.join(opts.inputDir, entry.name))
      .sort();

    files.push(...dirFiles);
  }

  const unique = [...new Set(files.map((file) => path.resolve(file)))];

  if (unique.length === 0) {
    throw new Error("GeoJSON入力が1件も見つかりませんでした。");
  }

  for (const file of unique) {
    if (!fs.existsSync(file)) {
      throw new Error(`入力ファイルが見つかりません: ${file}`);
    }
  }

  return unique;
}

function readGeoJson(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  let geojson;

  try {
    geojson = JSON.parse(text);
  } catch (error) {
    throw new Error(`GeoJSONの解析に失敗しました: ${filePath}\n${error.message}`);
  }

  if (!geojson || geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
    throw new Error(`FeatureCollectionではありません: ${filePath}`);
  }

  return geojson;
}

function groupFeaturesByPrefecture(features) {
  const map = new Map();

  for (const feature of features) {
    if (!feature || feature.type !== "Feature" || !feature.geometry) continue;

    const name = getPrefectureName(feature.properties ?? {});
    if (!name) continue;

    if (!map.has(name)) map.set(name, []);
    map.get(name).push(feature);
  }

  return map;
}

function getPrefectureName(props) {
  const candidates = [props.N03_001, props.prefecture, props.pref, props.name, props.NAME_1];

  for (const value of candidates) {
    if (typeof value === "string" && PREF_BY_NAME.has(value)) return value;
  }

  return null;
}

function validatePrefectures(prefMap, strict) {
  const missing = PREFECTURES.filter((p) => !prefMap.has(p.name)).map((p) => p.name);

  if (prefMap.size === 0) {
    throw new Error("都道府県を取得できませんでした。N03_001 属性を確認してください。");
  }

  if (missing.length > 0) {
    const message = `見つからない都道府県があります (${missing.length}): ${missing.join(", ")}`;
    if (strict) throw new Error(message);
    console.warn(`[WARN] ${message}`);
  }
}

function collectAllProjectedPoints(prefMap, displayBounds) {
  const points = [];

  for (const features of prefMap.values()) {
    for (const feature of features) {
      for (const polygon of collectPolygons(feature.geometry)) {
        for (const ring of polygon) {
          if (!shouldKeepRing(ring, displayBounds)) continue;
          for (const coord of ring) {
            if (!isLonLat(coord)) continue;
            points.push(projectLonLat(coord[0], coord[1]));
          }
        }
      }
    }
  }

  if (points.length === 0) {
    throw new Error("表示対象の有効座標がありません。");
  }

  return points;
}

function collectPolygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  if (geometry.type === "GeometryCollection") {
    return (geometry.geometries ?? []).flatMap((child) => collectPolygons(child));
  }
  return [];
}

function shouldKeepRing(ring, bounds) {
  if (!bounds) return true;
  if (!Array.isArray(ring) || ring.length < 3) return false;

  // 重心ではなく「1点でも範囲内」を採用し、境界付近の島を落としにくくする。
  return ring.some((coord) => isLonLat(coord) && isInsideBounds(Number(coord[0]), Number(coord[1]), bounds));
}

function isInsideBounds(lon, lat, bounds) {
  return lon >= bounds.minLon && lon <= bounds.maxLon && lat >= bounds.minLat && lat <= bounds.maxLat;
}

function isLonLat(coord) {
  return (
    Array.isArray(coord) &&
    coord.length >= 2 &&
    Number.isFinite(Number(coord[0])) &&
    Number.isFinite(Number(coord[1]))
  );
}

function projectLonLat(lonInput, latInput) {
  const lon = Number(lonInput);
  const lat = Number(latInput);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    throw new Error(`不正な座標です: lon=${lonInput}, lat=${latInput}`);
  }

  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clampedLat * Math.PI) / 180;

  return {
    x: lon,
    y: Math.log(Math.tan(Math.PI / 4 + rad / 2)) * (180 / Math.PI),
  };
}

function getBounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

function createTransform(bounds) {
  const sourceWidth = bounds.maxX - bounds.minX;
  const sourceHeight = bounds.maxY - bounds.minY;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("地図の範囲計算に失敗しました。");
  }

  const scale = Math.min(
    (VIEWBOX_WIDTH - MARGIN * 2) / sourceWidth,
    (VIEWBOX_HEIGHT - MARGIN * 2) / sourceHeight,
  );

  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const offsetX = (VIEWBOX_WIDTH - renderedWidth) / 2;
  const offsetY = (VIEWBOX_HEIGHT - renderedHeight) / 2;

  return (lon, lat) => {
    const p = projectLonLat(lon, lat);
    return {
      x: round2(offsetX + (p.x - bounds.minX) * scale),
      y: round2(offsetY + (bounds.maxY - p.y) * scale),
    };
  };
}

function buildPrefecturePaths(prefMap, transform, displayBounds) {
  const result = [];

  for (const pref of PREFECTURES) {
    const features = prefMap.get(pref.name);
    if (!features) continue;

    const d = buildPathData(features, transform, displayBounds);
    if (!d) continue;

    result.push({ ...pref, d });
  }

  return result;
}

function buildPathData(features, transform, displayBounds) {
  const commands = [];

  for (const feature of features) {
    for (const polygon of collectPolygons(feature.geometry)) {
      for (const ring of polygon) {
        if (!shouldKeepRing(ring, displayBounds)) continue;

        const validCoords = ring.filter(isLonLat);
        if (validCoords.length < 3) continue;

        const start = transform(validCoords[0][0], validCoords[0][1]);
        commands.push(`M${start.x} ${start.y}`);

        for (let i = 1; i < validCoords.length; i += 1) {
          const p = transform(validCoords[i][0], validCoords[i][1]);
          commands.push(`L${p.x} ${p.y}`);
        }

        commands.push("Z");
      }
    }
  }

  return commands.join(" ");
}

function validateRenderedPaths(paths, strict) {
  const missing = PREFECTURES.filter((pref) => !paths.some((p) => p.code === pref.code));
  if (missing.length === 0) return;

  const message = `SVGに描画できない都道府県があります: ${missing.map((p) => p.name).join(", ")}`;
  if (strict) throw new Error(message);
  console.warn(`[WARN] ${message}`);
}

function renderSvg(paths, meta) {
  const groups = paths
    .map((pref) => {
      const classes = `${pref.slug} ${pref.region} prefecture`;
      return `  <g id="JP-${pref.code}" class="${classes}" data-code="${pref.code}" data-name="${escapeXml(pref.name)}" tabindex="0" role="button" aria-label="${escapeXml(pref.name)}">
    <title>${escapeXml(pref.name)}</title>
    <path d="${pref.d}" />
  </g>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  class="geolonia-svg-map"
  viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}"
  role="img"
  aria-label="日本の都道府県地図"
  preserveAspectRatio="xMidYMid meet"
>
  <title>日本の都道府県地図</title>
  <desc>国土数値情報 行政区域データから生成した都道府県別SVG</desc>
  <metadata>
    Source: 国土数値情報 行政区域データ (N03)
    Processed: dissolve by N03_001, simplify, SVG conversion
    Input files: ${meta.sourceFileCount}
    Display: ${meta.compact ? "compact; some remote islands omitted for practical aspect ratio" : "all islands"}
  </metadata>
  <style>
    .prefecture {
      fill: #eeeeee;
      stroke: #666666;
      stroke-width: 1;
      stroke-linejoin: round;
      cursor: pointer;
      outline: none;
    }
    .prefecture path {
      fill-rule: evenodd;
      vector-effect: non-scaling-stroke;
    }
    .prefecture:hover,
    .prefecture:focus {
      fill: #cfe8ff;
    }
    .prefecture.selected,
    .prefecture.is-selected {
      fill: #facc15;
    }
  </style>
  <g class="prefectures">
${groups}
  </g>
</svg>
`;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function ensureDirectory(dirPath) {
  if (!dirPath || dirPath === ".") return;
  fs.mkdirSync(dirPath, { recursive: true });
}

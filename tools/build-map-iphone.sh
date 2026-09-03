#!/usr/bin/env bash
set -Eeuo pipefail

# iPhone + GitHub Codespaces / GitHub Actions 向け
# 国土数値情報 N03 2026年版を都道府県別に順次処理し、
# public/map-full.svg を生成する。
#
# 使い方:
#   bash tools/build-map-iphone.sh
#
# 環境変数で変更可能:
#   N03_YEAR=2026
#   N03_DATE=20260101
#   SIMPLIFY=6%
#   MAPSHAPER_VERSION=0.7.56

N03_YEAR="${N03_YEAR:-2026}"
N03_DATE="${N03_DATE:-20260101}"
SIMPLIFY="${SIMPLIFY:-6%}"
MAPSHAPER_VERSION="${MAPSHAPER_VERSION:-0.7.56}"
BASE_URL="https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-${N03_YEAR}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_DIR="$ROOT_DIR/.cache/n03-${N03_YEAR}"
PROCESSED_DIR="$ROOT_DIR/data/n03-prefectures"
OUTPUT_SVG="$ROOT_DIR/public/map-full.svg"

on_error() {
  local exit_code=$?
  local line_no=${1:-unknown}
  echo >&2
  echo "[ERROR] 処理に失敗しました。line=${line_no}, exit=${exit_code}" >&2
  echo "        途中生成物は $CACHE_DIR と $PROCESSED_DIR に残しています。" >&2
  exit "$exit_code"
}
trap 'on_error $LINENO' ERR

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[ERROR] 必要なコマンドがありません: $1" >&2
    exit 1
  fi
}

require_command curl
require_command unzip
require_command node
require_command npx

mkdir -p "$CACHE_DIR" "$PROCESSED_DIR" "$(dirname "$OUTPUT_SVG")"

echo "============================================================"
echo " 国土数値情報 N03 → 都道府県 SVG"
echo "============================================================"
echo "年度        : $N03_YEAR"
echo "基準日      : $N03_DATE"
echo "簡略化      : $SIMPLIFY"
echo "mapshaper   : $MAPSHAPER_VERSION"
echo "出力        : $OUTPUT_SVG"
echo "============================================================"

# 全国一括ではなく47都道府県を1件ずつ処理する。
# Codespaces/Actionsでのメモリ不足・ストレージ急増を避けるため。
for number in $(seq 1 47); do
  code=$(printf "%02d" "$number")
  zip_name="N03-${N03_DATE}_${code}_GML.zip"
  url="$BASE_URL/$zip_name"
  zip_path="$CACHE_DIR/$zip_name"
  extract_dir="$CACHE_DIR/extract-$code"
  processed_file="$PROCESSED_DIR/pref-$code.geojson"

  echo
  echo "[$code/47] 処理開始"

  if [[ -s "$processed_file" ]]; then
    echo "  - 既存の処理済みファイルを再利用: $processed_file"
    continue
  fi

  if [[ ! -s "$zip_path" ]]; then
    echo "  - ダウンロード: $zip_name"
    curl \
      --fail \
      --location \
      --retry 3 \
      --retry-all-errors \
      --retry-delay 2 \
      --connect-timeout 30 \
      --output "$zip_path.part" \
      "$url"
    mv "$zip_path.part" "$zip_path"
  else
    echo "  - ダウンロード済みZIPを再利用"
  fi

  rm -rf "$extract_dir"
  mkdir -p "$extract_dir"
  echo "  - 展開"
  unzip -q -o "$zip_path" -d "$extract_dir"

  source_file="$(find "$extract_dir" -type f -iname '*.geojson' -print -quit || true)"
  if [[ -z "$source_file" ]]; then
    source_file="$(find "$extract_dir" -type f -iname '*.shp' -print -quit || true)"
  fi

  if [[ -z "$source_file" ]]; then
    echo "[ERROR] GeoJSON/Shapefileが見つかりません: $zip_name" >&2
    find "$extract_dir" -maxdepth 2 -type f -print >&2 || true
    exit 1
  fi

  echo "  - 都道府県単位へ結合・軽量化"
  npx --yes "mapshaper@${MAPSHAPER_VERSION}" \
    "$source_file" \
    -filter 'N03_001 != null' \
    -dissolve N03_001 copy-fields=N03_001 \
    -simplify weighted "$SIMPLIFY" keep-shapes \
    -o force format=geojson "$processed_file"

  if [[ ! -s "$processed_file" ]]; then
    echo "[ERROR] GeoJSON生成に失敗しました: $processed_file" >&2
    exit 1
  fi

  rm -rf "$extract_dir"
  echo "  - 完了"
done

count=$(find "$PROCESSED_DIR" -maxdepth 1 -type f -name 'pref-*.geojson' | wc -l | tr -d ' ')
if [[ "$count" != "47" ]]; then
  echo "[ERROR] 処理済み都道府県が47件ではありません: $count" >&2
  exit 1
fi

echo
echo "[SVG] 47都道府県を1つのSVGへ変換"
node "$ROOT_DIR/tools/build-prefecture-svg.mjs" \
  --input-dir "$PROCESSED_DIR" \
  --output "$OUTPUT_SVG"

if ! grep -q 'data-code="47"' "$OUTPUT_SVG"; then
  echo "[ERROR] SVG検証に失敗しました。沖縄県(data-code=47)がありません。" >&2
  exit 1
fi

if ! grep -q 'data-code="01"' "$OUTPUT_SVG"; then
  echo "[ERROR] SVG検証に失敗しました。北海道(data-code=01)がありません。" >&2
  exit 1
fi

echo
echo "============================================================"
echo " 完了"
echo "============================================================"
echo "SVG: $OUTPUT_SVG"
echo "次は git status で確認してください。"

# iPhoneだけで国土数値情報から `map-full.svg` を作る

## 結論

一番簡単なのは **GitHub Actions** です。

このリポジトリには必要なスクリプトとWorkflowを入れてあります。iPhoneでGitHubを開いて、

**Actions → Build Japan Prefecture SVG → Run workflow**

を押すだけで生成できます。

生成された `public/map-full.svg` は自動でリポジトリへコミットされます。

---

## ファイル構成

```text
.github/
└─ workflows/
   └─ build-prefecture-map.yml

tools/
├─ build-map-iphone.sh
├─ build-prefecture-svg.mjs
└─ import-geolonia-map.mjs
```

生成物:

```text
public/
└─ map-full.svg
```

---

# 方法A: GitHub Actions（iPhone推奨）

## 1. Actionsを開く

GitHubでこのリポジトリを開きます。

```text
Actions
↓
Build Japan Prefecture SVG
↓
Run workflow
↓
Run workflow
```

`Simplify ratio` は通常 `6%` のままでOKです。

- `3%`: より細かい・ファイル大きめ
- `6%`: 推奨
- `10%`: 軽い・輪郭はやや粗い

## 2. 完了確認

Actionsが緑色のチェックになったら、

```text
public/map-full.svg
```

が追加されます。

---

# 方法B: GitHub Codespaces

Codespacesのターミナルで、リポジトリのルートから次の1行だけ実行します。

```bash
bash tools/build-map-iphone.sh
```

完了後:

```bash
git status
```

を実行して確認できます。

---

# この版のポイント

## 1. 都道府県ごとに順次処理

N03の全国版を一括処理せず、47都道府県を1県ずつダウンロード・処理します。
Codespaces/GitHub Actionsでのメモリ不足を起こしにくい構成です。

## 2. 都道府県境界だけにする

各県で `N03_001` により `dissolve` するため、市区町村の内部境界はSVGに残りません。

## 3. Geolonia互換に近いDOM

出力は次の形式です。

```html
<svg class="geolonia-svg-map" ...>
  <g class="prefectures">
    <g
      id="JP-14"
      class="kanagawa kanto prefecture"
      data-code="14"
      data-name="神奈川県"
    >
      <title>神奈川県</title>
      <path d="..." />
    </g>
  </g>
</svg>
```

JavaScriptでは次のように扱えます。

```js
const prefectures = document.querySelectorAll(".geolonia-svg-map .prefecture");

prefectures.forEach((prefecture) => {
  prefecture.addEventListener("click", () => {
    console.log(prefecture.dataset.code, prefecture.dataset.name);
  });
});
```

## 4. 遠隔離島の扱い

標準では実用的な縦横比を優先し、遠隔離島の一部を表示範囲から外します。

全離島を残したい場合:

```bash
node tools/build-prefecture-svg.mjs \
  --input-dir data/n03-prefectures \
  --output public/map-full-all-islands.svg \
  --keep-all-islands
```

## 5. 47都道府県を自動検証

1県でも欠けた場合は正常終了しません。
北海道 `01` と沖縄県 `47` も追加確認します。

---

# 出典表記

アプリ・サイトには次のような出典表示を入れてください。

```html
<small>
  地図データ：国土数値情報「行政区域データ（N03）」を加工して作成。
</small>
```

---

# よくあるエラー

## Actionsに「Run workflow」がない

Workflowファイルがデフォルトブランチ `main` にあるか確認します。

## `Resource not accessible by integration`

リポジトリの

```text
Settings
→ Actions
→ General
→ Workflow permissions
```

で `Read and write permissions` が必要な場合があります。

## ダウンロード404

国土数値情報の年度・ファイル名が更新された可能性があります。
`tools/build-map-iphone.sh` の `N03_YEAR` と `N03_DATE` を新年度に変更します。

## SVGが重い

Actions実行時の `Simplify ratio` を `8%` または `10%` にします。

---

# 標準設定

```text
N03年度         : 2026
基準日           : 2026-01-01
mapshaper        : 0.7.56
simplify         : 6%
出力             : public/map-full.svg
SVG都道府県数    : 47
```

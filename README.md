# jintori
## 実データ地図への置換手順

1. 国土数値情報由来の都道府県GeoJSON（例: open-data-jp-prefectures-geojson）を `data/prefectures.geojson` として保存します。
2. `node tools/build-prefecture-svg.mjs data/prefectures.geojson` を実行します。
3. 出力された47件の `<path ...>` を `index.html` の地図描画処理へ埋め込みます。
4. `index.html` の `data-source` とフッター出典表記を、実際に使ったデータ出典へ更新します。
5. `validateData()` の警告が消えることを確認します。

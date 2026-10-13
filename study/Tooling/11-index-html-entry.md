# index.html がエントリーポイント

## 概要

webpack などの従来ツールでは「エントリーは JS ファイル（例: `src/index.js`）」で、HTML はプラグインで後から生成していました。

Vite では **`index.html` がエントリーポイント**です。Vite は `index.html` を起点に、その中の `<script type="module" src="...">` をたどって依存関係を解決します。そのため `index.html` は `public/` ではなく**プロジェクトのルート**（`web-app/index.html`）に置きます。

## このプロジェクトでの実装

```html
<!-- web-app/index.html:1-13 -->
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>シンプル家計簿</title>
    </head>
    <body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
    </body>
</html>
```

| 行 | 内容 | 役割 |
| --- | --- | --- |
| `web-app/index.html:10` | `<div id="root"></div>` | React が描画する土台 |
| `web-app/index.html:11` | `<script type="module" src="/src/main.tsx">` | **アプリの JS エントリー**。`.tsx` を直接指定できるのは Vite が変換してくれるから |

`main.tsx` 側で `#root` を取得して React を描画します。

```tsx
// web-app/src/main.tsx:6
createRoot(document.getElementById("root")!).render(
```

### ビルド後はどう変わるか

`vite build` すると、`index.html` も処理されて `dist/index.html` に出力されます。実際の `web-app/dist/index.html` では、

```html
<script type="module" crossorigin src="/assets/index-fdIn559j.js"></script>
```

（ハッシュ部分 `fdIn559j` はビルドのたびに内容に応じて変わります。2026-10-12 時点の値）

が `<head>` 内に挿入され、元の `/src/main.tsx` を指す `<script>` は消えています。つまり **Vite は HTML 内の参照をビルド結果のファイル名に書き換える**のです（[13](./13-vite-preview-and-dist.md)）。

## 重要語句

- **エントリーポイント**: バンドラが依存関係の解析を始める起点となるファイル。
- **`type="module"`**: その script を ES モジュールとして読み込む指定。`import` 文が使え、`defer` と同様に HTML の解析後に実行される。
- **public ディレクトリ**: Vite で「変換せずそのまま `dist/` 直下にコピーする」ファイルの置き場（デフォルト `public/`）。
- **ルート相対パス**: `/favicon.svg` のように `/` から始まるパス。

## 仕様・注意点

- **`/favicon.svg` が存在しません。** `web-app/index.html:5` で参照していますが、`web-app/public/` ディレクトリ自体がなく、`web-app/dist/` にも `favicon.svg` はありません。ブラウザのタブにアイコンが出ず、開発者ツールに 404 が出ているはずです。テンプレートから `public/` を削除したときに参照だけ残ったと考えられます。
- `<html lang="en">` のままですが、ページは日本語（`<title>シンプル家計簿</title>`）。`lang` はスクリーンリーダーの読み上げや翻訳機能、フォント選択に影響します。
- `index.html` 内の `/` で始まるパスは、開発時はプロジェクトルート、ビルド時は `base` 設定（デフォルト `/`）を基準に解決されます。サブディレクトリ（例: `https://example.com/kakeibo/`）にデプロイする場合は `vite.config.ts` に `base: "/kakeibo/"` が必要です。
- `index.html` で `%VITE_XXX%` のように書くと環境変数を埋め込めます（対象は `import.meta.env` に公開される変数、つまり `VITE_` 接頭辞の変数や `MODE` などの組み込み変数。[16](./16-import-meta-env-vite-prefix.md)）。

## 今後に活かせるポイント

- Vite のプロジェクトで「アプリがどこから始まるか」を知りたいときは、まず `index.html` の `<script type="module">` を見る。
- 複数ページ（MPA）にしたい場合は、HTML を複数用意して `build.rolldownOptions.input` に列挙する（Vite 8 では `rollupOptions` ではなく `rolldownOptions`）。

## 改善するなら

1. favicon を用意する: `web-app/public/favicon.svg` を作成する（`public/` に置いたファイルは `/favicon.svg` で参照でき、ビルド時に `dist/` 直下へコピーされる）。不要なら `web-app/index.html:5` の `<link>` を削除する。
2. 言語指定を直す。
   ```html
   <html lang="ja">
   ```
3. `<meta name="description" content="収入と支出を記録するシンプルな家計簿アプリ">` を追加すると、検索結果や共有時の表示が良くなる。

## 次に学ぶこと

- `public/` と `src/assets/` の使い分け（前者はそのままコピー、後者は import して処理・ハッシュ付与される）
- OGP（SNS 共有時のプレビュー）用の meta タグ
- MPA（複数ページ）構成と `build.rolldownOptions.input`

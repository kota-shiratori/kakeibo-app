# vite preview と dist の中身（ハッシュ付きファイル名）

## 概要

`vite build` の成果物は `dist/` ディレクトリに出力されます。中身は **HTML・JS・CSS・画像などの静的ファイルだけ**なので、Node.js がなくても、どんな静的ホスティング（Vercel, Netlify, Cloudflare Pages, GitHub Pages, S3 など）にも置けます。

`vite preview` は、この `dist/` を**ローカルで配信して動作確認する**ためのサーバです。本番サーバの代わりではありません。

## このプロジェクトでの実装

```json
// web-app/package.json:11
"preview": "vite preview",
```

`npm run build` の後に `npm run preview` を実行すると、`http://localhost:4173` で `dist/` が配信されます（4173 は Vite 内部の `DEFAULT_PREVIEW_PORT`）。

### dist の構造（現在の状態）

```
web-app/dist/
├── index.html                    … 書き換え済みの HTML
├── assets/
│   └── index-fdIn559j.js         … アプリ全体をまとめた JS（約 556KB）
└── study/                        … npm run build:study がコピーした学習ノート（vite build の出力ではない）
```

`web-app/dist/index.html` では、`<head>` に次の行が挿入されています。

```html
<script type="module" crossorigin src="/assets/index-fdIn559j.js"></script>
```

ポイント:

- 元の `<script type="module" src="/src/main.tsx">`（`web-app/index.html:11`）は消え、ビルド後の JS への参照に置き換わっている。
- React・React DOM・Chakra UI・React Router・アプリのコードが**1 つの JS にまとめられている**。
- CSS ファイルがないのは、Chakra UI（Emotion）が CSS を JS から実行時に生成する方式だから。
- `assets/` というディレクトリ名は `build.assetsDir` のデフォルト値（`'assets'`）、`dist` は `build.outDir` のデフォルト値（`'dist'`）。Vite の型定義（`vite/dist/node/index.d.ts`）の `@default` で確認できる。

### ハッシュ付きファイル名

`index-fdIn559j.js` の `fdIn559j` は**ファイル内容から計算したハッシュ**です。内容が 1 文字でも変わればハッシュも変わります。

これにより、

- JS には「1 年間キャッシュしてよい」という強いキャッシュ設定ができる（内容が変わればファイル名が変わるので、古いキャッシュが使われる心配がない）
- `index.html` だけはキャッシュさせない（または短くする）ことで、新しいハッシュ名の JS を確実に読み込ませる

という**キャッシュ戦略（キャッシュバスティング）**が実現できます。

## 重要語句

- **dist**: ビルド成果物の出力先。
- **静的ホスティング**: サーバ側の処理なしにファイルを配信するだけのホスティング。
- **コンテンツハッシュ**: ファイル内容から計算した短い識別子。内容が変わると変わる。
- **キャッシュバスティング**: ファイル名を変えることで、ブラウザや CDN の古いキャッシュを確実に無効化する手法。
- **vite preview**: ビルド結果をローカルで確認するための簡易サーバ。

## 仕様・注意点

- **`vite preview` は本番用サーバではない**と Vite 公式も明言しています。本番では静的ホスティングや nginx などを使います。
- `vite preview` は `dist/` がないと動きません。必ず先に `npm run build`。
- **SPA のルーティングに注意**: React Router でクライアント側ルーティングをしている場合、`/input` のような URL に直接アクセスすると、静的ホスティングでは `dist/input` というファイルを探して 404 になることがあります。`vite preview` は SPA 向けに `index.html` へフォールバックしてくれますが、本番のホスティングでは「すべてのパスを `index.html` に書き換える」設定（rewrite）が別途必要です（ルーティング自体は study/Routing 参照）。このプロジェクトでは後から追加された `web-app/vercel.json:6` の `rewrites` がこの役割を担っています（`/study/` 以下だけは書き換え対象から外している）。
- `dist/` は**ビルドのたびに中身が消されて作り直されます**（`build.emptyOutDir` が outDir がプロジェクト配下にある場合デフォルト true）。手作業でファイルを置いてはいけません。置きたいファイルは `public/` に。
- `dist/` は `web-app/.gitignore:11` で Git の対象外です。成果物はコミットせず、デプロイ時にビルドするのが基本。
- **環境変数はビルド時に埋め込まれる**ので、`dist/` は「ビルドしたときの `.env` の値」で固定されます（[16](./16-import-meta-env-vite-prefix.md)）。API の URL を変えたいなら再ビルドが必要です。
- `web-app/dist/` は最後にビルドした時点のスナップショットです。`src/` を変更したら再ビルドしないと反映されません（[12](./12-vite-build-and-typecheck.md)）。

## 今後に活かせるポイント

- デプロイ前に `npm run build && npm run preview` で「本番と同じ形」で動作確認する習慣をつける。開発サーバでは起きない問題（パスの問題、環境変数の未設定など）を事前に発見できる。
- ハッシュ付きファイル名とキャッシュの関係は、パフォーマンス改善やトラブルシュート（「デプロイしたのに反映されない」）で必ず役立つ知識。

## 改善するなら

- 1 ファイル約 556KB は、家計簿アプリとしては大きめです。ライブラリ部分を分けたりページ単位で遅延読み込みしたりすると、初回表示が速くなります。例（ページ単位の遅延読み込み）:
  ```tsx
  const Input = lazy(() => import("@/pages/Input"));
  ```
  こうすると `dist/assets/` に `Input-xxxx.js` のような別ファイルが生成されます（実装は React/Routing 担当の領域）。
- プレビューのポートを固定したい場合は `preview: { port: 4173, strictPort: true }`。

## 次に学ぶこと

- 静的ホスティングへのデプロイ（Vercel, Netlify, Cloudflare Pages）と SPA の rewrite 設定
- HTTP キャッシュヘッダ（`Cache-Control: immutable` など）
- `build.manifest` や `modulepreload` による読み込み最適化

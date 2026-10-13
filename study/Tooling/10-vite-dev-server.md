# Vite の開発サーバ（ネイティブ ESM と HMR）

## 概要

**Vite**（フランス語で「速い」、発音は「ヴィート」）はフロントエンドのビルドツールです。`web-app/node_modules/vite/README.md` によると、大きく 2 つの部分から成ります。

1. **開発サーバ**: ブラウザの**ネイティブ ES モジュール**を活用し、高速な **HMR（Hot Module Replacement）** を提供する
2. **ビルドコマンド**: **Rolldown** でコードをバンドルし、本番向けに最適化された静的ファイルを出力する（[12](./12-vite-build-and-typecheck.md)）

### なぜ速いのか（従来型バンドラとの違い）

| | 従来（webpack など） | Vite の開発サーバ |
| --- | --- | --- |
| 起動時 | アプリ全体をバンドルしてから配信 | **バンドルしない**。すぐ起動 |
| リクエスト時 | バンドル済みファイルを返す | ブラウザが `import` したファイルだけを**その都度変換**して返す |
| 変更時 | 関連するバンドルを作り直す | 変更されたモジュールだけ差し替え（HMR） |

ブラウザは `<script type="module">` と `import` 文を理解できるので、Vite は「TS/TSX → JS の変換」だけをして 1 ファイルずつ渡せばよい、という発想です。

## このプロジェクトでの実装

```json
// web-app/package.json:7
"dev": "vite",
// web-app/package.json:28
"vite": "^8.3.0",
```

`npm run dev` を `web-app/` で実行すると、`http://localhost:5173` で開発サーバが起動します（5173 は Vite 内部の `DEFAULT_DEV_PORT`）。インストール済みの Vite は **8.3.1** です。

### リクエストの流れ

1. ブラウザが `/` を要求 → Vite が `web-app/index.html` を返す（HMR 用のクライアントスクリプトなどを挿入した上で）。
2. HTML 内の `<script type="module" src="/src/main.tsx">`（`web-app/index.html:11`）をブラウザが要求。
3. Vite が `main.tsx` を JS に変換（JSX → `react/jsx-runtime` の呼び出し、型注釈の削除）して返す。
4. ブラウザが `main.tsx` 内の `import App from "./App"`（`web-app/src/main.tsx:3`）を見て `App.tsx` を要求 → 以下同様に芋づる式に読み込む。

### 依存の事前バンドル（Dependency Pre-Bundling）

`react` や `@chakra-ui/react` のような `node_modules` 内のライブラリは、ファイル数が膨大だったり CommonJS 形式だったりします。そのまま 1 ファイルずつ配信すると遅いので、Vite は初回起動時にこれらを**まとめて ESM に変換してキャッシュ**します。キャッシュ先は `web-app/node_modules/.vite/deps/` で、実際にこのディレクトリが存在します。

### HMR

ファイルを保存すると、Vite は WebSocket でブラウザに通知し、**変更されたモジュールだけ**を差し替えます。React コンポーネントの場合は `@vitejs/plugin-react` の **Fast Refresh** により、`useState` の状態を保ったまま見た目だけ更新されます（[14](./14-vite-config-plugin-react.md)、[18](./18-oxlint-react-rules-fast-refresh.md)）。

## 重要語句

- **Vite**: ネイティブ ESM ベースの開発サーバ + Rolldown ベースのビルドを提供するツール。
- **ネイティブ ESM**: ブラウザ自身が `import` を解決してファイルを読み込む仕組み。
- **HMR（Hot Module Replacement）**: ページ全体をリロードせずに、変更されたモジュールだけを実行中のアプリに差し替える機能。
- **Fast Refresh**: React 向けの HMR。コンポーネントの状態を保持したまま再描画する。
- **事前バンドル**: 依存ライブラリを開発サーバ起動時に ESM へまとめておく最適化。
- **Rolldown**: Rust 製のバンドラ。Vite 8 は本番ビルドに Rolldown を使う（`vite/package.json` の `dependencies` に `"rolldown": "~1.2.9"`）。

## 仕様・注意点

- **Vite 8 の変更点**: Vite 7 までは開発時に esbuild、本番ビルドに Rollup を使っていましたが、Vite 8 では **Rolldown（バンドル）と Oxc（変換）** に置き換わりました。Vite 8 の型定義（`vite/dist/node/index.d.ts`）では `esbuild` オプションが `@deprecated Use oxc option instead.`、`build.rollupOptions` が `@deprecated Use rolldownOptions instead.` となっています。古い記事の設定例をコピーするときは注意してください。
- **Node.js の要求バージョン**: Vite 8 は `"node": "^20.19.0 || >=22.12.0"`（`vite/package.json` の `engines`）。この環境の Node.js は v22.12.0 なのでギリギリ条件を満たしています。これより古いと起動しません。
- 開発サーバは**型チェックをしません**（型を削除して変換するだけ）。型エラーはエディタか `tsc -b` で確認します（[12](./12-vite-build-and-typecheck.md)）。
- 開発サーバと本番ビルドは仕組みが違うので、「dev では動くが build 後に動かない」ことがまれにあります。デプロイ前に `npm run build && npm run preview` で確認しましょう（[13](./13-vite-preview-and-dist.md)）。
- 依存を更新したのに挙動が変わらないときは、事前バンドルのキャッシュが原因のことがあります。`npx vite --force` で再生成できます。

## 今後に活かせるポイント

- 「開発時はバンドルしない、本番だけバンドルする」という設計思想を理解しておくと、Vite 以外のモダンツール（Astro, SvelteKit, Nuxt など。いずれも Vite ベース）も理解しやすい。
- バックエンドの tsx watch（プロセス再起動）と、フロントエンドの HMR（モジュール差し替え）の違いを説明できるようにしておく。

## 改善するなら

- backend の URL を直接書く代わりに、Vite の `server.proxy` で `/api` を backend に転送する方法もあります（CORS を開発時に意識しなくて済む）。ただし設計判断なので、採用するかは study/API-Design の議論と合わせて検討してください。
  ```ts
  // vite.config.ts（例）
  server: {
    proxy: { "/api": { target: "http://localhost:3000", rewrite: (p) => p.replace(/^\/api/, "") } },
  },
  ```
- ポートを固定したい場合は `server: { port: 5173, strictPort: true }` とすると、5173 が使用中のとき別ポートに逃げずにエラーになる（backend の CORS 許可オリジンとずれる事故を防げる）。

## 次に学ぶこと

- Vite の Plugin API（自作プラグイン）
- Vitest（Vite の設定・変換パイプラインをそのまま使うテストランナー）
- Vite の環境 API / SSR（サーバーサイドレンダリング）

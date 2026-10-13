# vite.config.ts と @vitejs/plugin-react

## 概要

`vite.config.ts` は Vite の設定ファイルです。`vite` コマンドは起動時にプロジェクトルートの `vite.config.ts`（または `.js` / `.mjs` など）を自動で読み込みます。

このプロジェクトの設定はとても小さく、

1. React 用プラグインを有効にする
2. tsconfig の `paths`（`@/` エイリアス）を解決する

の 2 つだけです。

## このプロジェクトでの実装

```ts
// web-app/vite.config.ts:1-10
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
});
```

### `defineConfig`

`defineConfig` は**受け取った値をそのまま返すだけ**の関数ですが、引数に型（`UserConfig`）が付いているので、

- エディタで設定項目の補完が効く
- 存在しないオプションや型の間違いをエラーにしてくれる

という利点があります。この型チェックは `tsc -b` の際に `tsconfig.node.json`（`web-app/tsconfig.node.json:22` で `vite.config.ts` を対象にしている）で行われます。

### `plugins: [react()]`（`web-app/vite.config.ts:6`）

`@vitejs/plugin-react` の README（`web-app/node_modules/@vitejs/plugin-react/README.md`）には、役割が次のように書かれています。

- 開発時に **Fast Refresh** を有効にする（React 16.9 以上が必要）
- **automatic JSX runtime** を使う

| 機能 | 説明 |
| --- | --- |
| Fast Refresh | コンポーネントを編集したとき、`useState` などの状態を保ったまま画面を更新する React 向け HMR |
| automatic JSX runtime | JSX を `react/jsx-runtime` の関数呼び出しに変換する方式。各ファイルで `import React from "react"` を書かなくてよい |

`web-app/tsconfig.app.json:20` の `"jsx": "react-jsx"` は、TypeScript 側でも同じ automatic runtime を前提に型チェックするための設定です。

バージョンは `@vitejs/plugin-react` **6.1.1**。`peerDependencies` に `"vite": "^8.0.0"` とあり、**v6 は Vite 8 専用**です。web-app の README（`web-app/README.md:7`）にもある通り、このプラグインは **Oxc**（Rust 製の JS/TS ツール群）で変換を行います。以前のバージョンのような Babel への依存はありません（`dependencies` は `@rolldown/pluginutils` のみ）。

### `resolve.tsconfigPaths: true`（`web-app/vite.config.ts:7-9`）

`tsconfig.app.json` の `paths` に書いた `@/*` エイリアスを Vite が解決できるようにする設定です。詳しくは [15](./15-resolve-tsconfig-paths.md)。

## 重要語句

- **vite.config.ts**: Vite の設定ファイル。Node.js 上で実行される。
- **defineConfig**: 型補完のためのヘルパー関数。
- **プラグイン**: Vite の処理（モジュール解決・変換・HTML 加工など）にフックして機能を追加する仕組み。
- **Fast Refresh**: React 公式の HMR 実装。
- **automatic JSX runtime**: React 17 で導入された新しい JSX 変換方式。
- **Oxc**: Rust 製の JavaScript ツールチェーン（パーサ・変換・リンター oxlint・フォーマッタなど）。

## 仕様・注意点

- `vite.config.ts` は**ブラウザではなく Node.js で実行される**ファイルです。そのため型チェックは `tsconfig.node.json`（`"types": ["node"]`）で行われます。`src/` のコードと混同しないこと。
- React 用の公式プラグインは 2 つあります（`web-app/README.md:5-8`）。
  - `@vitejs/plugin-react` … Oxc を使う（このプロジェクト）
  - `@vitejs/plugin-react-swc` … SWC を使う
- **React Compiler は有効になっていません**（`web-app/README.md:12`。開発・ビルド性能への影響のため）。plugin-react v6 では `react({ compiler: true })` で Rust 版 React Compiler を使えますが、README で **experimental（実験的）** と明記されており、別途 `oxc-transform-react` のインストールが必要です。
- 古い記事にある `react({ babel: { plugins: [...] } })` のような Babel オプションは、v6 の README には載っていません。Babel を使う場合は `@rolldown/plugin-babel` を別途組み合わせる方式に変わっています。
- Fast Refresh を正しく動かすには「ファイルからはコンポーネントだけを export する」ルールがあります（[18](./18-oxlint-react-rules-fast-refresh.md)）。

## 今後に活かせるポイント

- Vite の設定を変えるときは `defineConfig` の型補完と公式ドキュメント（https://vite.dev/config/）を頼りにする。node_modules 内の `vite/dist/node/index.d.ts` には各オプションの説明と `@default` が書かれているので、バージョン固有の挙動を確認したいときに有用。
- プラグインのメジャーバージョンは Vite 本体のメジャーと対応していることが多い。Vite を上げるときはプラグインの `peerDependencies` を確認する。

## 改善するなら

- 現状の設定はシンプルで十分です。必要に応じて以下を検討できます。
  ```ts
  export default defineConfig({
    plugins: [react()],
    resolve: { tsconfigPaths: true },
    server: { port: 5173, strictPort: true }, // backend の CORS 許可オリジンとポートを確実に一致させる
  });
  ```
- 将来 React Compiler を試すなら、まず小さなブランチで `react({ compiler: true })` を有効にし、ビルド時間とバグの有無を確認する（experimental のため）。

## 次に学ぶこと

- Vite の `server.proxy` / `define` / `envPrefix` などの設定項目
- React Compiler（自動メモ化）
- Vitest の設定を `vite.config.ts` と共有する方法

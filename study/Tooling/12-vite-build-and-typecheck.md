# vite build と型チェックの分離（tsc -b && vite build）

## 概要

web-app のビルドコマンドは 2 段構えです。

```
tsc -b  &&  vite build
  ↑            ↑
型チェック    バンドル（JS 出力）
```

Vite は TypeScript を JS に変換しますが、**型チェックは一切しません**。変換は「型注釈を取り除くだけ」なので非常に高速です。型の正しさは TypeScript 公式の `tsc` に別途確認させます。この「**変換（速さ）と型チェック（正しさ）を別ツールに分担させる**」のがモダンなフロントエンドの定番構成です。

## このプロジェクトでの実装

```json
// web-app/package.json:8
"build": "tsc -b && vite build",
```

### ステップ 1: `tsc -b`（型チェックのみ）

`-b` は `--build` の略で、**プロジェクト参照（Project References）**を使ったビルドモードです。`web-app/tsconfig.json` は自身では何もコンパイルせず、2 つの設定を参照しています。

```json
// web-app/tsconfig.json:1-7
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

| 設定ファイル | 対象 | 実行環境 |
| --- | --- | --- |
| `tsconfig.app.json` | `src/`（`web-app/tsconfig.app.json:28`） | ブラウザ |
| `tsconfig.node.json` | `vite.config.ts`（`web-app/tsconfig.node.json:22`） | Node.js |

ブラウザ用コードと Node.js 用の設定ファイルでは使える API（`document` か `process` か）が違うため、別々の設定で型チェックしています。

どちらにも `"noEmit": true`（`web-app/tsconfig.app.json:19`, `web-app/tsconfig.node.json:14`）があるので、**tsc は JS を出力しません。型チェックだけ**です。JS の出力は Vite の役目だからです。

`tsc -b` は前回の結果を `tsBuildInfoFile` に記録して、変更がなければチェックを省略します（インクリメンタルビルド）。

```json
// web-app/tsconfig.app.json:3
"tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
```

実際に `web-app/node_modules/.tmp/` に `tsconfig.app.tsbuildinfo` と `tsconfig.node.tsbuildinfo` が存在します。`node_modules` 内に置くことで、Git に入らず、`node_modules` を消せば一緒にリセットされます。

### ステップ 2: `vite build`（バンドル）

型チェックが通ったら、Vite が `index.html` を起点に全モジュールを集めて変換・結合・圧縮（minify）し、`dist/` に出力します。Vite 8 では内部で **Rolldown** がバンドルを担当します。

```
web-app/dist/
├── index.html
├── assets/
│   └── index-fdIn559j.js
└── study/        … npm run build:study がコピーした学習ノート（vite build の出力ではない）
```

（詳細は [13](./13-vite-preview-and-dist.md)）

## 重要語句

- **型チェック（type check）**: 型の整合性を検査すること。tsc の仕事。
- **トランスパイル**: TS → JS の構文変換。Vite（Oxc）の仕事。型の検査はしない。
- **`tsc -b` / `--build`**: プロジェクト参照をたどって、依存順に（必要なものだけ）ビルドするモード。
- **Project References**: tsconfig を分割し、`references` で関連付ける仕組み。
- **`noEmit`**: tsc に出力をさせず型チェックだけさせる設定。
- **minify**: 空白削除や変数名短縮で JS を小さくすること。

## 仕様・注意点

- **なぜ分けるのか**:
  - 型チェックはプロジェクト全体の型情報が必要で重い。変換は 1 ファイルずつ独立にでき、速い。
  - 開発中（`npm run dev`）に毎回型チェックすると遅くなるので、Vite は変換だけに専念する。型エラーはエディタがリアルタイムに表示してくれる。
  - その代わり、**ビルド時には必ず tsc を通す**ことで、型エラーを含んだまま本番に出ることを防ぐ。
- **1 ファイル単位の変換で困る構文**: Vite（Oxc）は他のファイルの型情報を見ずに変換するため、`const enum` のような「型情報がないと変換できない構文」は正しく扱えません。tsconfig の `verbatimModuleSyntax`（`web-app/tsconfig.app.json:17`）や `erasableSyntaxOnly`（`:25`）は、こうした問題のある書き方を tsc 側でエラーにするための設定です（詳細は study/TypeScript）。
- **`vite build` 単体では型エラーがあってもビルドが成功します。** `npx vite build` を直接実行すると型チェックが飛ばされる点に注意。
- この環境で `npx tsc -p tsconfig.app.json --noEmit` を実行したところ、エラーはありませんでした。
- **`web-app/dist/` は「最後に `npm run build` した時点」のスナップショットです。** 2026-10-12 時点の `dist/` は 19:42 にビルドされたもので、`src/` の最終更新（同日 13:44）より新しいですが、`src/` を変更したら再ビルドしない限り dist には反映されません。

## 今後に活かせるポイント

- 「ツール A は速いが型を見ない、ツール B は遅いが正確」という組み合わせは、tsx（[08](./08-tsx-dev-runtime.md)）、Vitest、esbuild、SWC などでも共通。**型チェックをどこで担保しているか**を常に意識する。
- CI では `npm run build` を実行すれば型チェックとビルドの両方を検証できる。

## 改善するなら

1. 型チェックだけを単独で走らせるスクリプトを追加する。
   ```json
   "typecheck": "tsc -b"
   ```
2. 開発中にも型エラーをターミナルに出したい場合は、別ターミナルで `npx tsc -b --watch` を動かす。または `vite-plugin-checker` を導入して、開発サーバのオーバーレイに型エラーを表示する。
3. ビルド結果のサイズを確認する習慣をつける。現在の JS は約 556KB（1 ファイル、2026-10-12 のビルド時点）で、Chakra UI と React がまとめて入っている。ページ単位のコード分割（`React.lazy` + dynamic import）で初期読み込みを減らせる（React/Routing 担当の領域と合わせて検討）。

## 次に学ぶこと

- `vite-plugin-checker`（開発サーバで型チェック・lint を並行実行）
- `rollup-plugin-visualizer` 等によるバンドルサイズ分析
- TypeScript 7（ネイティブ版 tsc）への移行による型チェック高速化

# backend の本番フロー（tsc ビルド → node dist/index.js）

## 概要

開発時は tsx で TypeScript を直接実行しますが（[08](./08-tsx-dev-runtime.md)）、本番では

1. `npm run build` … `tsc` で **型チェック + JS への変換**を行い `dist/` に出力
2. `npm start` … `node dist/index.js` で**素の Node.js** が JS を実行

という 2 段階にするのが基本です。

| | 開発（`npm run dev`） | 本番（`build` → `start`） |
| --- | --- | --- |
| 実行するもの | `src/*.ts`（その場で変換） | `dist/*.js`（事前に変換済み） |
| 使うツール | tsx（esbuild） | tsc → node |
| 型チェック | **しない** | **する**（エラーならビルド失敗） |
| ファイル監視 | あり | なし |
| 必要な依存 | devDependencies も必要 | dependencies だけで動く |

## このプロジェクトでの実装

```json
// backend/package.json:6-7
"build": "tsc",
"start": "node dist/index.js"
```

`tsc` は引数なしだとカレントディレクトリの `tsconfig.json` を読みます。ビルドフローに関係する設定は次の部分です（各オプションの詳細は study/TypeScript を参照）。

```json
// backend/tsconfig.json:4
"module": "NodeNext",
// backend/tsconfig.json:13-14
"rootDir": "./src",
"outDir": "./dist"
```

- `rootDir: ./src` → `src/` 以下を入力とみなす
- `outDir: ./dist` → 出力先。`src/index.ts` → `dist/index.js`、`src/env.ts` → `dist/env.js`
- `module: NodeNext` → Node.js の ESM としてそのまま動く JS を出力する。`"type": "module"`（`backend/package.json:3`）と組み合わさって、`import` 文がそのまま残った ESM が出力される

だから `start` は `node dist/index.js` になっている、というつながりです。

### TypeScript 7（ネイティブ版 tsc）

```json
// backend/package.json:19
"typescript": "^7.0.2"
```

`npx tsc --version` の結果は `Version 7.0.2` でした。TypeScript 7 はコンパイラが **Go で書き直されたネイティブ実装**で、`backend/node_modules/typescript/package.json` の `optionalDependencies` に `@typescript/typescript-darwin-arm64` などの OS 別バイナリが並んでいます（この Mac には `backend/node_modules/@typescript/typescript-darwin-arm64` が入っている）。使い方（`tsc` コマンド）は従来と同じですが、大幅に高速です。

一方 web-app は TypeScript 6.0.3（従来の JavaScript 実装）なので、**同じリポジトリ内で tsc の実装が違う**点に注意してください。

### 本番で起動するとき

```sh
cd backend
npm ci              # lock どおりに全依存をインストール（tsc が必要なので dev も入れる）
npm run build       # dist/ を生成
npm ci --omit=dev   # （任意）本番用に devDependencies を除いて入れ直す
npm start           # node dist/index.js
```

`backend/src/env.ts:5` の `dotenv.config()` はカレントディレクトリの `.env` を読み、`backend/src/env.ts:7-12` で `FRONTEND_URL` を検証します。本番では `.env` ファイルを置くか、ホスティング側の環境変数として `FRONTEND_URL` を設定します（dotenv は既に設定済みの環境変数を上書きしないため、ホスティング側の設定が優先されます）。

## 重要語句

- **tsc**: TypeScript 公式コンパイラ。型チェックと JS 出力の両方を行う。
- **dist**: distribution（配布物）の略。ビルド成果物の置き場として慣習的に使われる名前。
- **ビルド成果物**: ソースから生成されるファイル。生成し直せるので Git には入れない。
- **TypeScript 7 / ネイティブ版**: Go で再実装された tsc。従来版（〜6.x）より高速。

## 仕様・注意点

- **（2026-10-12 に修正済み）** 以前は `backend/.gitignore` に `dist` が入っておらず、`npm run build` すると `backend/dist/` が Git の追跡対象になってしまう状態でした。現在は `backend/.gitignore:14-15` に `# build` / `dist/` が追加され、除外されています（`git check-ignore -v backend/dist/` → `backend/.gitignore:15:dist/`）。web-app 側は `web-app/.gitignore:11` で `dist` を除外済みです。ビルド成果物はコミットしない、という考え方自体は大事なので覚えておきましょう。
- tsc は `.ts` 以外のファイル（`.json` の一部を除く）をコピーしません。将来、静的ファイルなどを置く場合は別途コピーが必要です。
- `npm start` の前に `npm run build` を忘れると `Cannot find module '.../dist/index.js'` になります。
- 古い `dist/` に削除済みファイルの JS が残ることがあります。気になる場合はビルド前に `dist` を消す（例: `"build": "rm -rf dist && tsc"`。Windows も考慮するなら `rimraf` など）。
- ポート番号は `backend/src/index.ts:89` で `3000` に固定されています。多くのホスティングサービスは `PORT` 環境変数でポートを指定するので、本番デプロイ時は対応が必要になることがあります（設計論は study/API-Design 参照）。

## 今後に活かせるポイント

- 「開発用の実行方法」と「本番用の実行方法」は別物、という感覚を持つ。開発で動いても `npm run build && npm start` で動くとは限らないので、デプロイ前に一度は本番フローで起動確認する。
- tsx と tsc の役割分担（実行の速さ vs. 型の安全性）を理解しておくと、他のプロジェクトでも応用できる。

## 改善するなら

1. `backend/.gitignore` に `dist` を追加する（**2026-10-12 に対応済み**。現在の内容は次のとおり）。
   ```gitignore
   # build
   dist/
   ```
2. 型チェックだけ行うスクリプトを追加（CI 用）。
   ```json
   "typecheck": "tsc --noEmit"
   ```
3. 単一ファイルにまとめて起動を速くしたい・デプロイを楽にしたい場合は、esbuild や tsdown でバンドルする方法もある（例: `"build": "tsc --noEmit && esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js --packages=external"`）。ただし今の規模なら tsc で十分。

## 次に学ぶこと

- Docker のマルチステージビルド（build ステージで tsc、run ステージは `--omit=dev` で軽量化）
- tsdown / esbuild による Node.js アプリのバンドル
- PM2 や systemd、各種 PaaS（Render, Fly.io, Railway など）でのプロセス管理

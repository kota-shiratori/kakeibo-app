# package.json の基本

## 概要

`package.json` は Node.js プロジェクトの「名刺 兼 設定ファイル」です。主に次の情報を書きます。

- **プロジェクトの情報**: `name`, `version`, `private` など
- **モジュール形式**: `type`（`"module"` なら ESM。詳しくは [02](./02-esm-type-module.md)）
- **コマンドの登録**: `scripts`（`npm run dev` などで実行。詳しくは [05](./05-npm-scripts.md)）
- **依存パッケージ**: `dependencies` / `devDependencies`（詳しくは [03](./03-dependencies-vs-devdependencies.md)）

`npm install` はこのファイルを読んで `node_modules/` に必要なパッケージを入れ、結果を `package-lock.json` に記録します（[06](./06-package-lock-json.md)）。

## このプロジェクトでの実装

### web-app/package.json（Vite のテンプレート由来）

```json
// web-app/package.json:1-12
{
  "name": "web-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "build:study": "npm --prefix ../study ci && STUDY_BASE=/study/ npm --prefix ../study run docs:build && rm -rf dist/study && cp -R ../study/.vitepress/dist dist/study",
    "lint": "oxlint",
    "preview": "vite preview"
  },
```

| 行 | フィールド | 意味 |
| --- | --- | --- |
| `web-app/package.json:2` | `"name": "web-app"` | パッケージ名。npm に公開する場合は一意な名前が必要 |
| `web-app/package.json:3` | `"private": true` | **npm への誤公開を防ぐ**フラグ。`npm publish` が拒否される |
| `web-app/package.json:4` | `"version": "0.0.0"` | バージョン。公開しないアプリでは実質使われない |
| `web-app/package.json:5` | `"type": "module"` | `.js` ファイルを ESM として扱う |
| `web-app/package.json:6-12` | `scripts` | `npm run <名前>` で実行するコマンド（`build:study` は後から追加された、この学習ノートを VitePress でビルドして `dist/study` にコピーするスクリプト） |

### backend/package.json（Hono のテンプレート由来）

```json
// backend/package.json:1-7
{
  "name": "backend",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/dev.ts",
    "typecheck": "tsc --noEmit"
  },
```

- 以前は `"name": "backend "` と **末尾に半角スペースが入っていました**（`package-lock.json` の `name` にもコピーされていた）。現在は `backend/package.json:2`、`backend/package-lock.json:2` / `:7` とも `"backend"` に直っています。
- `scripts` は以前の `dev` / `build` / `start`（`tsc` でビルドして `node dist/index.js` で起動）から、`dev`（`src/dev.ts`）と `typecheck` に変わりました。本番は Vercel Functions で動かすためです（[09](./09-backend-build-and-start.md)）。
- `private` と `version` がありません。公開する予定がないなら `private: true` を付けるのが安全です。

## 重要語句

- **package.json**: プロジェクトのメタ情報・依存・スクリプトを記述する JSON ファイル。
- **private**: `true` にすると `npm publish` できなくなる安全装置。
- **name / version**: npm レジストリ上でパッケージを識別する組。アプリ（公開しない）では形式的な値で良い。
- **scripts**: 任意のシェルコマンドに短い名前を付けて登録する仕組み。
- **npm レジストリ**: パッケージの配布元（https://registry.npmjs.org）。lock ファイルの `resolved` に URL が残る。

## 仕様・注意点

- JSON なので **コメントは書けません**。末尾カンマも不可（`tsconfig.json` は例外的にコメント・末尾カンマが許されますが、`package.json` は厳密な JSON です）。
- npm のパッケージ名ルールでは、名前に**前後の空白は使えません**（大文字も不可、214 文字以内など）。ローカルで `npm install` するだけなら動きますが、公開やワークスペース化の際に問題になります。
- `version` は [セマンティックバージョニング](./04-semver-caret-tilde.md) の形式（`MAJOR.MINOR.PATCH`）で書きます。
- アプリの `package.json` は 2 つ（`backend/` と `web-app/`）あり、**それぞれ独立したプロジェクト**です（このほか、学習ノートを VitePress でビルドするための `study/package.json` が後から追加されています）。ルート（`kakeibo-app/`）には `package.json` がないため、ルートで `npm install` しても依存は入らず、`package.json` が見つからないというエラー（ENOENT）になります（npm 10.9.0 で確認。空の `package-lock.json` だけが作られることもあります）。各ディレクトリに `cd` してから操作します。

## 今後に活かせるポイント

- 新しいプロジェクトを見るときは、**まず `package.json` を開く**のが鉄則。使っているフレームワーク・ビルドツール・起動方法がほぼすべてここで分かります。
- 公開しないアプリには必ず `"private": true` を付ける習慣を持つ。

## 改善するなら

1. backend に `private` を追加する（名前の末尾スペースは修正済み）。
   ```json
   {
     "name": "backend",
     "private": true,
     "version": "0.0.0",
     "type": "module",
   ```
   名前を変える場合は、変更後に `npm install` を実行して `package-lock.json` 側の `name` も更新させる。
2. 両方に `engines` を書いて、想定する Node.js のバージョンを明示する（Vite 8 の要求は `^20.19.0 || >=22.12.0`。`web-app/node_modules/vite/package.json` の `engines` で確認できる）。
   ```json
   "engines": { "node": ">=22.12.0" }
   ```
3. `description` を書いておくと、あとで見返したときに用途が分かりやすい。

## 次に学ぶこと

- `packageManager` フィールドと Corepack（使うパッケージマネージャとそのバージョンを固定する仕組み）
- `exports` / `main` / `bin` フィールド（ライブラリを作る側になったときに必要）
- npm workspaces / pnpm workspace（複数の package.json を 1 リポジトリで管理する）

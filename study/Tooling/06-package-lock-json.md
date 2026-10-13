# package-lock.json の役割

## 概要

`package.json` には「`^8.3.0`（8.x ならどれでもよい）」のような**範囲**しか書かれていません。そのままでは、インストールした日によって入るバージョンが変わってしまいます。

`package-lock.json` は、**実際にインストールした全パッケージ（間接依存も含む）の正確なバージョン・取得元・ハッシュ**を記録したファイルです。これをコミットしておけば、誰がいつインストールしても同じ `node_modules` が再現されます。

| ファイル | 書く人 | 内容 |
| --- | --- | --- |
| `package.json` | 人間 | 直接依存と許容範囲 |
| `package-lock.json` | npm が自動生成 | 依存ツリー全体の確定バージョン |

## このプロジェクトでの実装

backend・web-app それぞれに lock ファイルがあります。

```json
// backend/package-lock.json:1-8
{
  "name": "backend ",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "backend ",
      "dependencies": {
```

- `lockfileVersion: 3` は npm 9 以降が使う形式（npm 7 以降なら読める。この環境の npm は 10.9.0）。
- `packages[""]` がプロジェクト自身。`package.json` の内容（名前の末尾スペースも含めて）がコピーされています。

個々のパッケージはこう記録されます。

```json
// backend/package-lock.json:866-878
"node_modules/esbuild": {
  "version": "0.28.2",
  "resolved": "https://registry.npmjs.org/esbuild/-/esbuild-0.28.2.tgz",
  "integrity": "sha512-HKVL...",
  "dev": true,
  "hasInstallScript": true,
  "license": "MIT",
  "bin": { "esbuild": "bin/esbuild" },
  "engines": { "node": ">=18" }
```

| キー | 意味 |
| --- | --- |
| `version` | 確定したバージョン |
| `resolved` | ダウンロード元 URL |
| `integrity` | ファイルのハッシュ。改ざん・破損を検出する |
| `dev: true` | devDependencies 経由でのみ必要（`--omit=dev` で除外される） |
| `hasInstallScript: true` | インストール時にスクリプト（postinstall 等）を実行するパッケージ |

`esbuild` は `package.json` に直接書かれていませんが、`tsx` の依存（`tsx` の `package.json` に `"esbuild": "~0.28.0"`）として入っています。lock には**間接依存まですべて**載るのがポイントです。`hasInstallScript` が付いていることは [07](./07-npm-vs-pnpm-build-scripts.md) の pnpm の話につながります。

web-app の lock は約 115KB（`web-app/package-lock.json`）と大きく、Chakra UI などの間接依存が多いことが分かります。

## 重要語句

- **lock ファイル**: 依存ツリーを確定させるファイル。npm は `package-lock.json`、pnpm は `pnpm-lock.yaml`、Yarn は `yarn.lock`、Bun は `bun.lock`。
- **間接依存（transitive dependency）**: 自分が入れたパッケージがさらに依存しているパッケージ。
- **integrity（SRI ハッシュ）**: ダウンロードしたファイルが記録と一致するか検証するハッシュ値。
- **`npm ci`**: lock ファイルどおりに**厳密に**インストールするコマンド。

## 仕様・注意点

- **lock ファイルはコミットする**のが原則です（アプリの場合）。`.gitignore` に入れてはいけません。現在どちらの `.gitignore` にも入っていないので正しい状態です。
- `npm install` と `npm ci` の違い:
  - `npm install`: package.json と lock が食い違えば lock を**更新する**ことがある。
  - `npm ci`: lock と食い違えば**エラーで止まる**。`node_modules` を一度削除してから入れ直す。CI や本番ビルドではこちらを使う。
- lock ファイルは手で編集しない。コンフリクトしたら、package.json のコンフリクトを解消してから `npm install` で再生成するのが安全。
- **パッケージマネージャごとに lock の形式が違う**ので、混在させると「どちらが正なのか」が曖昧になります（[07](./07-npm-vs-pnpm-build-scripts.md)）。

## 今後に活かせるポイント

- 「自分の環境では動く」問題の多くは依存バージョンの差で起きる。lock をコミットし、CI では `npm ci` を使えば防げる。
- 依存の脆弱性チェック（`npm audit`）も lock ファイルを元に行われる。

## 改善するなら

- CI を作るなら `npm ci` を使う。
  ```yaml
  # .github/workflows/ci.yml（例）
  - run: npm ci
    working-directory: web-app
  - run: npm run lint && npm run build
    working-directory: web-app
  ```
- backend の `name` を直したら（[01](./01-package-json-basics.md) 参照）、`npm install` で lock の `name` も更新してから一緒にコミットする。

## 次に学ぶこと

- `npm audit` と脆弱性対応
- `pnpm-lock.yaml` の構造と、pnpm のコンテンツアドレス型ストア
- Renovate の lock ファイルメンテナンス機能（lockFileMaintenance）

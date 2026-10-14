# tsx と tsx watch（開発時に TypeScript を直接実行する）

## 概要

Node.js は（基本的には）JavaScript しか実行できません。TypeScript を動かすには、普通は `tsc` で JS に変換してから `node` で実行します。しかし開発中に毎回ビルドするのは面倒です。

**tsx**（TypeScript Execute）は、`.ts` ファイルを**その場で JS に変換しながら Node.js で実行する**ツールです。`tsx` の `--help` には次のように書かれています。

> Node.js runtime enhanced with esbuild for loading TypeScript & ESM

つまり中身は「Node.js + esbuild による変換フック」です。

`tsx watch` はさらに、**ファイルを保存するたびにプロセスを自動で再起動**します。

## このプロジェクトでの実装

```json
// backend/package.json:5
"dev": "tsx watch src/dev.ts",
// backend/package.json:20
"tsx": "^4.23.0",
```

エントリは `src/index.ts` ではなく **`src/dev.ts`** です（コミット `2a1609f` で分離）。

```ts
// backend/src/dev.ts:1-8
// ローカル開発用のエントリ。Vercel では src/index.ts の app が直接使われる
import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./index.js";

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
```

- `src/index.ts` は `app` を `export default` するだけ（`backend/src/index.ts:108`）で、サーバを起動しない。本番の Vercel Functions はこの `app` を直接使う（[09](./09-backend-build-and-start.md)）。
- ローカルでは `dev.ts` が `.env` を読み込み、`@hono/node-server` の `serve` でポート 3000 に立てる。

`npm run dev` を実行すると:

1. `tsx` が Node.js を起動し、`.ts` を読み込むフックを登録する。
2. `src/dev.ts` を esbuild で JS に変換して実行 → `dotenv/config` が `.env` を読み、`./index.js`（実体は `index.ts`）→ `./env.js`（`env.ts`）の順に読み込まれ、Hono サーバがポート 3000 で起動（`backend/src/dev.ts:6-8`）。
3. `dev.ts` と、そこから import でつながる `index.ts` / `env.ts` を監視する。
4. 保存されたらプロセスを終了 → 再起動（デフォルトで画面もクリア）。

起動には環境変数 `FRONTEND_URL` と `DATABASE_URL` が必要で、どちらかが欠けると `env.ts` の検証で起動時に止まります（[20](./20-local-dev-workflow.md)、`../Docker/08-connecting-backend-to-local-db.md`）。

インストールされているのは tsx 4.23.15、内部の esbuild は 0.28.2 です（それぞれの `node_modules/*/package.json` で確認）。

### `./env.js` と書いても `env.ts` が読まれる

```ts
// backend/src/index.ts:5
import { env } from "./env.js";
// backend/src/dev.ts:4
import app from "./index.js";
```

ファイルは `src/env.ts` / `src/index.ts` しかありませんが、tsx は `.js` の import で見つからない場合に `.ts` を探してくれます。これにより「JS に変換した後」と「tsx で直接実行」の両方で同じ import 文が使えます（[02](./02-esm-type-module.md) 参照）。

### watch のオプション（`npx tsx watch --help` より）

| フラグ | 意味 |
| --- | --- |
| `--clear-screen` | 再実行時に画面をクリア（デフォルト true。`--clear-screen=false` で無効） |
| `--include <glob>` | 追加で監視するパス |
| `--exclude <glob>` | 監視から除外するパス |
| `--tsconfig <path>` | 使う tsconfig を指定 |

## 重要語句

- **tsx**: esbuild を使って TypeScript を Node.js 上で直接実行するツール。
- **esbuild**: Go 製の超高速なバンドラ / トランスパイラ。
- **トランスパイル**: ある言語のソースを別の（同等の）言語のソースへ変換すること。TS → JS など。
- **ウォッチモード**: ファイル変更を検知して処理を再実行するモード。
- **ホットリロード（再起動型）**: tsx watch は「プロセスごと再起動」する方式。フロントエンドの HMR（[10](./10-vite-dev-server.md)）のように状態を保ったまま差し替えるわけではない。

## 仕様・注意点

- **tsx は型チェックをしません。** esbuild は型注釈を「削除」して JS にするだけです。型エラーがあっても `npm run dev` は普通に動きます。型エラーは `npm run typecheck`（`tsc --noEmit`）やエディタで確認する必要があります。実際、この環境で `npm run typecheck` を実行すると backend はエラーなしでした（2026-10-14、TypeScript 6.0.3）。
- **再起動なのでメモリ上のデータは消えます。** 取引データは PostgreSQL に保存しているので再起動しても残りますが、`pg` の `Pool`（接続）はプロセスごと作り直されます。
- 監視対象は**import でつながっているファイル**が中心です。`backend/src/dev.ts:2` の `import "dotenv/config"` が `fs` で読み込む `.env` は import されていないため、`.env` を書き換えても自動再起動しない可能性があります。その場合は手動で再起動（Ctrl+C → `npm run dev`）するか、`--include .env` を付けます。
- `dotenv/config` は**カレントディレクトリ**の `.env` を読みます。必ず `backend/` ディレクトリで `npm run dev` を実行してください。
- tsx は本番実行用ではありません（起動時に毎回変換するコストがあり、devDependencies に入っている）。本番は Vercel Functions で動きます（[09](./09-backend-build-and-start.md)）。

## 今後に活かせるポイント

- 「**開発は速さ優先（型チェックなしで即実行）、型チェックは別ルートで**」という分離は、tsx だけでなく Vite（[12](./12-vite-build-and-typecheck.md)）でも同じ考え方。モダンなツールの共通パターンとして覚えておくと理解が早い。
- ちょっとしたスクリプト（データ投入、マイグレーションなど）も `npx tsx scripts/seed.ts` のように実行できる。

## 改善するなら

- 開発中も型チェックを並行して走らせたい場合、`tsc --watch --noEmit` を別ターミナルで動かす、またはスクリプトにする。
  ```json
  "typecheck": "tsc --noEmit",
  "typecheck:watch": "tsc --noEmit --watch"
  ```
  （`typecheck` は追加済み。`typecheck:watch` は未追加）
- `.env` 変更でも再起動したいなら:
  ```json
  "dev": "tsx watch --include .env src/dev.ts"
  ```
- Node.js の組み込み機能に寄せる選択肢もある: Node 22.6 以降には型注釈を取り除いて実行する機能（`--experimental-strip-types`、新しい版ではデフォルト有効）と `node --watch` がある。ただし enum など型注釈以外の TS 構文の扱いや `.js`→`.ts` の読み替えは tsx と挙動が異なるので、移行時は要検証。

## 次に学ぶこと

- `node --watch` と Node.js の TypeScript 型ストリップ機能
- nodemon（汎用の再起動ツール）
- Vitest（tsx と同じく型チェックなしで TS テストを高速に実行するテストランナー）

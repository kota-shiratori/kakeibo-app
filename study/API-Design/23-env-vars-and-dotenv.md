# 環境変数と dotenv による .env の読み込み

## 概要

**環境変数** は、プログラムの外から設定値を渡す仕組みです。OS のプロセスごとに「名前 = 値」の組を持っていて、Node.js では `process.env.名前` で読めます（値は常に **文字列** か `undefined`）。

設定を環境変数で渡す理由:

- **環境ごとに値を変えられる**: 開発・ステージング・本番で、接続先 URL や DB を切り替えられる。
- **秘密情報をコードに書かない**: API キーやパスワードを Git に入れずに済む。
- これは「The Twelve-Factor App」の「設定は環境変数に格納する」という考え方に基づいています（dotenv の README でも言及されています）。

ただ、毎回ターミナルで `export FRONTEND_URL=...` するのは面倒です。そこで、`.env` ファイルに書いておき、起動時に `process.env` に読み込むのが **dotenv** というライブラリです。

```
# .env の書式（例。実際の値とは関係ありません）
KEY=value
```

## このプロジェクトでの実装

`.env` を読み込むのは、**ローカル開発用のエントリ `backend/src/dev.ts` だけ** です。

`backend/src/dev.ts:1-4`

```ts
// ローカル開発用のエントリ。Vercel では src/index.ts の app が直接使われる
import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./index.js";
```

- `import "dotenv/config"` は「読み込むだけで `dotenv.config()` が実行される」副作用 import です。中身は `dotenv.config({ quiet: true })` を呼ぶだけ（`backend/node_modules/dotenv/dist/config.cjs`）で、既定では読み込み時のログを出しません。
- ES モジュールの import は **書いた順に評価** されるので、`dotenv/config` → `./index.js`（その中で `./env.js`）の順に実行されます。つまり `createEnv`（→ `24-t3-env-createenv.md`）が `process.env` を検証する時点で、`.env` の値はすでに入っています。順番が大事で、`dotenv/config` を `./index.js` より後に書くと、検証の時点で値がまだ入っていません。
- `npm run dev`（`tsx watch src/dev.ts`）でこの経路が使われます。

本番（Vercel Functions）では `dev.ts` を通らず、`backend/src/index.ts` の `export default app` が直接使われます。そのため **本番では `.env` を読みません**。環境変数は Vercel のプロジェクト設定（Environment Variables）に登録した値が `process.env` に入ります。`env.ts` 側は dotenv を知らず、「`process.env` に値が入っている」ことだけを前提にしています。

`backend/src/env.ts:4-10`

```ts
export const env = createEnv({
  server: {
    FRONTEND_URL: z.string(),
    DATABASE_URL: z.string(),
  },
  runtimeEnv: process.env,
});
```

使っている環境変数は 2 つです。

| 名前 | 用途 | 使っている場所 |
| --- | --- | --- |
| `FRONTEND_URL` | CORS の許可オリジン | `backend/src/index.ts:15` |
| `DATABASE_URL` | PostgreSQL の接続文字列 | `backend/src/index.ts:7`（→ `../Docker/08-connecting-backend-to-local-db.md`） |

**注意（2026-10-14 時点）**: ローカルの `backend/.env` には `FRONTEND_URL` しか書かれておらず、`DATABASE_URL` がありません（キー名だけ確認）。この状態では `env.ts` の検証で起動が止まります（→ `24-t3-env-createenv.md`）。

`.env` は Git の管理対象外になっています。

`backend/.gitignore:17-19`

```
# env
.env
.env.production
```

## 重要語句

- **環境変数**: プロセスに渡される「名前 = 値」の設定。
- **`process.env`**: Node.js で環境変数を読むオブジェクト。値はすべて文字列。
- **`.env` ファイル**: 環境変数を書いておくテキストファイル。
- **dotenv**: `.env` を読み込んで `process.env` に入れるライブラリ（このプロジェクトは v18.0.7）。
- **副作用 import**: `import "dotenv/config";` のように、値を受け取らずに「読み込むこと自体」で処理を実行させる import。

## 仕様・注意点

dotenv の仕様（`backend/node_modules/dotenv/dist/index.d.ts`・`dist/index.cjs` と README で確認）:

- **読み込む場所は既定で `path.resolve(process.cwd(), '.env')`**。つまり「ファイルの場所」ではなく **コマンドを実行したディレクトリ（カレントディレクトリ）** 基準です。`backend/` で `npm run dev` すれば `backend/.env` が読まれますが、リポジトリのルートから `backend/src/dev.ts` を起動すると `.env` が見つからず、`createEnv` の検証で `FRONTEND_URL` と `DATABASE_URL` がどちらも `undefined` と報告されて止まりました（実験で確認）。`path` オプションで場所を指定できます。
- **既にある環境変数は上書きしない**（`override` の既定値は `false`）。OS やシェル、デプロイ先で設定された値が `.env` より優先されます。本番では `.env` を置かずにプラットフォームの環境変数を使う、という運用と相性が良い仕様です。
- `config()` の戻り値は `{ parsed?, error? }`。`.env` が無くても **例外は投げず**、`error` に入るだけです。`import "dotenv/config"` では戻り値を受け取れませんが、その後の `createEnv` が必須チェックをするので、`.env` が無ければそこでエラーになります。
- `quiet` オプションで読み込み時のログ出力を抑制できます。`dotenv.config()` を直接呼ぶ場合の既定は `false`（ログを出す）ですが、`dotenv/config` 経由では `quiet: true` が渡されます（`DOTENV_QUIET` / `DOTENV_CONFIG_QUIET` 環境変数で変更可）。
- dotenv は CommonJS パッケージです。`package.json` の `exports` で `"./config"` が `dist/config.cjs` に対応付けられているので、`import "dotenv/config"` と書けます。
- `.env` に書いた値は **すべて文字列** です。`PORT=3000` も `"3000"` です。数値や真偽値として使うなら変換と検証が必要です（→ `25-zod-env-schema.md`）。

## 今後に活かせるポイント

- **`.env.example` を用意する習慣** をつけましょう。キー名だけ（値は空かダミー）を書いて Git に入れておくと、新しく参加した人がどの環境変数が必要か分かります。
- Node.js 自体にも `.env` を読む機能があります（`node --env-file=.env` オプション、`process.loadEnvFile()` 関数）。このプロジェクトの Node.js（v22.12.0）と `@types/node`（26.6.5）にも `loadEnvFile` が定義されています（`backend/node_modules/@types/node/process.d.ts:1674`）。依存を減らしたい場合の選択肢です。

## 改善するなら

### `.env.example` を追加する

```
# backend/.env.example
# フロントエンドのオリジン（末尾スラッシュなし）
FRONTEND_URL=http://localhost:5173
# PostgreSQL の接続文字列（ローカルの Docker の例。パスワードは各自のもの）
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/kakeibo_db
```

### 読み込み場所をファイル基準にする

```ts
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// src/load-env.ts（例）: このファイルがある src/ の 1 つ上の階層、つまり backend/.env を読む
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
```

ただし、これを `dev.ts` の本文に直接書いてはいけません。ES モジュールの `import` は本文より先にすべて評価されるので、`import app from "./index.js"` →（`env.ts` の検証）が `dotenv.config()` より先に実行され、検証で止まります（実験で確認）。`src/load-env.ts` のような別ファイルに書き、`dev.ts` の先頭で `import "./load-env.js";` と副作用 import するのが安全です（`tsx` / `tsc` はファイルの場所を変えないので、`src/load-env.ts` からの `"../.env"` も `backend/.env` を指します）。

### Node.js 標準機能に置き換える

```jsonc
// backend/package.json の scripts（Tooling の範囲なので参考）
"dev": "tsx watch --env-file=.env src/dev.ts"
```

`tsx` は Node.js の `--env-file` オプションを受け付けます（`npx tsx --env-file=.env -e '...'` で `process.env.FRONTEND_URL` が読めることを確認）。この場合 `dev.ts` の `import "dotenv/config"` と `dotenv` パッケージは不要になります。

## 次に学ぶこと

- シークレット管理サービス（AWS Secrets Manager、Doppler、dotenvx の暗号化 .env など）
- 環境ごとの `.env.development` / `.env.production` の使い分け

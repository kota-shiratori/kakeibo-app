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

`backend/src/env.ts:1-5`

```ts
import { createEnv } from "@t3-oss/env-core";
import z from "zod";
import dotenv from "dotenv";

dotenv.config();
```

- `dotenv.config()` が、`.env` ファイルを読んで中身を `process.env` に書き込みます。
- その直後に `createEnv`（→ `24-t3-env-createenv.md`）が `process.env` を検証します。順番が大事で、`config()` より前に検証すると値がまだ入っていません。

`backend/src/index.ts:4` で `import { env } from "./env.js";` しているので、サーバー起動時（モジュール読み込み時）にこの処理が走ります。

使っている環境変数は `FRONTEND_URL`（CORS の許可オリジン、`backend/src/index.ts:11`）の 1 つだけです。

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

## 仕様・注意点

dotenv の仕様（`backend/node_modules/dotenv/dist/index.d.ts` と README で確認）:

- **読み込む場所は既定で `path.resolve(process.cwd(), '.env')`**。つまり「ファイルの場所」ではなく **コマンドを実行したディレクトリ（カレントディレクトリ）** 基準です。`backend/` で `npm run dev` すれば `backend/.env` が読まれますが、リポジトリのルートから `node backend/dist/index.js` のように起動すると `.env` が見つかりません。`path` オプションで場所を指定できます。
- **既にある環境変数は上書きしない**（`override` の既定値は `false`）。OS やシェル、デプロイ先で設定された値が `.env` より優先されます。本番では `.env` を置かずにプラットフォームの環境変数を使う、という運用と相性が良い仕様です。
- 戻り値は `{ parsed?, error? }`。`.env` が無くても **例外は投げず**、`error` に入るだけです。このプロジェクトは戻り値を見ていませんが、直後の `createEnv` が必須チェックをするので、`.env` が無ければそこでエラーになります。
- `quiet` オプション（既定 `false`）で、読み込み時のログ出力を抑制できます。
- dotenv は CommonJS パッケージで、型定義（`dist/index.d.ts`）には `export function config(...)` が定義されています。ESM から `import dotenv from "dotenv"` とすると Node.js の CommonJS 相互運用により `module.exports` 全体を受け取り、`dotenv.config()` が呼べます。
- `.env` に書いた値は **すべて文字列** です。`PORT=3000` も `"3000"` です。数値や真偽値として使うなら変換と検証が必要です（→ `25-zod-env-schema.md`）。

## 今後に活かせるポイント

- **`.env.example` を用意する習慣** をつけましょう。キー名だけ（値は空かダミー）を書いて Git に入れておくと、新しく参加した人がどの環境変数が必要か分かります。
- Node.js 自体にも `.env` を読む機能があります（`node --env-file=.env` オプション、`process.loadEnvFile()` 関数）。このプロジェクトの Node.js（v22）と `@types/node` にも `loadEnvFile` が定義されています（`backend/node_modules/@types/node/process.d.ts:1674`）。依存を減らしたい場合の選択肢です。

## 改善するなら

### `.env.example` を追加する

```
# backend/.env.example
# フロントエンドのオリジン（末尾スラッシュなし）
FRONTEND_URL=
```

### 読み込み場所をファイル基準にする

```ts
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// env.ts（ビルド後は dist/env.js）の 1 つ上の階層にある .env を読む
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
```

### Node.js 標準機能に置き換える

```jsonc
// backend/package.json の scripts（Tooling の範囲なので参考）
"start": "node --env-file=.env dist/index.js"
```

## 次に学ぶこと

- シークレット管理サービス（AWS Secrets Manager、Doppler、dotenvx の暗号化 .env など）
- 環境ごとの `.env.development` / `.env.production` の使い分け

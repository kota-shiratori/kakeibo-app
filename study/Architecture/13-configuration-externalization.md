# 設定の外部化 — 環境変数で URL を切り替える

## 概要

「API サーバーの URL」「CORS で許可するフロントの URL」「DB の接続先」は、開発環境・本番環境で値が変わります。これらをコードに直接書かず、**環境変数（`.env` ファイル）として外に出す** のが設定の外部化です。

同じコードを、設定だけ変えて別の環境で動かせる —— これはデプロイ可能なアプリを作るうえでの基本原則です（The Twelve-Factor App の「III. 設定」）。

## このプロジェクトでの実装

### 3 つの環境変数

| キー | どこで使う | 意味 |
|---|---|---|
| `FRONTEND_URL` | `backend/.env` → `backend/src/env.ts:6` → `backend/src/index.ts:15` | CORS で許可するオリジン（フロントの URL） |
| `DATABASE_URL` | `backend/.env` → `backend/src/env.ts:7` → `backend/src/index.ts:7` | PostgreSQL の接続文字列（ローカルは Docker、本番は Neon）。**パスワードを含む秘密情報** |
| `VITE_API_BASE_URL` | `web-app/.env` → 各フックの `:3` | フロントが呼び出す API のベース URL |

本番（Vercel）では `.env` ファイルではなく、Vercel のプロジェクト設定の Environment Variables に同じキーを登録します（設定状況はこのノートでは未確認）。

`FRONTEND_URL` と `VITE_API_BASE_URL` は **お互いを指し合う** 関係です。`DATABASE_URL` は backend だけが知っていて、フロントには一切出てきません。

```mermaid
flowchart LR
  subgraph web-app
    FE["SPA"]
    E1["VITE_API_BASE_URL<br/>= API の場所"]
  end
  subgraph backend
    BE["Hono"]
    E2["FRONTEND_URL<br/>= 許可するフロントの場所"]
    E3["DATABASE_URL<br/>= DB の場所と認証情報"]
  end
  DB[("PostgreSQL")]
  E1 -. 参照 .-> BE
  E2 -. 参照 .-> FE
  E3 -. 参照 .-> DB
  FE -- fetch --> BE
  BE -- SQL --> DB
```

### バックエンド: 起動時に検証する

```ts
// backend/src/env.ts:1-10
import { createEnv } from "@t3-oss/env-core";
import z from "zod";

export const env = createEnv({
  server: {
    FRONTEND_URL: z.string(),          // 文字列であることを要求
    DATABASE_URL: z.string(),
  },
  runtimeEnv: process.env,
});
```

```ts
// backend/src/dev.ts:2（ローカル起動時だけ）
import "dotenv/config";                // .env を process.env に読み込む
```

```ts
// backend/src/index.ts:7, 14-15
const pool = new Pool({ connectionString: env.DATABASE_URL });
...
  cors({
    origin: [env.FRONTEND_URL],
```

以前のノートでは `env.ts` の中で `dotenv.config()` を呼ぶ形を扱っていましたが（初回コミット `068b29e` の時点で既にその呼び出しはなく、`.env` を読むコードはどこにもありませんでした）、今は **ローカル用のエントリ `dev.ts` だけ** が `.env` を読み込みます（コミット `2a1609f` で追加）。本番（Vercel）では `.env` ファイルを使わず、プラットフォームが `process.env` に値を入れてくれるからです。`env.ts` は「どこから値が来たか」を気にせず、`process.env` を検証するだけになりました。

`process.env.FRONTEND_URL` を直接使わず、**検証済みの `env` オブジェクト経由** で使うのがポイントです。設定が欠けていればサーバー起動時にエラーで止まるので、「動いているように見えて CORS だけ失敗する」「最初の SQL で初めて接続エラーになる」といった分かりにくい不具合を防げます（ライブラリの詳細は API-Design / Tooling フォルダ参照）。

実際、2026-10-14 時点のローカルの `backend/.env` には `FRONTEND_URL` しかなく、`env.ts` を読み込むと `Invalid environment variables`（`DATABASE_URL` が `undefined`）で止まることを確認しています（`../Docker/08-connecting-backend-to-local-db.md`）。

### フロントエンド: ビルド時に埋め込まれる

```ts
// web-app/src/hooks/useIncomeTransactions.ts:3（他の 2 フックも同じ）
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
```

Vite は `VITE_` で始まる変数だけをクライアントのコードに公開し、ビルド時に値を **埋め込み** ます（Tooling フォルダ参照）。

## 重要語句

- **環境変数**: OS やプロセスに渡される key=value の設定値。
- **`.env` ファイル**: 環境変数をファイルで定義する慣習。dotenv や Vite が読み込む。
- **設定の外部化**: 環境ごとに変わる値をコードの外に出すこと。
- **The Twelve-Factor App**: クラウド時代のアプリ設計の 12 原則。「設定は環境変数に格納する」を含む。
- **フェイルファスト（fail fast）**: 問題があれば早い段階（起動時）ではっきり失敗させる設計。
- **ビルド時変数 / 実行時変数**: フロントの `VITE_*` はビルド時に固定、バックエンドの `process.env` は起動時に読まれる。

## 仕様・注意点

- **フロントの環境変数は秘密にできない**: `VITE_` 変数はビルド後の JS に文字列として含まれ、誰でも見られます。API キーなどの秘密情報を入れてはいけません。URL は公開されても問題ない値です。
- **フロントの値は起動時ではなくビルド時に決まる**: 本番の API URL を変えるには再ビルドが必要です。
- **フロント側には検証がない**: `VITE_API_BASE_URL` が未設定だと `BASE_URL` は `undefined` になり、`fetch("undefined/transactions?...")` という **相対 URL** へのリクエストになって失敗します。エラーメッセージからは原因が分かりにくいです。
- **型の補完**: `import.meta.env.VITE_API_BASE_URL` の型は `vite/client` の既定の型定義（`tsconfig.app.json:7`）によるもので、このプロジェクトでは `vite-env.d.ts` 等で独自に型付けしていません（TypeScript / Tooling フォルダ参照）。
- **バックエンドの検証は「文字列であること」だけ**: `z.string()` は空文字も通します。`z.url()` にすると URL 形式も保証できます（`DATABASE_URL` の `postgresql://...` も URL として検証できる）。
- **`DATABASE_URL` は秘密情報**: パスワードを含むので、`.env`（Git 管理外）と Vercel の環境変数にだけ置き、コードやログ、`VITE_` 変数には絶対に入れません。ローカル用（Docker）と本番用（Neon）は別の値・別のパスワードにします。
- **ポート番号はハードコード**: ローカル起動の `port: 3000`（`backend/src/dev.ts:6`）は環境変数化されていません。本番は Vercel Functions が `app` を直接呼び出すため、ポートを自分で待ち受けることはなく、このハードコードは本番には影響しません（`PORT` で待ち受ける形式のホスティングに移すなら外部化が必要）。
- **`.env` の扱い**: 当初は `backend/.gitignore` でしか `.env` を除外していませんでしたが、2026-10-12 に修正済みで、現在は `backend/.gitignore:18` と `web-app/.gitignore:16` の両方で除外されています。チームで共有するなら値の入っていない `.env.example` をコミットし、実際の `.env` は各自で作る運用が一般的です。

## 今後に活かせるポイント

- 環境ごとに変わる値（URL、ポート、DB 接続文字列、API キー）は最初から環境変数にする。このプロジェクトでも DB を足すときに `DATABASE_URL` を 1 つ追加するだけで、ローカル（Docker）と本番（Neon）を切り替えられた。
- 環境変数は **アプリの入口で 1 回だけ読み、検証し、型付きのオブジェクトとして配る**（このプロジェクトの `env.ts` の形）。コードのあちこちで `process.env.XXX` を直接読まない。
- フロントとバックで「秘密にできる / できない」の違いを常に意識する。

## 改善するなら

### フロントにも env モジュールを作る

```ts
// web-app/src/env.ts（案）
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
if (!apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL が設定されていません。web-app/.env を確認してください。");
}
export const env = { apiBaseUrl } as const;
```

各フックの `const BASE_URL = import.meta.env.VITE_API_BASE_URL;` を `env.apiBaseUrl` に置き換えれば、読み込み箇所が 1 つになります（`@t3-oss/env-core` の `client` / `clientPrefix` オプションを使う方法もある）。

### バックエンドの検証を強化しポートも外部化

```ts
// backend/src/env.ts（案）
export const env = createEnv({
  server: {
    FRONTEND_URL: z.url(),
    DATABASE_URL: z.url(),
    PORT: z.coerce.number().default(3000), // dev.ts の serve で使う
  },
  runtimeEnv: process.env,
});
```

### サンプルファイルを用意

```text
backend/.env.example     FRONTEND_URL=http://localhost:5173
                         DATABASE_URL=postgresql://postgres:<password>@localhost:5432/kakeibo_db
web-app/.env.example     VITE_API_BASE_URL=http://localhost:3000
```

## 次に学ぶこと

- **The Twelve-Factor App**（特に III. Config）。
- **Vite のモードと `.env.[mode]`**（`.env.development` / `.env.production`）による環境別設定（Tooling フォルダ参照）。
- **シークレット管理**: 本番ではホスティングサービスの環境変数設定や Secret Manager を使う。

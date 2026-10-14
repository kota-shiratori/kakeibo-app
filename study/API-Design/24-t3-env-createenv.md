# @t3-oss/env-core の createEnv: 起動時に環境変数を型安全に検証する

## 概要

`process.env` には 2 つの弱点があります。

1. **型が緩い**: `process.env.FRONTEND_URL` の型は `string | undefined`。存在するかどうか、正しい形式かどうかは分からない。
2. **間違いに気づくのが遅い**: 環境変数を設定し忘れても、サーバーは普通に起動し、**その値を使う処理が動いたときに初めて** おかしな挙動になる（今回なら CORS エラーや、最初のクエリでの DB 接続エラー）。

`@t3-oss/env-core`（t3-env）の `createEnv` は、環境変数のスキーマ（期待する形）を宣言し、**アプリの起動時にまとめて検証** します。不正なら起動の時点でエラーにして止まり、正しければ **型付きの `env` オブジェクト** を返します。

> 「壊れた設定のまま動き続ける」より「起動時にすぐ落ちる」方が、原因が分かりやすく安全です（フェイルファスト）。

## このプロジェクトでの実装

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

| オプション | 意味 |
| --- | --- |
| `server` | サーバー側だけで使う環境変数のスキーマ。キーが環境変数名、値が Zod スキーマ |
| `runtimeEnv` | 検証する値の取得元。ここでは `process.env`。ローカルでは `backend/src/dev.ts` の `import "dotenv/config"` が先に `.env` を読み込んでおり、本番（Vercel）では Vercel に登録した環境変数が入っている（→ `23-env-vars-and-dotenv.md`） |

使う側: `backend/src/index.ts:5`, `:7`, `:15`

```ts
import { env } from "./env.js";

const pool = new Pool({ connectionString: env.DATABASE_URL });
// ...
origin: [env.FRONTEND_URL],
```

`env.FRONTEND_URL` / `env.DATABASE_URL` の型は `string`（`undefined` を含まない）になります。検証を通過していることが保証されているからです。

### createEnv の内部動作（ソースで確認）

`backend/node_modules/@t3-oss/env-core/dist/index.js` を読むと、次の順で処理しています。

1. `runtimeEnv`（無ければ `process.env`）を取得。
2. `emptyStringAsUndefined: true` なら空文字の値を削除。
3. `skipValidation: true` なら検証せずにそのまま返す。
4. `server` / `client` / `shared` のスキーマで値を 1 つずつ検証（Standard Schema の `~standard.validate` を使う。`backend/node_modules/@t3-oss/env-core/dist/standard.js`）。**非同期の検証は不可**（Promise が返るとエラー）。
5. 問題があれば `onValidationError` を呼ぶ。既定では `console.error("❌ Invalid environment variables:", issues)` を出して `throw new Error("Invalid environment variables")`。
6. 成功したら、**スキーマに書いたキーだけ** を持つオブジェクトを `Proxy` で包んで返す。クライアント側からサーバー用の変数にアクセスするとエラーにする仕掛けが入っている。

つまり、`FRONTEND_URL` や `DATABASE_URL` が未設定なら、`env.ts` が読み込まれた瞬間（サーバー起動直後）に例外が出て、サーバーは起動しません。

実際、2026-10-14 時点の `backend/.env` には `DATABASE_URL` が書かれていないため、`dotenv/config` を読み込んでから `env.ts` を import すると次のエラーで止まりました（実験で確認）。

```text
❌ Invalid environment variables: [
  {
    expected: 'string',
    code: 'invalid_type',
    path: [ 'DATABASE_URL' ],
    message: 'Invalid input: expected string, received undefined'
  }
]
（throw された Error のメッセージ: Invalid environment variables）
```

`backend/.env` に `DATABASE_URL` を追加する必要があります（形式は `../Docker/08-connecting-backend-to-local-db.md`）。もし検証がなければ、サーバーは起動し、最初のリクエストで DB に接続しようとした時点で初めて失敗していたはずです。

## 重要語句

- **t3-env**: create-t3-app 由来の環境変数検証ライブラリ。`@t3-oss/env-core` はフレームワーク非依存版（Next.js 用は `@t3-oss/env-nextjs`）。このプロジェクトは v0.13.11。
- **Standard Schema**: Zod / Valibot / ArkType などのバリデーションライブラリ共通のインターフェース。t3-env はこれに対応しているので Zod 以外も使える。
- **フェイルファスト（fail fast）**: 問題を早い段階で検出して即座に止めること。
- **`server` / `client` / `shared`**: サーバー専用 / クライアントにも公開 / 両方で使う変数の区分。
- **`clientPrefix`**: `client` に書く変数に必須の接頭辞（例: `VITE_`、`PUBLIC_`）。

## 仕様・注意点

型定義（`backend/node_modules/@t3-oss/env-core/dist/index.d.ts`）で確認したオプション:

| オプション | 既定値 | 説明 |
| --- | --- | --- |
| `server` | — | サーバー専用変数のスキーマ |
| `client` + `clientPrefix` | — | クライアント公開変数。接頭辞がないと **型エラー** |
| `shared` | — | `NODE_ENV` など両方で使う変数 |
| `runtimeEnv` | — | 値の取得元（`runtimeEnvStrict` を使うと全キーの指定を型で強制） |
| `isServer` | `typeof window === "undefined"` | サーバーかどうかの判定 |
| `emptyStringAsUndefined` | `false` | 空文字を未設定扱いにする。型定義のコメントで **新規プロジェクトでは `true` 推奨** とされている |
| `skipValidation` | `false` | 検証をスキップ（CI でのビルド時など） |
| `onValidationError` | ログ + throw | 検証失敗時の処理 |
| `extends` | — | プリセット（Vercel などの環境変数定義）の取り込み。`@t3-oss/env-core/presets-zod` に `vercel()` や `neonVercel()`（`DATABASE_URL` と、Neon の Vercel 連携が設定する `DATABASE_URL_UNPOOLED` などの定義）がある |

注意点:

- **`z.string()` は空文字 `""` を通します。** `.env` に `FRONTEND_URL=` と書いた（値が空）場合、未設定とはみなされず検証を通過してしまいます（Zod 4.6.6 で `z.string().safeParse("")` が成功することを確認）。`emptyStringAsUndefined: true` にするか、スキーマを厳しくする（→ `25-zod-env-schema.md`）のが対策です。
- `emptyStringAsUndefined: true` の実装は、`runtimeEnv` オブジェクトから空文字のキーを **`delete` で削除** します（`backend/node_modules/@t3-oss/env-core/dist/index.js` の冒頭部分）。`runtimeEnv: process.env` を渡していると、`process.env` 自体から空の変数が消える点は覚えておくとよいでしょう。
- 返される `env` は **スキーマに書いたキーだけ** を持ちます。`env.PORT` のように宣言していない変数は TypeScript の型エラーになり、実行時も値は入っていません。使う変数は必ずスキーマに追加します。
- `env` の型は `Readonly` なので、`env.FRONTEND_URL = "..."` のような代入は型エラーになります。
- 検証は `createEnv` を呼んだ時点（モジュールの読み込み時）に 1 回だけ行われます。

## 今後に活かせるポイント

- 環境変数を使うときは `process.env.XXX` を直接参照せず、必ず `env.ts` 経由にするルールにすると、「どの環境変数が必要か」が `env.ts` を見るだけで分かります。
- DB の接続文字列（`DATABASE_URL`、追加済み）、API キー、ポート番号など、今後増える設定はすべて `server` に追加していけます。

## 改善するなら

```ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// .env の読み込みは dev.ts の import "dotenv/config" に任せる（Vercel では .env を使わない）
export const env = createEnv({
  server: {
    // http(s) の URL のみ許可し、末尾スラッシュなどを origin 形式に正規化
    FRONTEND_URL: z.url({ protocol: /^https?$/ }).transform((u) => new URL(u).origin),
    // postgres:// または postgresql:// の URL のみ許可
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    // 文字列 "3000" を数値 3000 に変換。未設定なら 3000
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true, // FRONTEND_URL= のような空値を「未設定」として扱う
});
```

このコードは、ダミーの値を `runtimeEnv` に渡して実行し、`"http://localhost:5173/"` が `"http://localhost:5173"` に正規化されること、`PORT: "4000"` が数値 `4000` になること、`FRONTEND_URL: ""` が「未設定」としてエラーになることを確認済みです。`DATABASE_URL` についても、`postgresql://...` と `postgres://...` は通り、プロトコルのない `localhost:5432/kakeibo_db` や `mysql://...` は `Invalid URL`、空文字は「未設定」としてエラーになることを確認しました。

こうすれば、ハードコードされているポート番号（`backend/src/dev.ts:6` の `port: 3000`）も `env.PORT` に置き換えられます（Vercel 上ではポートを使わないので、`PORT` は既定値付きにしておけば本番に影響しません）。

## 次に学ぶこと

- `@t3-oss/env-nextjs` など、フレームワーク別パッケージの違い
- `skipValidation` を使ったビルド時の検証スキップと、Docker / CI での環境変数の渡し方

# 環境変数の Zod スキーマを改善する（z.string() → z.url() など）

## 概要

`createEnv` は「スキーマに合っているか」を検証するだけなので、**スキーマが緩ければ検証も緩くなります**。現在の `z.string()` は「文字列であれば何でも OK」なので、URL として不正な値や空文字も通してしまいます。

Zod 4 には、環境変数の検証に便利なスキーマが揃っています（このプロジェクトは Zod 4.6.6）。

| 用途 | スキーマ | 備考 |
| --- | --- | --- |
| URL | `z.url()` | Zod 4 のトップレベル API。`z.string().url()` は非推奨 |
| http(s) の URL に限定 | `z.url({ protocol: /^https?$/ })` | |
| 空でない文字列 | `z.string().min(1)` | API キーなど |
| 数値（文字列から変換） | `z.coerce.number()` | `"3000"` → `3000` |
| 選択肢 | `z.enum([...])` | `NODE_ENV` など |
| 真偽値（文字列から変換） | `z.stringbool()` | `"true"`/`"false"`/`"1"`/`"0"` などを boolean に |
| 既定値 | `.default(値)` | 未設定時の値 |
| 変換 | `.transform(fn)` | 値の正規化 |

## このプロジェクトでの実装

`backend/src/env.ts:2`, `:5-8`

```ts
import z from "zod";
// ...
server: {
  FRONTEND_URL: z.string(),
  DATABASE_URL: z.string(),
},
```

どちらも「文字列であること」しか確認していません。

`FRONTEND_URL` は CORS の許可オリジンとして、ブラウザが送る `Origin` ヘッダーと **文字列の完全一致** で比較されます（`backend/node_modules/hono/dist/middleware/cors/index.js:64`）。そのため、次のような値は検証を通過するのに CORS では一致しません。

| 値の例 | `z.string()` | CORS で一致するか |
| --- | --- | --- |
| `""`（空） | 通る | しない |
| `localhost:5173`（スキームなし） | 通る | しない |
| `http://localhost:5173/`（末尾スラッシュ） | 通る | しない（Origin には末尾スラッシュがない） |
| `http://localhost:5173` | 通る | する |

`DATABASE_URL` も同じで、`z.string()` は形式の間違った接続文字列を通します。`pg` の `Pool` に渡したときの挙動を確認しました（ローカルの Docker の PostgreSQL に対して実行）。

| 値の例 | `z.string()` | `pool.query()` の結果 |
| --- | --- | --- |
| `postgresql://postgres:<正しいパスワード>@localhost:5432/kakeibo_db` | 通る | 成功 |
| `postgresql://postgres:wrong@localhost:5432/kakeibo_db` | 通る | `28P01 password authentication failed for user "postgres"` |
| `localhost:5432/kakeibo_db`（スキームなし） | 通る | `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` |
| `""`（空） | 通る | 同上 |

スキームのない値や空文字は URL として解釈されず、`pg` が既定の接続先（localhost:5432、パスワードなし）で接続を試みるため、**原因が分かりにくいエラー** になります。しかもこのエラーは起動時ではなく、最初にクエリを実行したリクエストで初めて起きます。形式の検証をスキーマに入れておけば、起動時に「`DATABASE_URL` が不正」と分かります。

## 重要語句

- **スキーマ**: データの期待する形の宣言。
- **`safeParse` / `parse`**: 検証して結果を返す（失敗時に例外を投げない / 投げる）。
- **coerce（強制変換）**: 検証前に型を変換すること。`z.coerce.number()` は内部で `Number(input)` を行う。
- **transform**: 検証後に値を加工すること。出力の型も変わる。

## 仕様・注意点

以下は、このプロジェクトの `backend/node_modules` にある Zod 4.6.6 で実際に `safeParse` して確認した結果です。

| 入力 | `z.url()` | `z.httpUrl()` | `z.url({ protocol: /^https?$/ })` |
| --- | --- | --- | --- |
| `http://localhost:5173` | OK | **NG** | OK |
| `http://localhost:5173/` | OK（そのまま） | NG | OK |
| `localhost:5173` | **OK** | NG | NG |
| `ftp://x.com` | OK | NG | NG |
| `https://example.com` | OK | OK | OK |
| `""` | NG | NG | NG |

ハマりどころ:

- **`z.url()` は `localhost:5173` を通します。** `new URL("localhost:5173")` が「`localhost:` というスキーム」として解釈できてしまうためです。スキームを限定したいなら `protocol` オプションを使います。
- **`z.httpUrl()` は `localhost` を拒否します。** ソース（`backend/node_modules/zod/v4/classic/schemas.js:401-407`）を見ると、`protocol` に加えて `hostname: regexes.domain`（ドメイン名の形式）も指定しているためです。ローカル開発の URL を受け付けたいなら `z.url({ protocol: /^https?$/ })` を使います。
- `z.url()` は末尾スラッシュを取り除きません。オリジンとして使うなら `.transform((u) => new URL(u).origin)` で正規化すると安全です（`"http://localhost:5173/"` → `"http://localhost:5173"` を確認済み）。
- **`z.string().url()` は Zod 4 で非推奨**（`backend/node_modules/zod/v4/classic/schemas.d.ts:115` に `@deprecated Use z.url() instead.`）。
- **Zod 4 ではエラーメッセージの指定は `error`** です（`message` は非推奨）。例: `z.string().min(1, { error: "必須です" })` または `z.string().min(1, "必須です")`。
- `import z from "zod"`（`backend/src/env.ts:2`）は、Zod が `export { z as default }` しているので動作します（`backend/node_modules/zod/index.d.ts`）。公式 README や t3-env の README では `import * as z from "zod"` や `import { z } from "zod"` の形が使われています。
- `z.coerce.number()` は `Number("")` が `0` になるため、空文字が `0` として通ってしまいます。`emptyStringAsUndefined: true`（→ `24-t3-env-createenv.md`）と組み合わせると安全です。

## 今後に活かせるポイント

- 環境変数のスキーマは「その値をどう使うか」から逆算して決めます。CORS のオリジンなら「http(s) の URL で、パスなし」、DB の接続文字列なら「`postgres://` か `postgresql://` で始まる URL」、ポートなら「1〜65535 の整数」。
- `DATABASE_URL` にはパスワードが含まれます。検証エラーのメッセージやログに **値そのものを出さない** ように注意します（t3-env の既定のエラー出力は Zod の issues で、`mysql://u:<秘密の値>@h/db` を渡して試したところ、値そのものは表示されませんでした）。
- 検証を厳しくするほど、設定ミスが「起動時の分かりやすいエラー」に変わります。

## 改善するなら

```ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// .env の読み込みは dev.ts の import "dotenv/config" が行う
export const env = createEnv({
  server: {
    FRONTEND_URL: z
      .url({ protocol: /^https?$/, error: "FRONTEND_URL は http(s) の URL を指定してください" })
      .transform((u) => new URL(u).origin),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: "DATABASE_URL は postgres:// または postgresql:// の URL を指定してください",
    }),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

## 次に学ぶこと

- Zod の `z.stringbool()` や `z.iso.*` など、文字列を扱う専用スキーマ
- Valibot / ArkType など、Standard Schema 対応の他ライブラリとの比較

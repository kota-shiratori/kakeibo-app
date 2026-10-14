# JSON と Content-Type ヘッダー

## 概要

HTTP のボディはただのバイト列です。受け取った側が「これは何の形式か」を知るために、**`Content-Type` ヘッダー** でメディアタイプ（MIME タイプ）を伝えます。JSON なら `application/json` です。

- リクエストで送るとき: クライアントが `Content-Type: application/json` を付け、ボディに **JSON 文字列** を入れる。
- レスポンスで返すとき: サーバーが `Content-Type: application/json` を付けて JSON 文字列を返す。

JavaScript のオブジェクトはそのままでは送れないので、`JSON.stringify` で文字列に変換します。受け取った側は `JSON.parse`（`response.json()` / `c.req.json()` の中身）でオブジェクトに戻します。

## このプロジェクトでの実装

### リクエスト（フロント → バック）

`web-app/src/hooks/useAddTransactions.ts:14-18`

```ts
const response = await fetch(`${BASE_URL}/transactions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(transaction),
});
```

- `body: JSON.stringify(transaction)` — `{ item, amount, date }` を `'{"item":"...","amount":-500,"date":"2025-01-01"}'` という文字列にしている。
- `headers: { "Content-Type": "application/json" }` — 「ボディは JSON です」と宣言している。

### レスポンス（バック → フロント）

`c.json(...)` で返すと、Hono が `content-type: application/json` を付けます（curl で確認: `content-type: application/json`）。フロントでは次のように受け取ります。

`web-app/src/hooks/useIncomeTransactions.ts:19`

```ts
const data = (await response.json()) as TransactionListInfo;
```

### 仕様書

`backend/openapi.yaml:51-56`（リクエスト）、`backend/openapi.yaml:31-34` ほか（レスポンス）で、`content` のキーとして `application/json` を指定しています。

## 重要語句

- **Content-Type**: ボディの形式を表すヘッダー。
- **Accept**: クライアントが「この形式で返してほしい」と伝えるヘッダー。
- **メディアタイプ（MIME タイプ）**: `application/json`、`text/plain`、`multipart/form-data` など。
- **シリアライズ / デシリアライズ**: オブジェクト ⇔ 文字列（バイト列）の変換。

## 仕様・注意点

- **`fetch` は `body` に文字列を渡すと、既定で `Content-Type: text/plain;charset=UTF-8` を付けます。** JSON を送るなら自分で `application/json` を指定する必要があります。
- **Hono の `c.req.json()` は Content-Type を確認しません。** 中身は `JSON.parse` するだけです（`backend/node_modules/hono/dist/request.js:104-106`）。実際に `Content-Type: text/plain` で JSON 文字列を送っても、サーバーはボディを JSON として処理し、**DB に INSERT して `201` を返しました**（実験用 DB に対して `app.request()` で確認）。
  - これは CORS の観点で重要です。`text/plain` の POST はプリフライトなしで他サイトから送れる「単純リクエスト」になるため、サーバーが `application/json` 以外を拒否しないと、他サイトから POST を送り込まれる余地が生まれます。今は POST が実際に DB へ保存するので、**送り込まれたデータがそのまま登録されてしまいます**（ブラウザが止めるのは「レスポンスを読むこと」だけで、リクエスト自体はサーバーに届く → `21-cors-credentials-and-hono-config.md`）。
- `Content-Type: application/json` を付けると、CORS ではプリフライト（OPTIONS）が発生します。サーバーの CORS 設定で `allowHeaders: ["Content-Type", ...]` を許可しているのはこのためです（`backend/src/index.ts:17`）。
- `JSON.stringify` の注意:
  - `undefined` のプロパティは消える（`{a: undefined}` → `'{}'`）。
  - `NaN` / `Infinity` は `null` になる。入力画面で `Number("")` は `0`、`Number("abc")` は `NaN` になるので、送信前の検証が大事です（`web-app/src/pages/Input.tsx:32`）。
  - `Date` オブジェクトは ISO 文字列（`"2025-01-01T00:00:00.000Z"`）になる。このプロジェクトは日付を最初から `"YYYY-MM-DD"` 文字列で扱っているので影響を受けません。
- `response.json()` の戻り値は `Promise<any>` です。`as TransactionListInfo` は **型を主張しているだけで、実行時の検証はしていません**。

## 今後に活かせるポイント

- JSON を送る `fetch` は「`method` + `headers` の Content-Type + `JSON.stringify`」の 3 点セットで覚えておきましょう。
- サーバー側では「Content-Type が JSON でなければ 400（または 415 Unsupported Media Type）」としておくと堅牢になります。

## 改善するなら

### サーバーで Content-Type を確認する

```ts
app.post("/transactions", async (c) => {
  const contentType = c.req.header("Content-Type") ?? "";
  if (!contentType.startsWith("application/json")) {
    return c.json({ message: "Content-Typeはapplication/jsonである必要があります。" }, 415);
  }
  // ...
});
```

Hono 標準の `validator("json", ...)` を使う方法もあります。Content-Type が JSON 形式でない場合は空オブジェクト `{}` として検証され、壊れた JSON は 400 になります（`backend/node_modules/hono/dist/validator/validator.js:13-20`）。

### フロントで共通の fetch ラッパーを作る

```ts
async function postJson<T>(path: string, data: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}
```

## 次に学ぶこと

- 実行時にレスポンスを検証する（フロントでも Zod を使う）
- `multipart/form-data` によるファイルアップロード

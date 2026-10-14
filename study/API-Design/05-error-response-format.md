# エラーレスポンスの形の統一と RFC 9457 Problem Details

## 概要

API がエラーを返すとき、**ボディの形をすべてのエラーで揃える** と、クライアントは 1 種類の処理でエラーを扱えるようになります。

このプロジェクトでは `{ "message": "..." }` という形に統一しています。シンプルで分かりやすい形です。

世の中には標準化された形式もあり、代表が **RFC 9457 "Problem Details for HTTP APIs"**（旧 RFC 7807 を置き換えたもの）です。

## このプロジェクトでの実装

### 実装側: すべての 400 が `{ message }`

`backend/src/index.ts:33-38`, `:82`, `:86`, `:90` のどれも同じ形です。

```ts
return c.json({ message: "金額は0以外の数値である必要があります。" }, 400);
```

### 仕様側: `ErrorResponse` スキーマを共通化

`backend/openapi.yaml:153-160`

```yaml
ErrorResponse:
  type: object
  required:
    - message
  properties:
    message:
      type: string
      description: エラーメッセージ
```

各 400 レスポンスは `$ref: "#/components/schemas/ErrorResponse"` でこれを参照しています（`backend/openapi.yaml:40`, `:69`）。さらにメッセージの具体例を `components/examples` にまとめています（`backend/openapi.yaml:162-178`）。

### クライアント側: メッセージを使っていない

`web-app/src/hooks/useAddTransactions.ts:19-21`

```ts
if (!response.ok) {
  throw new Error("取引の登録に失敗しました。");
}
```

サーバーが「日付はYYYY-MM-DD形式で入力してください。」と理由を返していても、画面には固定の文言しか出ません。せっかく統一した `message` が活かされていない状態です。

## 重要語句

- **エラーレスポンス**: エラー時に返すボディ。
- **Problem Details（RFC 9457）**: HTTP API のエラー表現の標準。メディアタイプは `application/problem+json`。
- **type / title / status / detail / instance**: Problem Details で定義されたメンバー。

| メンバー | 意味 |
| --- | --- |
| `type` | 問題の種類を表す URI（省略時は `"about:blank"` 扱い） |
| `title` | 問題の種類の短い説明（人間向け、発生ごとに変えない） |
| `status` | HTTP ステータスコード（数値） |
| `detail` | この発生に固有の説明（人間向け） |
| `instance` | この発生を識別する URI |

これ以外に **拡張メンバー**（例: `errors` 配列）を自由に追加できます。

## 仕様・注意点

- エラーの形が統一されていても、**例外的な経路で別の形が返る** ことがあります。このプロジェクトでは、壊れた JSON を送ったとき、また DB への INSERT が制約違反（21 文字の `item`、`2025-02-30` の日付など）で失敗したときや DB に接続できないときに、Hono 既定のエラーハンドラが `text/plain` で `Internal Server Error` を返します（`backend/node_modules/hono/dist/hono-base.js:14-21`、`app.request()` で確認済み）。クライアントが `response.json()` しようとすると失敗するので注意。
- 同様に、存在しないパスへのアクセスは Hono 既定の `404 Not Found`（text/plain）になります（`backend/node_modules/hono/dist/hono-base.js:11-13`）。
- `message` は人間向けの文言です。プログラムで分岐したい場合（「日付エラーならこの入力欄を赤くする」など）は、**機械向けのコード**（例: `code: "INVALID_DATE"`）や **どの項目か**（`field: "date"`）があると便利です。
- エラーメッセージにスタックトレースや SQL などの内部情報を含めてはいけません（攻撃のヒントになる）。

## 今後に活かせるポイント

- 新しいエンドポイントでも `ErrorResponse` を `$ref` で再利用すれば、仕様書の一貫性が保てます。
- フロントでは「エラー時はボディの `message` を読んで表示、読めなければ固定文言」というパターンを 1 か所に作っておくと便利です。

## 改善するなら

### 1. クライアントでサーバーのメッセージを表示する

```ts
if (!response.ok) {
  // JSON でないエラー（500 の text/plain など）にも備える
  const body = await response.json().catch(() => null);
  const message =
    body && typeof body.message === "string"
      ? body.message
      : "取引の登録に失敗しました。";
  throw new Error(message);
}
```

### 2. 複数項目のエラーをまとめて返せる形に拡張する

```json
{
  "message": "入力内容に誤りがあります。",
  "errors": [
    { "field": "amount", "message": "金額は0以外の数値である必要があります。" },
    { "field": "date", "message": "日付はYYYY-MM-DD形式で入力してください。" }
  ]
}
```

### 3. RFC 9457 に寄せる

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://example.com/problems/validation-error",
  "title": "入力値が不正です",
  "status": 400,
  "detail": "日付はYYYY-MM-DD形式で入力してください。",
  "errors": [{ "field": "date", "message": "日付はYYYY-MM-DD形式で入力してください。" }]
}
```

OpenAPI ではレスポンスの `content` のキーを `application/problem+json` にします。

## 次に学ぶこと

- Hono の `HTTPException` と `app.onError` でのエラー集約（study/Hono）
- Zod のエラー（`issues`）を API のエラー形式に変換する方法（`z.flattenError` / `z.treeifyError`）

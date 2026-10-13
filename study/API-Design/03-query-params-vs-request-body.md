# クエリパラメータとリクエストボディの使い分け

## 概要

クライアントからサーバーへ値を渡す方法は、主に 4 つあります。

| 渡し方 | 例 | 主な用途 |
| --- | --- | --- |
| パスパラメータ | `/transactions/1` | どのリソースかを特定する（ID など） |
| クエリパラメータ | `/transactions?type=income` | 一覧の絞り込み・並び替え・ページ指定などの **条件** |
| リクエストボディ | `{"item":"給料",...}` | 作成・更新する **データ本体** |
| ヘッダー | `Authorization: Bearer ...` | 認証情報、形式の指定などの **メタ情報** |

目安としては、

- **GET** では基本的にボディを使わず、条件はクエリパラメータで渡す。
- **POST / PUT / PATCH** では、作成・更新するデータをボディ（JSON）で渡す。

## このプロジェクトでの実装

### GET: クエリパラメータ `type`

フロントエンドは収入・支出それぞれでクエリを付けて呼び出します。

- `web-app/src/hooks/useIncomeTransactions.ts:15` — `/transactions?type=income`
- `web-app/src/hooks/useExpenseTransactions.ts:15` — `/transactions?type=expense`

サーバーはクエリを取り出し、許可された値かどうかを確認しています。

`backend/src/index.ts:19-28`

```ts
const type = c.req.query("type");

if (!type || !["income", "expense", "all"].includes(type)) {
  return c.json(
    { message: "typeはincome,expense,allのいずれかである必要があります。" },
    400,
  );
}
```

仕様書では `components/parameters` に定義されています（`backend/openapi.yaml:80-91`、詳細は `13-openapi-parameters.md`）。

### POST: JSON のリクエストボディ

`web-app/src/hooks/useAddTransactions.ts:14-18`

```ts
const response = await fetch(`${BASE_URL}/transactions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(transaction),
});
```

`backend/src/index.ts:52-54`

```ts
const body = await c.req.json();

const { item, amount, date } = body;
```

## 重要語句

- **クエリ文字列（query string）**: URL の `?` 以降。`key=value` を `&` でつなぐ。
- **リクエストボディ**: ヘッダーの後に続くデータ本体。形式は `Content-Type` で示す。
- **URL エンコード**: クエリに日本語や記号を入れるときの変換（`encodeURIComponent` / `URLSearchParams`）。

## 仕様・注意点

- **クエリの値は常に文字列** です。`?page=2` の `2` も文字列 `"2"` として届くので、数値として使うなら変換と検証が必要です。
- クエリは URL の一部なので、ブラウザ履歴・サーバーログ・プロキシのログに残ります。パスワードやトークンなどの秘密情報は入れてはいけません。
- GET にボディを付けることは HTTP 仕様上「意味が定義されていない」扱いで、ブラウザの `fetch` では GET/HEAD にボディを付けると例外になります。
- このプロジェクトでは `type` は **必須** です（`backend/openapi.yaml:83` の `required: true`、実装も未指定なら 400）。「指定がなければ all」とする設計もよくあります（→ 改善するなら）。
- 収入か支出かはデータに `type` 列があるわけではなく、**金額の符号** で表しています。支出は入力画面で負の数に変換して送っています（`web-app/src/pages/Input.tsx:32-36`）。つまり `type=income` の絞り込みは「`amount > 0`」に相当する設計です（ただし実装はまだ絞り込みをしていません → `18-spec-vs-implementation-gaps.md`）。

## 今後に活かせるポイント

- 一覧 API の条件（期間 `from`/`to`、並び順 `sort`、件数 `limit` など）は、すべてクエリパラメータとして追加していけます。
- フロント側でクエリを組み立てるときは、文字列連結より `URLSearchParams` を使うとエンコード漏れを防げます。

```ts
const params = new URLSearchParams({ type: "income", from: "2025-01-01" });
fetch(`${BASE_URL}/transactions?${params}`);
```

## 改善するなら

`type` を任意にして、未指定時は `all` として扱う設計にすると、クライアントが楽になります。

```yaml
# openapi.yaml
TransactionType:
  name: type
  in: query
  required: false
  schema:
    type: string
    enum: [income, expense, all]
    default: all
```

```ts
// 実装側（Zod を使う例）
import { z } from "zod";
const TypeQuery = z.enum(["income", "expense", "all"]).default("all");

const parsed = TypeQuery.safeParse(c.req.query("type"));
if (!parsed.success) {
  return c.json({ message: "typeはincome,expense,allのいずれかである必要があります。" }, 400);
}
const type = parsed.data; // "income" | "expense" | "all" 型になる
```

## 次に学ぶこと

- ページネーション（`limit`/`offset` 方式とカーソル方式）
- 配列クエリの表現（`?tag=a&tag=b` と OpenAPI の `style` / `explode`）

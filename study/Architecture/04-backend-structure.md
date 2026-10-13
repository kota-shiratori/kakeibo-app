# バックエンドの構造 — 1 ファイルに集まった責務

## 概要

バックエンドは `backend/src/index.ts`（94 行）と `backend/src/env.ts`（12 行）の 2 ファイルだけで構成されています。小さいうちはこれで十分ですが、**1 つのハンドラ関数の中に複数の責務が混在している** 点を理解しておくと、今後機能を増やすときにどこを分ければよいかが見えてきます。

## このプロジェクトでの実装

### index.ts の中にある責務

```text
backend/src/index.ts
├── 1-4    import（env を含む）
├── 6      アプリ生成          new Hono()
├── 8-16   横断的関心事        CORS ミドルウェア
├── 18-49  GET /transactions
│   ├── 19-28  入力検証        type クエリのチェック → 400
│   ├── 30-37  データ取得      ハードコードの配列（本来は DB）
│   ├── 39-46  ビジネスロジック totalCount / totalAmount の計算
│   └── 48     レスポンス生成  c.json(result, 200)
├── 51-84  POST /transactions
│   ├── 52-54  リクエスト解析  c.req.json()
│   ├── 56-81  入力検証        必須・金額・日付形式 → 400
│   └── 83     レスポンス生成  受け取った body を 201 で返す（保存なし）
└── 86-94  サーバー起動        serve({ fetch: app.fetch, port: 3000 })
```

GET ハンドラの抜粋（`backend/src/index.ts:30-48`）:

```ts
const transactionList = [
  { id: 1, item: "給料", amount: 10000, date: "2025-01-01" },
];

const result = {
  transactions: transactionList,
  totalCount: transactionList.length,
  totalAmount: transactionList.reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  ),
};

return c.json(result, 200);
```

### env.ts — 設定の検証を分離している

```ts
// backend/src/env.ts:7-12
export const env = createEnv({
  server: {
    FRONTEND_URL: z.string(),
  },
  runtimeEnv: process.env,
});
```

環境変数の読み込み・検証だけは別ファイルに切り出されています。これは「設定」という関心事を分離した良い例です（ライブラリの詳細は Hono / TypeScript / Tooling フォルダ参照）。

## 重要語句

- **ハンドラ**: 特定のルート（メソッド + パス）に対するリクエストを処理する関数。
- **ミドルウェア**: 全リクエスト（または一部）に共通して挟み込む処理。CORS、ログ、認証など。
- **横断的関心事（cross-cutting concern）**: 多くの機能にまたがって必要になる処理。ミドルウェアで扱うのが定石。
- **ビジネスロジック（ドメインロジック）**: アプリ固有のルール（ここでは合計金額の計算など）。
- **単一責任の原則（SRP）**: 1 つのモジュールは 1 つの理由でのみ変更されるべき、という原則。

## 仕様・注意点

- GET の `type` クエリは検証されますが、**値によって結果を絞り込んでいません**。`income` でも `expense` でも同じ「給料 10000」が返ります（`backend/src/index.ts:30-37`）。そのため現状は Home の「支出管理」カードにも「給料」が緑字（プラス）で表示されます。モックデータ段階の仮実装です。
- POST は検証のみで保存せず、`id` も付与せずに受け取った body をそのまま返します（`backend/src/index.ts:83`）。OpenAPI でも 201 のレスポンスは `TransactionInput`（id なし）と定義され、実装と一致しています（`backend/openapi.yaml:57-63`）。
- `c.req.json()`（`backend/src/index.ts:52`）は不正な JSON を受け取ると例外を投げます。現状はエラーハンドラがないため、その場合は Hono のデフォルト（500）になります（`11-error-handling-strategy.md`）。
- ポート `3000` はハードコードです（`backend/src/index.ts:89`）。

## 今後に活かせるポイント

- 小さいうちは 1 ファイルでよい。**分割のきっかけ** は「ハンドラが長くなった」「同じ検証を複数箇所で書き始めた」「テストを書きたくなった」とき。
- 分ける軸はおおむね「HTTP の世界（リクエスト/レスポンス）」「ルール（検証・計算）」「データの出し入れ（DB）」の 3 つ。

## 改善するなら

レイヤードアーキテクチャ風に分けた例です。

```text
backend/src/
├── index.ts                 ← serve() だけ
├── app.ts                   ← new Hono()、ミドルウェア、ルートのマウント
├── env.ts
├── routes/
│   └── transactions.ts      ← HTTP の入出力（検証 → service 呼び出し → c.json）
├── schemas/
│   └── transaction.ts       ← Zod スキーマ（入力検証）
├── services/
│   └── transactionService.ts← 合計計算など業務ロジック
└── repositories/
    └── transactionRepository.ts ← データ取得・保存（今はメモリ、後で DB）
```

```ts
// routes/transactions.ts（案）
import { Hono } from "hono";
import { listTransactions } from "../services/transactionService.js";

export const transactionsRoute = new Hono().get("/", async (c) => {
  const type = c.req.query("type");
  // 検証は schemas/ のスキーマで（Hono の validator 参照）
  const result = await listTransactions(type as "income" | "expense" | "all");
  return c.json(result, 200);
});
```

```ts
// app.ts（案）
export const app = new Hono();
app.use("/*", cors({ ... }));
app.route("/transactions", transactionsRoute);
```

`app` を `serve()` から分けておくと、テストで `app.request("/transactions?type=all")` のようにサーバーを起動せず呼び出せます（`16-testing-strategy.md`）。

## 次に学ぶこと

- **レイヤードアーキテクチャ / クリーンアーキテクチャ**: 依存の向きを「外側 → 内側（ドメイン）」に揃える考え方。
- Hono の `app.route()` によるルート分割と、`@hono/zod-validator` による検証の宣言的な記述（Hono フォルダ参照）。

# バックエンドの構造 — 1 ファイルに集まった責務

## 概要

バックエンドは `backend/src/index.ts`（108 行）・`backend/src/env.ts`（10 行）・`backend/src/dev.ts`（8 行）の 3 ファイルで構成されています。PostgreSQL への保存が入り、起動処理（`serve`）は `dev.ts` に分離されました。一方で、**1 つのハンドラ関数の中に「HTTP」「SQL」「変換」「計算」が混在している** 点は変わっていません。ここを理解しておくと、今後機能を増やすときにどこを分ければよいかが見えてきます。

## このプロジェクトでの実装

### index.ts の中にある責務

```text
backend/src/index.ts
├── 1-5     import（hono、cors、@vercel/functions、pg、env）
├── 7-8     DB 接続           new Pool({ connectionString: env.DATABASE_URL }) + attachDatabasePool
├── 10      アプリ生成         new Hono()
├── 12-20   横断的関心事       CORS ミドルウェア
├── 22-27   ヘルパー           toYMD（Date → "YYYY-MM-DD"）
├── 29-75   GET /transactions
│   ├── 30-39  入力検証        type クエリのチェック → 400
│   ├── 41-51  SQL の組み立て  type に応じて WHERE amount > 0 / < 0、ORDER BY date DESC
│   ├── 53-54  データ取得      pool.query で一覧と COUNT(*) の 2 クエリ
│   ├── 56-61  変換            行 → API の形（parseInt / parseFloat / toYMD）
│   ├── 63-72  ビジネスロジック totalAmount を reduce で計算、totalCount は COUNT の結果
│   └── 74     レスポンス生成  c.json(result, 200)
├── 77-106  POST /transactions
│   ├── 78-79  リクエスト解析  c.req.json()
│   ├── 81-91  入力検証        必須・金額・日付形式 → 400
│   ├── 93-96  データ保存      INSERT ... RETURNING（$1, $2, $3 のプレースホルダー）
│   ├── 98-103 変換            GET と同じ変換をもう一度
│   └── 105    レスポンス生成  採番された id 付きで 201
└── 108     export default app  （Vercel Functions のエントリ）
```

```text
backend/src/dev.ts（ローカル開発専用）
├── 2      import "dotenv/config"   ← .env を process.env に読み込む
├── 3-4    serve と app の import
└── 6-8    serve({ fetch: app.fetch, port: 3000 })
```

GET ハンドラの抜粋（`backend/src/index.ts:41-72`）:

```ts
let historyQuery = `SELECT id, item, amount, date FROM transactions`;
let countQuery = `SELECT COUNT(*) as total FROM transactions`;

if (type === "income" || type === "expense") {
  const addTypeQuery =
    type === "income" ? ` WHERE amount > 0` : ` WHERE amount < 0`;
  historyQuery += addTypeQuery;
  countQuery += addTypeQuery;
}

historyQuery += ` ORDER BY date DESC`;

const historyResult = await pool.query(historyQuery);
const countResult = await pool.query(countQuery);

const transactions = historyResult.rows.map((row) => ({ /* 変換 */ }));

const totalAmount = transactions.reduce(
  (sum, transaction) => sum + transaction.amount,
  0,
);

const result = {
  transactions,
  totalCount: parseInt(countResult.rows[0].total),
  totalAmount,
};
```

### env.ts — 設定の検証を分離している

```ts
// backend/src/env.ts:4-10
export const env = createEnv({
  server: {
    FRONTEND_URL: z.string(),
    DATABASE_URL: z.string(),
  },
  runtimeEnv: process.env,
});
```

環境変数の読み込み・検証だけは別ファイルに切り出されています。これは「設定」という関心事を分離した良い例です（ライブラリの詳細は API-Design / Tooling フォルダ参照）。`DATABASE_URL` が未設定だと、読み込んだ時点で `Invalid environment variables` を投げて止まります（`../Docker/08-connecting-backend-to-local-db.md`）。

### dev.ts — 起動処理の分離（実施済み）

以前は `index.ts` の末尾で `serve()` を呼んでいましたが、Vercel Functions 対応（コミット `2a1609f`）で、

- `index.ts` は `app` を **export するだけ**（Vercel が直接使う）
- `dev.ts` はローカルで `serve()` する **起動専用**

に分かれました。「`app` の定義」と「サーバーの起動」を分けるという、このノートの以前の改善案が実現した形です。

## 重要語句

- **ハンドラ**: 特定のルート（メソッド + パス）に対するリクエストを処理する関数。
- **ミドルウェア**: 全リクエスト（または一部）に共通して挟み込む処理。CORS、ログ、認証など。
- **横断的関心事（cross-cutting concern）**: 多くの機能にまたがって必要になる処理。ミドルウェアで扱うのが定石。
- **ビジネスロジック（ドメインロジック）**: アプリ固有のルール（ここでは合計金額の計算など）。
- **単一責任の原則（SRP）**: 1 つのモジュールは 1 つの理由でのみ変更されるべき、という原則。

## 仕様・注意点

- GET の `type` は `amount` の符号で絞り込まれます（`income` → `amount > 0`、`expense` → `amount < 0`、`all` → 条件なし）。SQL に連結しているのは固定の文字列だけで、利用者の入力は入らないので SQL インジェクションの心配はありません（`../SQL/11-placeholders-and-sql-injection.md`）。
- POST は `INSERT ... RETURNING` で保存し、DB が採番した `id` を含めて返します（`backend/src/index.ts:93-105`）。一方 OpenAPI は 201 のレスポンスを `TransactionInput`（id なし）、説明を「受け取った内容をそのまま返します」のままにしており、**実装とずれています**（`backend/openapi.yaml:50`, `58-63`、`14-api-contract-and-types.md`）。
- `c.req.json()`（`backend/src/index.ts:78`）は不正な JSON を受け取ると例外を投げます。DB の制約違反（21 文字の `item`、整数でない `amount` など）も例外になります。エラーハンドラがないため、どちらも Hono のデフォルト（500）になります（`11-error-handling-strategy.md`、`../PostgreSQL/05-constraints-and-errors.md`）。
- 行の変換（`parseInt` / `parseFloat` / `toYMD`）が GET と POST に重複しています。`parseFloat(row.amount)` は `INTEGER` 列なので本来不要です（`../PostgreSQL/07-node-postgres-type-conversion.md`）。
- `pool` がモジュールのトップレベルにあるため、`index.ts` を import するだけで DB 接続の設定（と `env` の検証）が走ります。ハンドラのテストには DB が必要です（`16-testing-strategy.md`）。
- ポート `3000` は `dev.ts:6` にハードコードです（ローカル専用なので実害は小さい）。

## 今後に活かせるポイント

- 小さいうちは 1 ファイルでよい。**分割のきっかけ** は「ハンドラが長くなった」「同じ検証を複数箇所で書き始めた」「テストを書きたくなった」とき。
- 分ける軸はおおむね「HTTP の世界（リクエスト/レスポンス）」「ルール（検証・計算）」「データの出し入れ（DB）」の 3 つ。今の `index.ts` は 3 つ目（SQL）が入ったことで、分割のきっかけに差しかかっている。

## 改善するなら

レイヤードアーキテクチャ風に分けた例です。

```text
backend/src/
├── index.ts                 ← Pool を作り、createApp(repo) した app を export（Vercel のエントリ）
├── dev.ts                   ← serve()（実施済み）
├── app.ts                   ← new Hono()、ミドルウェア、ルートのマウント
├── env.ts
├── routes/
│   └── transactions.ts      ← HTTP の入出力（検証 → service 呼び出し → c.json）
├── schemas/
│   └── transaction.ts       ← Zod スキーマ（入力検証）
├── services/
│   └── transactionService.ts← 合計計算など業務ロジック
└── repositories/
    └── transactionRepository.ts ← SQL によるデータ取得・保存（今ハンドラにある SQL をここへ）
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

`app` と `serve()` の分離はすでに済んでいるので、テストで `app.request("/transactions?type=all")` のようにサーバーを起動せず呼び出すこと自体は可能です。ただし今はハンドラが `pool` を直接使うため DB が必要です。リポジトリを外から渡せる形にすれば、DB なしでもテストできます（`15-persistence-and-repository-layer.md`、`16-testing-strategy.md`）。

## 次に学ぶこと

- **レイヤードアーキテクチャ / クリーンアーキテクチャ**: 依存の向きを「外側 → 内側（ドメイン）」に揃える考え方。
- Hono の `app.route()` によるルート分割と、`@hono/zod-validator` による検証の宣言的な記述（Hono フォルダ参照）。

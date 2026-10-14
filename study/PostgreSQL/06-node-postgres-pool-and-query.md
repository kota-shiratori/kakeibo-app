# node-postgres の `Pool` と `query`

## 概要

Node.js から PostgreSQL を使うための定番ドライバが **node-postgres（パッケージ名 `pg`）** です。接続を毎回作るのは重いので、接続を使い回す **コネクションプール（`Pool`）** を作り、`pool.query()` で SQL を実行します。

## このプロジェクトでの実装

### プールの作成 `backend/src/index.ts:3-8`

```ts
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { env } from "./env.js";

const pool = new Pool({ connectionString: env.DATABASE_URL });
attachDatabasePool(pool);
```

- モジュールの最上位で 1 回だけ作り、全リクエストで共有する
- `attachDatabasePool` は Vercel 用（→ 08 章）

### 一覧取得 `backend/src/index.ts:41-54`

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
```

- SQL を文字列連結で組み立てていますが、連結しているのは **コード内の固定文字列だけ**（`type` の値そのものは入れていない）なので SQL インジェクションの危険はありません。
- `result.rows` が行の配列（各行は列名をキーにしたオブジェクト）。

### 登録 `backend/src/index.ts:93-96`

```ts
const result = await pool.query(
  `INSERT INTO transactions (item, amount, date) VALUES ($1, $2, $3) RETURNING id, item, amount, date`,
  [item, amount, date],
);
```

- `$1, $2, $3` が **プレースホルダー**。値は第 2 引数の配列で別送りされる（`../SQL/11-placeholders-and-sql-injection.md`）
- `RETURNING` で、採番された `id` を含む登録後の行を同じクエリで受け取れる

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `Pool` | 接続（`Client`）をいくつか保持して貸し出す仕組み |
| `pool.query(text, values)` | プールから接続を借りて実行し、**終わったら自動で返却** する |
| `pool.connect()` | 接続を明示的に借りる。使い終わったら `client.release()` が必須 |
| `result.rows` | 結果の行の配列 |
| `result.rowCount` | 影響した行数（UPDATE / DELETE の件数確認に使える） |
| `connectionString` | `postgresql://ユーザー:パスワード@ホスト:ポート/DB名` 形式の接続文字列 |

## 仕様・注意点

### `Pool` の既定値（実験で確認）

`new Pool({ connectionString })` の `pool.options` を出力した結果:

```text
max: 10                        // 同時に持つ接続の最大数
idleTimeoutMillis: 10000       // 使われていない接続を 10 秒で閉じる
connectionTimeoutMillis: undefined  // 未指定 = 接続待ちのタイムアウトなし
```

`idleTimeoutMillis` が既定で入っていることは、08 章の `attachDatabasePool` の判定に関係します。

### トランザクションには `pool.query` を使わない

`pool.query` は **呼ぶたびに別の接続を借りる可能性がある** ため、`BEGIN` → `INSERT` → `COMMIT` を `pool.query` で 3 回呼ぶと、別々の接続で実行されて意味をなしません。トランザクションは 1 つの接続を借りて行います。

```ts
const client = await pool.connect();
try {
  await client.query("BEGIN");
  // ... 複数の更新
  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release(); // 返却を忘れるとプールが枯渇する
}
```

### プレースホルダーの数が合わないとエラー（実験で確認）

```text
pool.query("SELECT $1::text, $2::text", ["only one"])
→ bind message supplies 1 parameters, but prepared statement "" requires 2
```

### ローカルでは `DATABASE_URL` がまだ設定されていない

`backend/.env` に現在あるキーは `FRONTEND_URL` だけでした（値は確認していません）。`env.ts` で `DATABASE_URL` が必須なので、このままローカルで `npm run dev` すると起動時に環境変数の検証で失敗するはずです。Docker の DB に向けるなら次の形を追加します（パスワードはコンテナ作成時に指定したもの）。

```ini
DATABASE_URL=postgresql://postgres:<パスワード>@localhost:5432/kakeibo_db
```

詳しくは `../Docker/08-connecting-backend-to-local-db.md`。

## 今後に活かせるポイント

- 値を SQL に入れるときは **必ずプレースホルダー**。条件の組み立てに使う文字列はコード内の固定値だけにする。
- `RETURNING` を使えば「INSERT → もう一度 SELECT」が不要になる。UPDATE / DELETE でも使える。

## 改善するなら

1. **件数クエリを省く**: 絞り込み条件が同じなので `totalCount` は `historyResult.rows.length` で足ります（ページングを入れるまでは）。DB への往復が 1 回減ります。
2. **合計も DB に任せるなら**: `SELECT COUNT(*) AS total, COALESCE(SUM(amount), 0) AS sum FROM ...` のように 1 クエリで件数と合計を取れる（`SUM` は 0 件だと `NULL` → `COALESCE` で 0 に。`../SQL/09-aggregate-functions-and-group-by.md`）。
3. **OpenAPI を実装に合わせる**: POST の 201 は `RETURNING` で `id` 付きの行を返しているのに、`backend/openapi.yaml:63` は `TransactionInput`（id なし）のまま。`Transaction` に変える。
4. SQL をハンドラから `repositories/` に移す（`../Architecture/15-persistence-and-repository-layer.md`）。

## 次に学ぶこと

- 結果の値の型（→ 07 章）
- サーバーレス環境での接続管理（→ 08 章）

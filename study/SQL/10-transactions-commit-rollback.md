# トランザクション `BEGIN` / `COMMIT` / `ROLLBACK`

## 概要

**トランザクション** は、複数の SQL を「全部成功する」か「全部なかったことにする」かのひとまとまりとして扱う仕組みです。学習メモの TCL（`COMMIT` / `ROLLBACK`）がこれに当たります。

```sql
BEGIN;      -- トランザクション開始
-- ... 複数の INSERT / UPDATE / DELETE ...
COMMIT;     -- 確定（ほかの接続からも見えるようになる）
-- または
ROLLBACK;   -- BEGIN 以降の変更をすべて取り消す
```

家計簿の例: 「口座 A から口座 B に 1 万円移す」を「A から引く UPDATE」「B に足す UPDATE」の 2 文で書くと、1 文目だけ成功して落ちたらお金が消えます。トランザクションにすれば両方成功か、両方なしのどちらかになります。

## このプロジェクトでの実装

現状の backend は **明示的なトランザクションを使っていません**。`POST` は `INSERT` 1 文だけ（`backend/src/index.ts:93-96`）なので、1 文の中で完結し問題ありません。

PostgreSQL は `BEGIN` しなければ **1 文ごとに自動でトランザクションになり、成功すれば自動で確定** します（オートコミット）。psql で打った `INSERT` がすぐ確定するのもこのためです。

### 実験で確認した ROLLBACK

```sql
BEGIN;
DELETE FROM transactions;           -- DELETE 5
SELECT COUNT(*) FROM transactions;  -- 0
ROLLBACK;
SELECT COUNT(*) FROM transactions;  -- 5
```

`BEGIN` の後なら、全行削除も `ROLLBACK` で元に戻せました。危ない操作を試すときの安全網として使えます。

### 実験で確認した「エラー後のトランザクション」

```sql
BEGIN;
INSERT INTO transactions (item, amount, date) VALUES ('a', 1, '2025-10-01');  -- INSERT 0 1
SELECT 1/0;    -- ERROR:  division by zero
SELECT 1;      -- ERROR:  current transaction is aborted, commands ignored until end of transaction block
ROLLBACK;
```

PostgreSQL では、トランザクションの途中で 1 つでもエラーが起きると、そのトランザクションは **中断状態** になり、以後の SQL はすべて拒否されます。`ROLLBACK` で終わらせるしかありません（この状態で `COMMIT` しても、実際にはロールバックされます）。

## 重要語句

- **トランザクション**: 一連の操作の単位。
- **コミット（`COMMIT`）**: 変更を確定する。
- **ロールバック（`ROLLBACK`）**: 変更を取り消す。
- **オートコミット**: 明示的に `BEGIN` しないとき、1 文ごとに自動でコミットされる動作。
- **`SAVEPOINT`**: トランザクションの途中に戻り地点を作り、そこまでだけ取り消す。
- **ACID**: トランザクションが満たすべき性質。Atomicity（原子性: 全部か無か）、Consistency（一貫性: 制約を破らない）、Isolation（独立性: 同時実行しても互いに干渉しにくい）、Durability（永続性: 確定したら消えない）。

## 仕様・注意点

### node-postgres でのトランザクションは「同じ接続」で

backend は `Pool`（接続プール）を使い、`pool.query()` で SQL を実行しています（`backend/src/index.ts:7`, 53-54）。`pool.query()` は **呼ぶたびにプールから空いている接続を借りて返す** ので、次のように書くと `BEGIN` と `INSERT` と `COMMIT` が **別々の接続** で実行される可能性があり、トランザクションになりません。

```ts
// NG: それぞれ別の接続で実行されうる
await pool.query("BEGIN");
await pool.query("INSERT ...");
await pool.query("COMMIT");
```

`pool.connect()` で 1 本の接続（client）を借り、同じ client で実行してから `release()` で返します（node-postgres のドキュメントに書かれている形）。

```ts
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("INSERT ...", [...]);
  await client.query("UPDATE ...", [...]);
  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release(); // 忘れるとプールの接続が枯渇する
}
```

`Pool` の詳細は `../PostgreSQL/06-node-postgres-pool-and-query.md`。

### 一覧と件数の 2 つの SELECT

`GET /transactions` は一覧（53 行目）と件数（54 行目）を別々の SQL で取っており、間に別の INSERT が入ると件数と一覧がずれる可能性があります（→ 09 章）。PostgreSQL の既定の分離レベル（Read Committed）では、同じトランザクションの中でも **文ごとに** 最新の確定データを見るので、単に `BEGIN` で囲むだけでは完全にはそろいません。そろえたい場合は `REPEATABLE READ` などの分離レベルを使うか、そもそも件数を一覧の `length` から求めるのが簡単です。

## 今後に活かせるポイント

- psql で `UPDATE` / `DELETE` を試すときは、まず `BEGIN;` してから。結果を `SELECT` で確かめて `COMMIT;` / `ROLLBACK;`。
- 「2 つ以上の書き込みがセットで意味を持つ」処理を作ったら、それはトランザクションにするサイン。

## 次に学ぶこと

- 分離レベル（Read Committed / Repeatable Read / Serializable）と、同時更新で起きる問題（ロストアップデートなど）
- 行ロック（`SELECT ... FOR UPDATE`）
- プレースホルダーと SQL インジェクション（→ 11 章）

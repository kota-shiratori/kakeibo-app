# 更新 `UPDATE` と削除 `DELETE`

## 概要

`UPDATE` は既存の行の値を書き換え、`DELETE` は行を削除します。どちらも **`WHERE` で対象を絞る** のが基本で、`WHERE` を忘れると **テーブルの全行** が対象になります。

```sql
UPDATE テーブル名 SET 列 = 値, 列 = 値 WHERE 条件;
DELETE FROM テーブル名 WHERE 条件;
```

## このプロジェクトでの実装

backend にはまだ更新・削除の API はありません（`backend/src/index.ts` にあるのは `GET` と `POST /transactions` のみ）。CORS 設定では `PUT` / `DELETE` を許可しているので（同 16 行目）、将来の「編集」「削除」機能でこの SQL を使うことになります。

### psql での練習（学習メモより）

```sql
-- id = 7 の行を削除
DELETE FROM transactions WHERE id = 7;

-- id = 1 の金額を 5000 に
UPDATE transactions SET amount = 5000 WHERE id = 1;

-- 今の値をもとに計算して更新（2 倍にする）
UPDATE transactions SET amount = amount * 2 WHERE id = 1;

-- 複数の列を一度に更新（カンマで区切る）
UPDATE transactions SET amount = 50000, date = '2025-10-02' WHERE id = 1;
```

学習メモでは最後の文が `date = ''2025-10-02` になっていて構文エラーになります（→ 02 章）。上は修正済みの形です。

### 実験で確認した結果

`RETURNING *` を付けると、更新後の行がそのまま表示されます。

```sql
UPDATE transactions SET amount = amount * 2 WHERE item = 'おこづかい' RETURNING *;
```

```text
 id |    item    | amount |    date
----+------------+--------+------------
  3 | おこづかい |  60000 | 2025-10-01
(1 row)

UPDATE 1
```

```sql
UPDATE transactions SET amount = 50000, date = '2025-10-02' WHERE item = 'おこづかい' RETURNING *;
```

```text
  3 | おこづかい |  50000 | 2025-10-02
UPDATE 1
```

存在しない id を指定した場合:

```sql
UPDATE transactions SET amount = 1 WHERE id = 99999;
```

```text
UPDATE 0
```

**エラーにはならず「0 行更新した」と返るだけ** です。

## 重要語句

- **`SET 列 = 式`**: 新しい値。右辺には `amount * 2` のように **今の列の値を使った式** も書ける。
- **コマンドタグ `UPDATE n` / `DELETE n`**: 実際に変更・削除した行数。
- **`RETURNING`**: 変更・削除した行を返す（→ 04 章）。
- **`TRUNCATE`**: テーブルの全行を高速に削除する命令（DDL に分類されることもある）。

## 仕様・注意点

### `WHERE` なしは全行が対象

学習メモの `DELETE FROM table` は書式の例ですが、実際に `DELETE FROM transactions;` と打つと **全行が消えます**。実験では、トランザクションの中で試してから取り消しました（→ 10 章）。

```sql
BEGIN;
DELETE FROM transactions;          -- DELETE 5
SELECT COUNT(*) FROM transactions; -- 0
ROLLBACK;
SELECT COUNT(*) FROM transactions; -- 5（元に戻った）
```

psql は既定で **1 文ごとに自動で確定（オートコミット）** されるので、`BEGIN` していない状態で実行した `DELETE` / `UPDATE` は取り消せません。

### 安全に実行する手順

1. 先に同じ `WHERE` で `SELECT` して、対象の行と件数を確認する。
2. 不安なら `BEGIN;` してから実行し、結果を確認して `COMMIT;`（違ったら `ROLLBACK;`）。
3. `WHERE` には主キー（`id`）を使い、対象を 1 行に特定する。

### 削除した id は再利用されない

`GENERATED ... AS IDENTITY` の採番は、行を削除しても戻りません（実験でも、削除後の INSERT は続きの番号でした）。id に欠番があるのは正常です（→ `../PostgreSQL/04-identity-columns.md`）。

## 今後に活かせるポイント

API で更新・削除を作るときは、`UPDATE 0` / `DELETE 0` を「対象が見つからなかった」と判断して **404** を返すのが定番です。`RETURNING` を使えば、更新後の行をそのままレスポンスにできます。

## 改善するなら

`DELETE /transactions/:id` を作る場合の例（Hono のパスパラメータ + プレースホルダー）:

```ts
app.delete("/transactions/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ message: "idが不正です。" }, 400);
  }
  const result = await pool.query(
    `DELETE FROM transactions WHERE id = $1 RETURNING id`,
    [id],
  );
  if (result.rowCount === 0) {
    return c.json({ message: "指定された収支が見つかりません。" }, 404);
  }
  return c.body(null, 204);
});
```

`result.rowCount` は node-postgres が返す「影響を受けた行数」（psql の `DELETE n` の n に当たる）です。

## 次に学ぶこと

- 集計関数（→ 09 章）
- トランザクション（→ 10 章）
- 物理削除と論理削除（`deleted_at` 列で「削除済み」を表す設計）

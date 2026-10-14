# 集計関数（`COUNT` / `SUM` / `AVG` / `MAX` / `MIN`）と `GROUP BY`

## 概要

集計関数は、複数の行をまとめて 1 つの値（件数・合計・平均など）にする関数です。`GROUP BY` と組み合わせると「項目ごとの合計」「月ごとの合計」のような集計ができます。家計簿の「合計金額」「件数」はまさにこれです。

## このプロジェクトでの実装

### backend での COUNT

`backend/src/index.ts:42`

```ts
let countQuery = `SELECT COUNT(*) as total FROM transactions`;
```

`type` に応じて同じ `WHERE` を連結し（44-49 行目）、件数だけを別の SQL で取得しています。結果は 70 行目で

```ts
totalCount: parseInt(countResult.rows[0].total),
```

と **`parseInt` している** のがポイントです。`COUNT(*)` の型は `bigint` で、node-postgres は `bigint` を JavaScript の文字列として返すためです（実験で `total: '6'` のように文字列で返ることを確認。→ `../PostgreSQL/07-node-postgres-type-conversion.md`）。

### 合計はアプリ側で計算している

`backend/src/index.ts:63-66`

```ts
const totalAmount = transactions.reduce(
  (sum, transaction) => sum + transaction.amount,
  0,
);
```

合計金額は SQL の `SUM` ではなく、取得した行を JavaScript で足しています。

## 重要語句

| 関数 | 意味 | 実験での結果 | 結果の型（`pg_typeof` で確認） |
| --- | --- | --- | --- |
| `COUNT(*)` | 行数 | `5` | `bigint` |
| `SUM(amount)` | 合計 | `23900` | `bigint`（`integer` の合計でも bigint になる） |
| `AVG(amount)` | 平均 | `4780.0000000000000000` | `numeric` |
| `MAX(amount)` | 最大 | `30000` | `integer`（元の列と同じ型） |
| `MIN(amount)` | 最小 | `-3000` | `integer` |

（04 章の 5 行のデータで実験。`SELECT COUNT(*), SUM(amount), AVG(amount), MAX(amount), MIN(amount) FROM transactions;`）

- **`GROUP BY 列`**: その列の値ごとにグループを作り、グループごとに集計する。
- **`HAVING 条件`**: 集計した **後の** 結果で絞り込む（`WHERE` は集計の **前** に行を絞る）。
- **`COALESCE(a, b)`**: a が NULL なら b を返す。

## 仕様・注意点

### 0 件のとき `SUM` / `AVG` は NULL（実験で確認）

```sql
SELECT COUNT(*), SUM(amount), COALESCE(SUM(amount), 0) AS s0, AVG(amount)
FROM transactions WHERE amount > 1000000;
```

```text
 count | sum | s0 | avg
-------+-----+----+-----
     0 |     |  0 |
```

- `COUNT(*)` は 0 を返す。
- `SUM` / `AVG` は **0 ではなく NULL**（空欄表示）。node-postgres では `null` になる（実験で `{ s: null }` を確認）。
- 0 にしたいときは `COALESCE(SUM(amount), 0)`。

### 型がアプリにどう届くか

`SUM` の `bigint` と `AVG` の `numeric` は、node-postgres では **文字列** で届きます（実験で `s: '-5999'`、`a: '-999.8333333333333333'`）。`MAX(amount)` は `integer` なので数値（`m: 100`）。SQL で集計に切り替えるときは変換が必要です（→ `../PostgreSQL/07-node-postgres-type-conversion.md`）。

### GROUP BY（実験で確認）

```sql
SELECT item, COUNT(*), SUM(amount)
FROM transactions
WHERE amount < 0
GROUP BY item
ORDER BY item;
```

```text
  item  | count |  sum
--------+-------+-------
 カフェ |     2 | -1100
 食料品 |     2 | -5000
```

`SELECT` に書けるのは、`GROUP BY` に指定した列と集計関数だけです（`id` のようにグループ内で値が 1 つに決まらない列を書くとエラーになる）。

月ごとの集計も `date_trunc` で月初の日付にそろえてグループ化できます（実験で確認）。

```sql
SELECT date_trunc('month', date)::date AS m, SUM(amount)
FROM transactions GROUP BY m ORDER BY m;
```

```text
     m      |  sum
------------+-------
 2025-09-01 | -3600
 2025-10-01 | -2399
```

（`::date` は型変換。`date` を渡した `date_trunc` の結果は `timestamp with time zone`（時刻・タイムゾーン付き）になる（`pg_typeof` で確認）ので日付に戻している。この実験は 08 章の更新・削除や追加の INSERT を経た後のデータで行ったので、合計値は最初の 5 行の値とは一致しません。）

### 件数を別の SQL で取ることについて

今の実装は「一覧の SELECT」と「COUNT の SELECT」を別々に実行しています（53-54 行目）。

- 一覧を全件返している現状では、`transactions.length` と同じ値になるので、COUNT の SQL は実質不要です。
- 一方で、将来 `LIMIT` でページ分割したときは「全体の件数」と「このページの行」が別物になるので、COUNT を別に取る形が活きてきます。
- 2 つの SQL の間に別のリクエストが行を追加すると、件数と一覧がずれる可能性があります（厳密にそろえるならトランザクション → 10 章）。

## 今後に活かせるポイント

- 集計は「全行をアプリに持ってきて計算する」か「DB で計算して結果だけ受け取る」かの選択です。行数が増えるほど DB 側（`SUM` / `GROUP BY`）が有利になります（転送量が減る）。
- 集計結果を返すときは「0 件で NULL」「bigint / numeric は文字列」の 2 点を必ず確認する。

## 改善するなら

合計も DB に計算させる例（`::int` で integer に変換して数値で受け取る。ただし合計が integer の範囲（約 21 億）を超えないことが前提）:

```ts
const summary = await pool.query(
  `SELECT COUNT(*)::int AS total_count,
          COALESCE(SUM(amount), 0)::int AS total_amount
   FROM transactions WHERE amount < 0`,
);
// summary.rows[0] → { total_count: 2, total_amount: -5000 }（数値）
```

`::int` を付けると `pg` から number で返ることは実験で確認しました（`SELECT COUNT(*)::int AS c, SUM(x)::int AS s ...` → `{ c: 2, s: 3 }`、どちらも `typeof` は `'number'`）。

## 次に学ぶこと

- トランザクション（→ 10 章）
- 月別・カテゴリ別のレポート API の設計（`../Architecture/17-roadmap.md`）
- ウィンドウ関数（`SUM(...) OVER (...)` で残高の累計など）

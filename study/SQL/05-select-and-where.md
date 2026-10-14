# データの取得 `SELECT` と絞り込み `WHERE`

## 概要

`SELECT` はテーブルから行を取り出す命令、`WHERE` は「どの行を対象にするか」の条件です。家計簿アプリの一覧表示（`GET /transactions?type=...`）はこの 2 つの組み合わせです。

```sql
SELECT 列1, 列2 FROM テーブル名 WHERE 条件;
```

## このプロジェクトでの実装

### psql での練習

```sql
-- すべての列・すべての行
SELECT * FROM transactions;

-- 列を選ぶ
SELECT item, amount FROM transactions;
```

学習メモに貼った出力:

```text
kakeibo_db=# SELECT item, amount FROM transactions;
    item    | amount
------------+--------
 おこづかい |  30000
(1 row)
```

```sql
-- 支出（マイナス）だけ
SELECT item, amount FROM transactions WHERE amount < 0;

-- 2025-10-01 以降
SELECT item, amount FROM transactions WHERE date >= '2025-10-01';

-- 2025 年 10 月分（10/1 以上 かつ 11/1 未満）
SELECT * FROM transactions WHERE date >= '2025-10-01'
AND date < '2025-11-01';
```

### backend での SELECT

`backend/src/index.ts:41-51`

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
```

- 「収入 = 金額がプラス」「支出 = 金額がマイナス」という設計（`../Architecture/09-domain-modeling-signed-amount.md`）を、そのまま `WHERE amount > 0` / `WHERE amount < 0` に置き換えています。
- `type=all` のときは `WHERE` を付けず全件。
- SQL を文字列連結で組み立てていますが、連結しているのは **コードに書かれた固定の文字列だけ** で、ユーザーの入力（`type` の値そのもの）は SQL に入れていません。直前の 32 行目で `type` が 3 つの値のどれかであることも検証済みです。この形なら SQL インジェクションは起きません（→ 11 章）。
- 53-54 行目で 2 つの SQL を順に `pool.query()` で実行しています。

## 重要語句

| 書き方 | 意味 |
| --- | --- |
| `SELECT *` | すべての列 |
| `SELECT item, amount` | 指定した列だけ（列の順番も指定どおり） |
| `=` / `<>`（または `!=`） | 等しい / 等しくない（JavaScript の `===` ではなく `=` 1 つ） |
| `<` `<=` `>` `>=` | 大小比較。数値・日付・文字列に使える |
| `AND` / `OR` / `NOT` | 条件の組み合わせ（優先順位に注意 → 06 章） |
| `IN ('A', 'B')` | いずれかに一致（`= 'A' OR = 'B'` の短縮形） |
| `BETWEEN a AND b` | `>= a AND <= b`（**両端を含む**） |
| `IS NULL` / `IS NOT NULL` | NULL かどうか |
| `AS` | 列に別名を付ける（`COUNT(*) as total` の `total`） |

## 仕様・注意点

### 期間指定は「以上・未満」で書く

10 月分を `date >= '2025-10-01' AND date < '2025-11-01'` と書くのは良い書き方です。

- 月末日（30 日か 31 日か、うるう年か）を考えなくてよい。
- 将来 `date` を時刻付き（`TIMESTAMP`）に変えても、`BETWEEN '2025-10-01' AND '2025-10-31'` だと 10/31 の 0 時より後が漏れますが、「11/1 未満」ならそのまま正しく動きます。

実験で確認: `SELECT '2025-10-31'::date < '2025-11-01';` → `t`（true）。`'...'` の文字列は比較相手の列の型（DATE）として解釈されます。

### `SELECT *` はアプリのコードでは避ける

psql での確認には便利ですが、アプリでは backend のように **必要な列を明示** するほうが安全です。列が追加されても返るデータが勝手に増えず、どの列に依存しているかがコードから読めます。

### NULL との比較

`WHERE 列 = NULL` は常に「真」にならず、1 行も返りません。NULL かどうかは `IS NULL` で判定します。今の `transactions` は全列 `NOT NULL` なので問題になりませんが、任意入力の列（メモ欄など）を足したときに注意が必要です。

### WHERE の結果がなくてもエラーではない

条件に合う行が 0 件なら、結果は `(0 rows)` になるだけです。アプリ側では空配列として扱います。

## 今後に活かせるポイント

- 画面の「絞り込み」機能を作るときは、まず psql で `WHERE` を書いて期待どおりの行が返るか確認してから、コードに移すと早い。
- 期間の条件は「開始以上・終了未満（半開区間）」を基本形として覚える。

## 改善するなら

月別表示を追加するなら、期間もプレースホルダーで渡します（→ 11 章）。

```ts
await pool.query(
  `SELECT id, item, amount, date FROM transactions
   WHERE date >= $1 AND date < $2
   ORDER BY date DESC, id DESC`,
  ["2025-10-01", "2025-11-01"],
);
```

## 次に学ぶこと

- `AND` と `OR` の優先順位（→ 06 章）
- 並び替え `ORDER BY`（→ 07 章）
- 件数を絞る `LIMIT` / `OFFSET`（ページネーション）
- 範囲検索を速くするインデックス（→ `../Database/02-keys-and-indexes.md`）

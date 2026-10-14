# 行の追加 `INSERT`

## 概要

`INSERT` はテーブルに新しい行を追加する DML です。家計簿アプリでは「収支を登録する」（`POST /transactions`）がこれに当たります。

```sql
INSERT INTO テーブル名 (列1, 列2, ...) VALUES (値1, 値2, ...);
```

## このプロジェクトでの実装

### psql での練習

```sql
INSERT INTO transactions
    (item,amount,date) VALUES
    ('おこづかい', 30000, '2025-10-01');
```

- `id` は書いていません。`GENERATED ALWAYS AS IDENTITY` なので **DB が自動で採番** します。
- 文字列と日付はシングルクォート、数値はそのまま（→ 02 章）。

### backend での INSERT

`backend/src/index.ts:93-96`

```ts
const result = await pool.query(
  `INSERT INTO transactions (item, amount, date) VALUES ($1, $2, $3) RETURNING id, item, amount, date`,
  [item, amount, date],
);
```

- `$1, $2, $3` は **プレースホルダー**。値は第 2 引数の配列で別に渡す（→ 11 章）。
- `RETURNING id, item, amount, date` で、**追加された行をそのまま結果として受け取れる**。DB が採番した `id` を知るために使っています。98-103 行目でこの `result.rows[0]` からレスポンスを組み立て、201 で返しています。

## 重要語句

- **`INSERT INTO ... VALUES`**: 値を指定して行を追加。
- **複数行 INSERT**: `VALUES (...), (...), (...)` と並べると 1 文で複数行を追加できる。
- **`RETURNING`**: `INSERT` / `UPDATE` / `DELETE` が変更した行を返させる PostgreSQL の構文。
- **コマンドタグ**: psql に表示される `INSERT 0 1` など。`INSERT` の場合、最後の数字が追加した行数（真ん中の `0` は歴史的な名残の OID で、今は常に 0）。

## 仕様・注意点

### 学習メモの書き間違い

学習メモには次のように書いてありました。

```ts
// 学習メモ（誤り）
`INSERT INTO transactions (item, amount, date VALUES ($1, $2, $3))`
```

列リストの `)` が `VALUES` の後ろにずれているため、これは **構文エラー** になります。正しくは `(item, amount, date)` で列リストを閉じてから `VALUES (...)` です。実際の backend のコード（93-96 行目）は正しい形になっています。

### 複数行をまとめて追加（実験で確認）

```sql
INSERT INTO transactions (item, amount, date) VALUES
 ('おこづかい', 30000, '2025-10-01'),
 ('カフェ', -500, '2025-10-05'),
 ('食料品', -3000, '2025-09-20'),
 ('カフェ', -600, '2025-09-28'),
 ('食料品', -2000, '2025-10-10')
RETURNING *;
```

```text
 id |    item    | amount |    date
----+------------+--------+------------
  3 | おこづかい |  30000 | 2025-10-01
  4 | カフェ     |   -500 | 2025-10-05
  ...
(5 rows)

INSERT 0 5
```

このデータは 05〜10 章の実験でも使っています（実験用に別 DB `study_scratch` を作って試し、終了後に削除済み）。

### 列リストは省略しないほうがよい

`INSERT INTO transactions VALUES (...)` のように列リストを省略すると、テーブル定義の **列順どおり** にすべての値を並べる必要があります。列が増えたときに壊れるので、列名は常に書くのが安全です。

### 制約違反は INSERT 全体が失敗する（実験で確認）

| 入力 | 結果 |
| --- | --- |
| `id` に値を指定 | `ERROR:  cannot insert a non-DEFAULT value into column "id"`（→ `../PostgreSQL/04-identity-columns.md`） |
| `item` が 21 文字 | `ERROR:  value too long for type character varying(20)` |
| `date` を省略 | `ERROR:  null value in column "date" of relation "transactions" violates not-null constraint` |
| `date` が `'2025-02-30'` | `ERROR:  date/time field value out of range: "2025-02-30"` |
| `amount` が `2147483648` | `ERROR:  integer out of range` |

エラー一覧と backend への影響（現状は 500 になる）は `../PostgreSQL/05-constraints-and-errors.md` にまとめています。

### 失敗しても id が飛ぶことがある

実験では、`NOT NULL` 違反で失敗した INSERT のエラー詳細に `Failing row contains (2, x, 1, null).` と出ており、id 2 が使われていました。その後に成功した INSERT は id 3 から始まりました。**id は連番になる保証はない** と理解しておきます（→ `../PostgreSQL/04-identity-columns.md`）。

## 今後に活かせるポイント

- 「登録した結果を返す API」では `RETURNING` を使えば、INSERT の後に改めて SELECT する必要がありません。
- テスト用のデータは複数行 `INSERT` を 1 つの `.sql` ファイルにまとめておくと、何度でも同じ状態を作れます（シードデータ）。

## 改善するなら

- 現在 OpenAPI の 201 レスポンスは `TransactionInput`（id なし）のままです（`backend/openapi.yaml:58-63`）。実装は `RETURNING` で id 付きの行を返しているので、`Transaction` に揃えると仕様と実装が一致します。

## 次に学ぶこと

- `SELECT` で取り出す（→ 05 章）
- プレースホルダーと SQL インジェクション（→ 11 章）
- `INSERT ... ON CONFLICT`（重複時に更新する、いわゆる UPSERT）

# データ型

## 概要

PostgreSQL のテーブルの列には必ず **型** を付けます。型によって「入る値の範囲」「比較・並び替えのしかた」「使える関数」が決まり、型に合わない値はエラーで拒否されます。TypeScript の型と違い、**実行時に DB が必ずチェックする** のがポイントです。

## このプロジェクトでの実装

学習メモの `CREATE TABLE`:

```sql
CREATE TABLE transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    date DATE NOT NULL
);
```

| 列 | 型 | 選んだ理由（読み取れる意図） |
| --- | --- | --- |
| `id` | `BIGINT` | 自動採番の ID。件数が増えても溢れないよう 8 バイト整数 |
| `item` | `VARCHAR(20)` | 項目名。フロントの `maxLength={20}`（`web-app/src/pages/Input.tsx:89`）と揃えている |
| `amount` | `INTEGER` | 円単位の金額。支出はマイナスで表す（`../Architecture/09-domain-modeling-signed-amount.md`） |
| `date` | `DATE` | 日付のみ（時刻なし） |

## 重要語句

| 型 | 別名 | 範囲・特徴 |
| --- | --- | --- |
| `SMALLINT` | `int2` | 2 バイト、-32768 〜 32767 |
| `INTEGER` | `int`, `int4` | 4 バイト、-2147483648 〜 2147483647（約 ±21 億） |
| `BIGINT` | `int8` | 8 バイト、約 ±922 京（±9223372036854775807） |
| `NUMERIC(p, s)` | `DECIMAL` | 任意精度の 10 進数。誤差なしで小数を扱える（遅め） |
| `VARCHAR(n)` | `character varying(n)` | 最大 **n 文字** の文字列 |
| `TEXT` | — | 長さ制限なしの文字列 |
| `DATE` | — | 日付のみ（年月日）。タイムゾーンなし |
| `TIMESTAMPTZ` | `timestamp with time zone` | 日時。UTC で保存し、表示時にセッションのタイムゾーンへ変換 |
| `BOOLEAN` | `bool` | true / false |

## 仕様・注意点

### `VARCHAR(n)` の n は「文字数」（実験で確認）

```text
-- ひらがな 20 文字
INSERT ... ('あいうえおかきくけこさしすせそたちつてと', ...) RETURNING id, length(item), octet_length(item);
 id | length | octet_length
----+--------+--------------
  1 |     20 |           60

-- 21 文字
ERROR:  value too long for type character varying(20)
```

- `length` は文字数 20、`octet_length`（バイト数）は 60（UTF-8 でひらがなは 1 文字 3 バイト）。**バイト数ではなく文字数で制限** されます。
- 絵文字 `😀` を 20 個（JavaScript の `length` では 40）も、PostgreSQL では 20 文字として **登録できました**（`pg` 経由で実験）。
  - HTML の `maxLength` は UTF-16 のコード単位で数えるため、絵文字はフロントの方が厳しく判定します。ずれ方が「フロントの方が厳しい」向きなので、現状は問題になりません。

### `INTEGER` の上限（実験で確認）

```text
INSERT ... VALUES ('x', 2147483648, '2025-10-01');
ERROR:  integer out of range
```

家計簿の 1 件の金額としては十分ですが、`SUM` の結果は `BIGINT` になる（溢れないように型が広がる）ことも確認しました（`../SQL/09-aggregate-functions-and-group-by.md`）。

### お金に浮動小数点（`REAL` / `DOUBLE PRECISION`）は使わない

`0.1 + 0.2` のような誤差が出るためです。円単位なら `INTEGER` / `BIGINT`、小数が必要なら `NUMERIC`。PostgreSQL には `MONEY` 型もありますが、表示がロケール依存になるなどクセがあり、一般には `NUMERIC` か整数（最小単位）が推奨されます。

### `DATE` は存在しない日付を拒否する（実験で確認）

```text
INSERT ... VALUES ('x', 1, '2025-02-30');
ERROR:  date/time field value out of range: "2025-02-30"
```

backend の正規表現チェック（`/^\d{4}-\d{2}-\d{2}$/`、`backend/src/index.ts:89`）は形式しか見ないので、`2025-02-30` は通過して DB でエラーになります（→ 05 章）。

### `DATE` 同士の引き算は日数（`integer`）になる（実験で確認）

```text
SELECT '2025-10-01'::date - '2025-09-01'::date;  -- 30（pg_typeof は integer）
```

`'...'::date` は「文字列を `date` 型に変換（キャスト）する」PostgreSQL の書き方です。

## 今後に活かせるポイント

- 列の型は「アプリで取りうる値」より少し余裕を持たせつつ、**DB 側で不正値を止める最後の砦** として選ぶ。
- 日付だけなら `DATE`、登録日時のように時刻が必要なら `TIMESTAMPTZ`（タイムゾーン付き）を選ぶのが定番。
- Node.js に渡ってきたときの JavaScript の型は、DB の型とは別に決まる（→ 07 章）。

## 改善するなら

- 作成日時を残すなら `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` を追加する。
- `amount` が 0 にならないことを DB でも保証する `CHECK (amount <> 0)`（→ 05 章）。

## 次に学ぶこと

- `GENERATED ALWAYS AS IDENTITY`（→ 04 章）
- 型の変換（`pg` が JS の値に変える規則 → 07 章）

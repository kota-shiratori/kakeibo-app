# 主キーとインデックス

## 概要

- **主キー（PRIMARY KEY）**：テーブルの中で **1 行を一意に特定する** ための列。
- **インデックス（索引）**：特定の列での検索・並べ替えを速くするための補助的なデータ構造。本の巻末の索引と同じ発想です。

PostgreSQL では、主キーを定義すると **自動でインデックスも作られます**。

## このプロジェクトでの実装

学習メモの `CREATE TABLE`：

```sql
CREATE TABLE transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    date DATE NOT NULL
);
```

`\d transactions` の結果（学習メモより）：

```text
Indexes:
    "transactions_pkey" PRIMARY KEY, btree (id)
```

- `id` が主キー。
- 主キー制約の名前は自動で `テーブル名_pkey`（`transactions_pkey`）になった。
- その制約のために **B-tree インデックス** が自動で作られている。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| **主キー（PK）** | 一意（UNIQUE）かつ NULL 不可（NOT NULL）の列。1 テーブルに 1 つだけ |
| **代理キー（サロゲートキー）** | 業務上の意味を持たない、DB が採番する ID。今回の `id` |
| **自然キー（ナチュラルキー）** | 業務上の値をそのままキーにするもの（例：社員番号、ISBN） |
| **一意制約（UNIQUE）** | 同じ値を 2 回入れられない制約。主キーでなくても付けられる |
| **インデックス** | 列の値 → 行の場所 の対応表。検索を速くする代わりに、書き込み時に更新コストがかかる |
| **B-tree** | PostgreSQL の既定のインデックス方式。`=`、`<`、`>`、範囲検索、並べ替えに使える |

## なぜ `id`（代理キー）を主キーにするのか

家計簿の 1 行を特定できる「業務上の値」はありません。

- `item` は「カフェ」が何度も登場する
- `(date, item, amount)` の組み合わせも、同じ日に同じカフェで同じ金額を 2 回使えば重複する

だから意味を持たない連番 `id` を DB に採番させ、それを主キーにしています。将来 `DELETE /transactions/:id` や `PUT /transactions/:id` を作るときも、この `id` で行を特定します（学習メモの `DELETE FROM transactions WHERE id = 7;` が実例）。

採番の仕組み（`GENERATED ALWAYS AS IDENTITY`）は `../PostgreSQL/04-identity-columns.md` を参照してください。

## インデックスはいつ必要か

### 主キーでの検索

`WHERE id = 7` は主キーのインデックスが使われるので、行数が増えても速いままです。

### このアプリの一覧取得

```sql
-- backend/src/index.ts:41-51 で組み立てられる SQL（type=expense の場合）
SELECT id, item, amount, date FROM transactions WHERE amount < 0 ORDER BY date DESC
```

- `amount` にも `date` にもインデックスはありません。PostgreSQL はテーブル全体を読んで（シーケンシャルスキャン）、絞り込み・並べ替えをします。
- **数百〜数千行程度ならまったく問題ありません**。個人の家計簿なら何年分でもこの規模です。
- 何十万行にもなり、「月ごとの一覧」などで遅くなってきたら、例えば `date` にインデックスを作ります。

```sql
CREATE INDEX transactions_date_idx ON transactions (date);
```

どのような実行計画になるかは `EXPLAIN SELECT ...` で確認できます。

## 仕様・注意点

- **インデックスは書き込みを遅くする**：INSERT / UPDATE のたびにインデックスも更新されるので、「とりあえず全部の列に張る」のは逆効果です。遅いクエリが実際に出てから、`EXPLAIN` で確認して追加するのが基本です。
- **小さなテーブルではインデックスがあっても使われないことがある**：全部読んだ方が速いと PostgreSQL（のプランナー）が判断するためです。
- **主キーの値は再利用されない・連番とは限らない**：行を消しても番号は詰められず、INSERT の失敗で番号が飛ぶこともあります（→ `../PostgreSQL/04-identity-columns.md`）。`id` は「識別子」であって「件数」や「順番」として使わないようにします。

## 今後に活かせるポイント

- 「1 行を特定する手段は何か」を最初に決める。それが主キー。
- 「よく検索・並べ替えに使う列は何か」を意識しておく。それがインデックスの候補（ただし作るのは必要になってから）。
- 将来ユーザー（ログイン）を追加したら、`transactions.user_id` で絞り込む検索が必ず発生するので、そこはインデックスの有力な候補になります。

## 次に学ぶこと

- テーブル設計の見直し（→ 03）
- `EXPLAIN` / `EXPLAIN ANALYZE` で実行計画を読む
- 外部キー（`REFERENCES`）：別のテーブルの主キーを参照する制約（カテゴリやユーザーのテーブルを作るときに必要）

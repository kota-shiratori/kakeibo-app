# 制約とエラー（SQLSTATE）

## 概要

型や制約に合わない値を入れようとすると、PostgreSQL はエラーを返して **その文全体を取り消します**。エラーには人間向けのメッセージのほかに、**SQLSTATE** という 5 文字のコードが付いていて、プログラムからはこのコードで種類を判定するのが確実です。

## このプロジェクトでの実装

`transactions` テーブルの制約:

| 列 | 制約 |
| --- | --- |
| `id` | `PRIMARY KEY`（= NOT NULL + 一意） |
| `item` | `NOT NULL`、`VARCHAR(20)`（20 文字まで） |
| `amount` | `NOT NULL`、`INTEGER`（整数・範囲） |
| `date` | `NOT NULL`、`DATE`（存在する日付） |

backend の POST（`backend/src/index.ts:81-91`）は、必須チェック・`amount` が 0 以外の number か・日付の形式だけを見ています。**文字数・整数かどうか・範囲・実在する日付は見ていない** ので、それらは DB の制約で初めて止まります。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 制約（constraint） | 列やテーブルに付けるルール。NOT NULL / UNIQUE / PRIMARY KEY / CHECK / FOREIGN KEY |
| `CHECK (条件)` | 条件を満たさない行を拒否する |
| SQLSTATE | エラーの種類を表す 5 文字のコード。先頭 2 文字が分類（`22` = データ例外、`23` = 整合性制約違反） |

## 仕様・注意点

### 実験で確認したエラー

`pg`（node-postgres）から一時テーブルに INSERT し、`err.code`（= SQLSTATE）と `err.message` を出力しました。

| 入力 | `err.code` | `err.message` |
| --- | --- | --- |
| `item` が 21 文字 | `22001` | value too long for type character varying(20) |
| `amount` が `1.5` | `22P02` | invalid input syntax for type integer: "1.5" |
| `amount` が `2147483648` | `22003` | value "2147483648" is out of range for type integer |
| `date` が `"2025-02-30"` | `22008` | date/time field value out of range: "2025-02-30" |

psql で確認した NOT NULL 違反:

```text
INSERT INTO transactions (item, amount) VALUES ('x', 1);
ERROR:  null value in column "date" of relation "transactions" violates not-null constraint
DETAIL:  Failing row contains (2, x, 1, null).
```

NOT NULL 違反の SQLSTATE は `23502`、一意制約違反は `23505`、CHECK 違反は `23514` です（PostgreSQL のドキュメント「Appendix A. PostgreSQL Error Codes」）。一時テーブル `t (id INT PRIMARY KEY, item VARCHAR(20) NOT NULL, amount INTEGER NOT NULL CHECK (amount <> 0))` を作り、`pg` の `err.code` / `err.constraint` でも確認しました（実験で確認）。

```text
23502          null value in column "item" of relation "t" violates not-null constraint
23505 t_pkey   duplicate key value violates unique constraint "t_pkey"
23514 t_amount_check new row for relation "t" violates check constraint "t_amount_check"
```

`err.constraint` に制約名が入るので、「どの制約に違反したか」でエラーメッセージを出し分けることもできます。

- `1.5` が「範囲外」ではなく「構文エラー（22P02）」なのは、`pg` が JS の数値を **文字列 `"1.5"` として送り**、PostgreSQL が「整数として読めない」と判断するためです。勝手に丸められることはありません。

### API ではすべて 500 になる

backend はこれらの例外を `try/catch` していないため、Hono の既定のエラー処理で **500 Internal Server Error（text/plain）** が返ります（`../Hono/10-default-error-and-not-found.md`）。

- 本来は利用者の入力ミスなので **400** が適切です。
- フロントは `maxLength={20}` と `type="number"` 入力で多くを防いでいますが、API を直接叩けば通ってしまいます。

### エラーはトランザクション全体を止める

`BEGIN` 中にエラーが起きると、その後のコマンドは ROLLBACK するまで受け付けられません（実験で確認: `ERROR: current transaction is aborted, commands ignored until end of transaction block`）。詳しくは `../SQL/10-transactions-commit-rollback.md`。

## 今後に活かせるポイント

- **アプリ側の検証（親切なメッセージ）** と **DB の制約（最後の砦）** は二重に持つのが基本。どちらか片方では足りない（`../Architecture/12-validation-layers.md`）。
- DB エラーを判定するときはメッセージ文字列ではなく `err.code` を見る（メッセージは言語設定やバージョンで変わりうる）。

## 改善するなら

1. backend の検証に「20 文字以内」「整数」「±21 億以内」「実在する日付」を追加し、400 を返す（Zod なら `z.string().min(1).max(20)`、`z.number().int()` など）。
2. 想定外の DB エラーは `app.onError` で JSON の 500 にそろえる。

```ts
import { DatabaseError } from "pg";

app.onError((err, c) => {
  // アプリの検証をすり抜けた入力値エラー（22xxx）は 400 として返す
  if (err instanceof DatabaseError && err.code?.startsWith("22")) {
    return c.json({ message: "入力値が不正です。" }, 400);
  }
  console.error(err);
  return c.json({ message: "サーバーエラーが発生しました。" }, 500);
});
```

※ `DatabaseError` は `pg` から export されているクラスです。この形は案で、まだ backend には入っていません。

3. DB 側にも業務ルールを入れる。

```sql
ALTER TABLE transactions ADD CONSTRAINT amount_not_zero CHECK (amount <> 0);
```

## 次に学ぶこと

- `pg` での `query` の使い方（→ 06 章）
- バリデーションの層の分け方（`../Architecture/12-validation-layers.md`）

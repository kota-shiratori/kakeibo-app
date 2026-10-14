# プレースホルダー（`$1`）と SQL インジェクション対策

## 概要

**SQL インジェクション** は、ユーザーの入力をそのまま SQL の文字列に埋め込んだせいで、入力の中身が「SQL の一部」として解釈されてしまう脆弱性です。データの漏えい・改ざん・全削除につながります。

対策の基本は **プレースホルダー**（パラメータ化クエリ）です。SQL の「形」と「値」を別々に DB へ送るので、値の中に `'` や `OR` が含まれていても、ただの文字列として扱われます。

## このプロジェクトでの実装

`backend/src/index.ts:93-96`

```ts
const result = await pool.query(
  `INSERT INTO transactions (item, amount, date) VALUES ($1, $2, $3) RETURNING id, item, amount, date`,
  [item, amount, date],
);
```

- SQL 文の中には `$1, $2, $3` という **目印** だけを書く。
- 実際の値は第 2 引数の配列で渡す。`$1` ← `item`、`$2` ← `amount`、`$3` ← `date`（1 始まり）。
- ユーザーが入力した `item`（項目名）がどんな文字列でも、SQL の構造は変わりません。

`GET` 側（41-51 行目）は SQL を文字列連結で組み立てていますが、連結しているのはコードに固定で書いた `" WHERE amount > 0"` などだけで、ユーザー入力は入っていません（→ 05 章）。

## 重要語句

- **プレースホルダー**: SQL の中の「ここに値が入る」という目印。PostgreSQL / node-postgres では `$1`, `$2`, ...（MySQL 系のライブラリでは `?` を使うものが多い）。
- **パラメータ化クエリ**: プレースホルダーと値を分けて送る実行方法。
- **SQL インジェクション**: 入力値によって SQL の意味が書き換えられる攻撃。

## 仕様・注意点

### 実験で確認: 連結とプレースホルダーの違い

テーブルに 6 行ある状態で、攻撃を想定した入力 `x' OR '1'='1` を使って比べました（node-postgres から実行）。

```ts
const evil = "x' OR '1'='1";

// プレースホルダー
await pool.query("SELECT COUNT(*) FROM transactions WHERE item = $1", [evil]);
// → { count: '0' }   「x' OR '1'='1」という名前の項目は無いので 0 件

// 文字列連結（やってはいけない）
await pool.query(`SELECT COUNT(*) FROM transactions WHERE item = '${evil}'`);
// → { count: '6' }   全件ヒットしてしまう
```

連結した場合、実際に DB へ送られる SQL は次のようになります。

```sql
SELECT COUNT(*) FROM transactions WHERE item = 'x' OR '1'='1'
```

入力に含まれる `'` で文字列が閉じられ、`OR '1'='1'`（常に真）が **SQL の条件として** 追加されてしまいました。`SELECT` なら全件漏えい、`DELETE ... WHERE id = '${id}'` なら全件削除にもなりえます。

### テンプレートリテラルの `${}` は SQL の外で展開される

JavaScript のテンプレートリテラル `` `...${x}...` `` は、DB に送る **前に** ただの文字列結合として展開されます。backend の SQL もバッククォートで書かれていますが、値を入れているのは `$1` 形式で、`${}` は使っていません。**SQL の中に `${...}` でユーザー入力を書かない** ことが鉄則です。

### プレースホルダーの数と値の数は一致させる（実験で確認）

```ts
await pool.query("SELECT $1::text, $2::text", ["only one"]);
```

```text
bind message supplies 1 parameters, but prepared statement "" requires 2
```

### プレースホルダーにできるのは「値」だけ

テーブル名・列名・`ASC` / `DESC`・`ORDER BY` の列などの **SQL の構造部分** にはプレースホルダーを使えません。これらを入力で切り替えたいときは、許可リストで固定の文字列を選びます（backend の `type` → `" WHERE amount > 0"` の切り替えがまさにこの形）。

```ts
const SORT_COLUMNS = { date: "date", amount: "amount" } as const;
const sortKey = c.req.query("sort") === "amount" ? "amount" : "date";
const sql = `SELECT ... ORDER BY ${SORT_COLUMNS[sortKey]} DESC, id DESC`; // 固定文字列しか入らない
```

### 値はどう送られるか

node-postgres は JavaScript の値を文字列にして送り、PostgreSQL 側で列の型として解釈します。そのため、型の合わない値は DB のエラーになります（実験で確認）。

| 渡した値 | 結果 |
| --- | --- |
| `amount` に `1.5` | `invalid input syntax for type integer: "1.5"`（エラーコード 22P02） |
| `amount` に `2147483648` | `value "2147483648" is out of range for type integer`（22003） |
| `item` に 21 文字 | `value too long for type character varying(20)`（22001） |

プレースホルダーは **インジェクションを防ぐ** ものであって、**入力の妥当性までは検証しません**。backend 側のバリデーション（`backend/src/index.ts:81-91`）は別途必要です。これらのエラーが今の backend では 500 になる点は `../PostgreSQL/05-constraints-and-errors.md` を参照。

## 今後に活かせるポイント

- SQL に入れる値は **常にプレースホルダー**。「この値は安全だから」と例外を作らない。
- 構造（列名・並び順など）を切り替えるときは、入力をそのまま使わず許可リストから選ぶ。
- ORM / クエリビルダー（Drizzle、Kysely など）も内部では同じくパラメータ化しています。素の SQL を書くときほど意識が必要です。

## 改善するなら

フィルタ条件が増えたときも、値は配列に積んで番号を振る形にすれば安全に動的 SQL を組めます。

```ts
const where: string[] = [];
const params: unknown[] = [];
if (type === "income") where.push("amount > 0");
if (type === "expense") where.push("amount < 0");
if (from) { params.push(from); where.push(`date >= $${params.length}`); }
if (to)   { params.push(to);   where.push(`date < $${params.length}`); }

const sql =
  `SELECT id, item, amount, date FROM transactions` +
  (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
  ` ORDER BY date DESC, id DESC`;
await pool.query(sql, params);
```

（`$${params.length}` は「`$` + 番号」を作っているだけで、ユーザーの値そのものは SQL に入りません。）

## 次に学ぶこと

- OWASP の SQL インジェクション対策の解説
- クエリビルダー / ORM（Drizzle、Kysely、Prisma）
- node-postgres の `Pool` と `query` の詳細（→ `../PostgreSQL/06-node-postgres-pool-and-query.md`）

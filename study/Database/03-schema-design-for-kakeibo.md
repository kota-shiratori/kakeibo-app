# 家計簿のテーブル設計を見直す（各層のルールのずれ）

## 概要

テーブル設計（どんな列を、どの型と制約で持つか）は、DB に入るデータの「最後の砦」です。一方で、同じルールはフロントエンド・OpenAPI・backend のバリデーションにも書かれていて、**層ごとにルールがずれていると、エラーの出方が不自然になります**。

このノートでは、現在の `transactions` テーブルを各層のルールと突き合わせ、設計上の課題と改善案をまとめます。

## このプロジェクトでの実装

```sql
CREATE TABLE transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    date DATE NOT NULL
);
```

| 列 | 型・制約 | 意味 |
| --- | --- | --- |
| `id` | `BIGINT`、自動採番、主キー | 収支 ID（→ 02、`../PostgreSQL/04-identity-columns.md`） |
| `item` | `VARCHAR(20) NOT NULL` | 項目名（最大 20 文字） |
| `amount` | `INTEGER NOT NULL` | 金額（円）。**収入は正、支出は負**（`../Architecture/09-domain-modeling-signed-amount.md`） |
| `date` | `DATE NOT NULL` | 日付（時刻なし） |

## 各層のルールの比較

| ルール | フロント（`Input.tsx`） | OpenAPI（`openapi.yaml:102-118`） | backend（`index.ts:81-91`） | DB |
| --- | --- | --- | --- | --- |
| item 必須 | `required` | `required`、`minLength: 1` | `!item` で 400 | `NOT NULL`（空文字 `''` は通る） |
| item の長さ | `maxLength={20}`（89 行目） | **上限なし** | **チェックなし** | `VARCHAR(20)` |
| amount の型 | `type="number"`、`min={0}` | `type: number`（小数も可） | `typeof amount === "number"` | `INTEGER`（整数のみ、約 ±21 億） |
| amount ≠ 0 | なし（送信時に符号を付けるだけ） | `not: const: 0` | `amount === 0` で 400 | **制約なし** |
| date の形式 | `type="date"` | `format: date` + pattern | 正規表現 `^\d{4}-\d{2}-\d{2}$` | `DATE`（実在しない日付はエラー） |

### ずれが起こす問題（実験で確認）

`pg` から一時テーブルに INSERT して確認した結果：

| API に送られた値 | backend の検証 | DB の結果 | API のレスポンス |
| --- | --- | --- | --- |
| item が 21 文字 | 通過 | `22001 value too long for type character varying(20)` | **500** |
| amount が `1.5` | 通過 | `22P02 invalid input syntax for type integer: "1.5"` | **500** |
| amount が `2147483648` | 通過 | `22003 value "2147483648" is out of range for type integer` | **500** |
| date が `2025-02-30` | 正規表現は通過 | `22008 date/time field value out of range` | **500** |

どれも **利用者の入力ミス（本来は 400）** なのに、backend が検証せずに DB まで送ってしまい、DB のエラーが捕捉されずに 500 になります（Hono の既定のエラー処理 → `../Hono/10-default-error-and-not-found.md`）。

フロントは `maxLength` などで多くを防いでいますが、API を直接呼べば（curl など）すり抜けます。また、HTML の `maxLength` は UTF-16 の単位で数えるため、絵文字は 1 文字で 2 と数えられます。DB の `VARCHAR(20)` は文字数で数えるので、絵文字 20 個（JS の `length` は 40）は DB には入りました（実験で確認）。フロントの方が厳しい分には問題になりません。

## 改善案

### 1. DB に CHECK 制約を足す（最後の砦を固くする）

```sql
ALTER TABLE transactions
  ADD CONSTRAINT transactions_amount_nonzero CHECK (amount <> 0),
  ADD CONSTRAINT transactions_item_not_blank CHECK (length(trim(item)) > 0);
```

- `amount = 0` は backend で弾いていますが、psql から直接入れたり、将来別の経路（一括インポートなど）ができたりすると入ってしまいます。DB の制約なら **どの経路でも** 守られます。
- 既存のデータが制約に違反していると、`ALTER TABLE` 自体が失敗します。

### 2. backend の検証を DB の制約に合わせる

Zod のスキーマで「DB に入るかどうか」まで検証すれば、500 はなくなり、すべて 400 で返せます。

```ts
// 案：Zod 4
const TransactionInput = z.object({
  item: z.string().trim().min(1).max(20),
  amount: z.number().int().refine((n) => n !== 0).min(-2147483648).max(2147483647),
  date: z.iso.date(), // 実在する日付かどうかまで検証する
});
```

そのうえで OpenAPI にも `maxLength: 20`、`type: integer` を書き、**フロント・OpenAPI・backend・DB のルールを 1 つの基準に揃えます**（`../Architecture/12-validation-layers.md`）。

### 3. 将来の拡張で検討すること

| 課題 | 案 |
| --- | --- |
| 収入 / 支出を符号で表している | `type`（`'income'` / `'expense'`）列を持ち、`amount` は常に正にする設計もある（`../Architecture/09-domain-modeling-signed-amount.md`）。どちらにするかはドメインの判断 |
| 項目名が自由入力 | 「食費」「交通費」などのカテゴリを別テーブル `categories` にし、`transactions.category_id` で参照する（**正規化**、外部キー） |
| いつ登録したかが分からない | `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` を追加する |
| 一覧の並びが不安定 | `ORDER BY date DESC` だけだと同じ日付の行の順番が決まらない。`ORDER BY date DESC, id DESC` にする（`../SQL/07-order-by.md`） |
| ユーザーが 1 人前提 | ログイン機能を作るなら `users` テーブルと `transactions.user_id` が必要 |

## 重要語句

| 用語 | 意味 |
| --- | --- |
| **制約（constraint）** | DB が強制するルール。`NOT NULL`、`UNIQUE`、`PRIMARY KEY`、`CHECK`、`FOREIGN KEY` など |
| **CHECK 制約** | 任意の条件式を満たさない行を拒否する制約 |
| **正規化** | 同じ情報を何度も持たないようにテーブルを分割すること |
| **外部キー（FOREIGN KEY）** | 別のテーブルの主キーを参照し、存在しない値を入れられないようにする制約 |

## 仕様・注意点

- **`DATE` と `TIMESTAMPTZ` の違い**：家計簿の「日付」は時刻もタイムゾーンも関係ない「カレンダー上の日」なので `DATE` が適しています。一方、「登録日時」のような「ある瞬間」は `TIMESTAMPTZ`（タイムゾーン付き）で持つのが定石です。
- **`DATE` を JS で扱うときの落とし穴**：`pg` は `DATE` を JS の `Date`（ローカル時刻の 0 時）に変換します。backend の `toYMD` はローカル時刻のメソッドを使っているので正しく動きますが、`toISOString()` を使うと日本時間では 1 日ずれます（`../PostgreSQL/07-node-postgres-type-conversion.md`）。
- **制約を後から足すのは、先に足すより大変**：違反データの掃除が必要になるため。テーブルを作る段階で「どんな値が入ってはいけないか」を考えておくと楽です。

## 今後に活かせるポイント

- 「DB の制約」と「API のバリデーション」は役割が違う。**DB はデータを守る最後の砦、API は利用者に分かりやすいエラー（400 とメッセージ）を返す窓口**。両方必要で、ルールは揃えておく。
- 新しい列や制約を足すときは、「フロント・OpenAPI・backend・DB のどこを直す必要があるか」を一覧で確認する。

## 次に学ぶこと

- テーブル定義の変更を安全に管理する方法（→ 04）
- 外部キーと JOIN（カテゴリテーブルを作るとき）

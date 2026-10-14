# 文字列リテラル型とユニオン型

## 概要

`"income" | "expense"` のように書くと、「`"income"` か `"expense"` のどちらかの文字列だけ」を許す型になります。

- **リテラル型**: `"income"` という *特定の値そのもの* を表す型
- **ユニオン型 `|`**: 「A または B」を表す型

`string` だと「どんな文字列でも OK」ですが、ユニオン型にすると取りうる値を限定でき、タイプミス（`"incom"` など）をコンパイル時に検出できます。

## このプロジェクトでの実装

`web-app/src/pages/Input.tsx:17`

```ts
type TransactionType = "income" | "expense";

function InputPage() {
  const [transactionType, setTransactionType] =
    useState<TransactionType>("expense");
```

- `useState<TransactionType>("expense")` とすることで、`transactionType` の型は `"income" | "expense"` になり、`setTransactionType("other")` はコンパイルエラーになります。
- 型引数を付けずに `useState("expense")` と書くと、推論される型は `string` になってしまいます（`useState` の `S` は初期値から推論され、`let` と同じく文字列リテラルは `string` に広げられるため）。ここで型引数を明示しているのはそのためです。

`web-app/src/pages/Input.tsx:34`

```ts
if (transactionType === "expense" && adjustAmount > 0) {
  adjustAmount = -adjustAmount;
}
```

- 比較対象の文字列もチェックされます。`transactionType === "expence"` のようにタイプミスすると、「この比較は常に false になる（型に重なりがない）」というエラーになります。

ユニオン型は文字列以外にも使われています（`web-app/src/hooks/transactions.ts:15`）。

```ts
transactionList: TransactionListInfo | undefined;
error: Error | null;
```

これは「オブジェクト型 または undefined」「Error または null」というユニオン型です（→ `10-undefined-vs-null.md`）。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| リテラル型 | `"income"`、`42`、`true` など、特定の値だけを許す型 |
| ユニオン型 (union type) | `A \| B`。A か B のどちらか |
| widening（型の拡大） | `let x = "a"` のように変更可能な場所では、リテラル型が `string` に広げられる推論の挙動 |
| 網羅性チェック (exhaustiveness check) | ユニオン型のすべてのケースを処理したかをコンパイラに確認させるテクニック |

## 仕様・注意点

- `const x = "income"` の型は `"income"`（リテラル型）、`let x = "income"` の型は `string` になります。これが widening です。
- ユニオン型の値は、そのままでは「全メンバーに共通する操作」しかできません。どちらか一方に固有の操作をするには、`===` や `typeof` などで **絞り込み (narrowing)** をする必要があります（→ `16-control-flow-narrowing.md`）。
- **バックエンドではユニオン型が使われていません。** `backend/src/index.ts:32` では

  ```ts
  if (!type || !["income", "expense", "all"].includes(type)) {
  ```

  と文字列配列で検証しており、このチェックの後も `type` の型は `string` のままです（`includes` は型を絞り込まない）。
- `Input.tsx` の `TransactionType` は `"income" | "expense"` ですが、API の `type` クエリは `"income" | "expense" | "all"` を受け付けます。同じ概念でも場所ごとに別定義になっている点は `29-type-sharing-fe-be.md` で扱います。

## 今後に活かせるポイント

- 「決まった選択肢のどれか」を表す値（ステータス、種別、モードなど）は `string` ではなくリテラルのユニオン型にする。
- 値の配列と型を同時に定義するパターン（`as const`）を覚えておくと、実行時チェックと型を一致させられます。

  ```ts
  const TRANSACTION_TYPES = ["income", "expense"] as const;
  type TransactionType = (typeof TRANSACTION_TYPES)[number]; // "income" | "expense"
  ```

- `enum` の代わりにリテラルユニオンを使うのが現在の主流です。このプロジェクトの web-app は `erasableSyntaxOnly: true` なので、そもそも `enum` は使えません（→ `22-tsconfig-verbatim-erasable.md`）。

## 改善するなら

`as const` の配列から型を作れば、バックエンドの `includes` チェックを「型ガード」にでき、チェック後に `type` を正しく絞り込めます。

```ts
const QUERY_TYPES = ["income", "expense", "all"] as const;
type QueryType = (typeof QUERY_TYPES)[number];

const isQueryType = (v: string | undefined): v is QueryType =>
  v !== undefined && (QUERY_TYPES as readonly string[]).includes(v);

const type = c.req.query("type");
if (!isQueryType(type)) {
  return c.json({ message: "..." }, 400);
}
// ここでは type: "income" | "expense" | "all"
```

`switch` で網羅性チェックをする例:

```ts
const label = (t: TransactionType): string => {
  switch (t) {
    case "income":
      return "収入";
    case "expense":
      return "支出";
    default: {
      const _exhaustive: never = t; // ケースを追加し忘れるとここでエラー
      return _exhaustive;
    }
  }
};
```

## 次に学ぶこと

- `as const`（const アサーション）と `(typeof arr)[number]`
- 判別可能ユニオン (discriminated union): `{ status: "loading" } | { status: "success"; data: T } | { status: "error"; error: Error }`
- `never` 型と網羅性チェック
- 型ガード関数 `v is T`（→ `14-runtime-validation.md`）

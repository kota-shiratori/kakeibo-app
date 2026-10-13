# `T | undefined` と `T | null` の使い分け

## 概要

JavaScript には「値がない」ことを表す値が `undefined` と `null` の 2 つあります。TypeScript の `strict` モード（正確には `strictNullChecks`）では、これらは別々の型として扱われ、`string` 型の変数に `null` や `undefined` を入れることはできません。「値がないかもしれない」ときは `T | undefined` や `T | null` とユニオン型で明示します。

このプロジェクトでは両方が登場し、意味によって使い分けられています。

## このプロジェクトでの実装

`web-app/src/hooks/transactions.ts:14`

```ts
export type TransactionsHooks = {
  transactionList: TransactionListInfo | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};
```

| プロパティ | 型 | 「値がない」の由来 |
| --- | --- | --- |
| `transactionList` | `TransactionListInfo \| undefined` | `useState<TransactionListInfo>()` と初期値なしで作ったので、最初は `undefined`（`web-app/src/hooks/useIncomeTransactions.ts:6`）。「まだ取得していない」状態 |
| `error` | `Error \| null` | `useState<Error \| null>(null)` と **明示的に `null` を初期値にした**（`useIncomeTransactions.ts:8`）。「エラーが無い」状態。`setError(null)` でリセットしている（`:12`） |

その他の `null` / `undefined` の出どころ:

- `document.getElementById("root")` の戻り値は `HTMLElement | null`（DOM の API が「見つからなければ `null`」と決めている。`web-app/node_modules/typescript/lib/lib.dom.d.ts:13080`）→ `12-non-null-assertion.md`
- Hono の `c.req.query("type")` は `string | undefined`（クエリが無ければ `undefined`）。`backend/src/index.ts:19`
- Chakra UI の RadioGroup の `onValueChange` で渡される `e.value` は `string | null`（`web-app/node_modules/@zag-js/radio-group/dist/radio-group.types.d.ts:5`）→ `13-type-assertion-as.md`

## 重要語句

| 用語 | 意味 |
| --- | --- |
| undefined | 「未定義」。変数の初期化前、存在しないプロパティ、引数の省略、`return` のない関数の戻り値など、JS が自動的に使う |
| null | 「意図的に空」。プログラマが明示的に代入する |
| strictNullChecks | `null` / `undefined` を他の型と区別する設定。`strict: true` に含まれる |
| オプショナルプロパティ `?` | `x?: T`。プロパティ自体が無くてもよい（読むと `T \| undefined`） |
| null 合体演算子 `??` | 左辺が `null` か `undefined` のときだけ右辺を使う |

## 仕様・注意点

- **`x?: T` と `x: T | undefined` は違います。** 前者はプロパティを省略できますが、後者は `{ x: undefined }` と書く必要があります（キーは必須）。`TransactionsHooks` の `transactionList` は後者なので、フックの戻り値には `transactionList` キーを必ず含める必要があります。
  - さらに厳密に区別したい場合は `exactOptionalPropertyTypes` オプションがあります（このプロジェクトでは未使用）。
- `== null`（ゆるい等価）は `null` と `undefined` の両方にマッチします。`=== null` は `null` のみです。
- JSON には `undefined` がありません。API レスポンスで「値なし」を表すと `null` になるか、キーごと省略されます。API の境界では `null` が出てくることを想定しておきましょう。
- `typeof null === "object"` という JavaScript の歴史的な仕様にも注意（`typeof` による絞り込みで `object` を判定するとき `null` が混ざる）。

## 今後に活かせるポイント

よく使われる使い分けの方針（このプロジェクトもおおむねこれに沿っています）:

- **`undefined`**: 「まだ無い」「省略された」— 初期化前のデータ、省略可能な引数・プロパティ
- **`null`**: 「無いことが確定している」「意図的に空にした」— エラー無し、未選択、DOM API の「見つからない」

どちらか一方に統一する流派（例: TypeScript コンパイラ自体のコードは `undefined` 中心）もあります。大事なのはプロジェクト内で揃えることです。

## 改善するなら

`transactionList` と `error` と `isLoading` を別々の state で持つと、`undefined` / `null` の組み合わせを毎回考える必要があります。判別可能ユニオンで「状態」を 1 つにすれば、`undefined` / `null` チェックそのものが不要になります（→ `09-generics-usestate.md` の「改善するなら」）。

また、RadioGroup の `e.value` が `null` になるケースを型どおりに扱うなら、次のように書けます。

```ts
onValueChange={(e) => {
  if (e.value === "income" || e.value === "expense") {
    setTransactionType(e.value); // ここでは "income" | "expense" に絞り込まれている
  }
}}
```

## 次に学ぶこと

- オプショナルチェーン `?.` と null 合体 `??` → `11-optional-chaining.md`
- `exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`（配列アクセスに `| undefined` を付ける）
- `NonNullable<T>` ユーティリティ型

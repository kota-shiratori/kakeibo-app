# 制御フロー解析による型の絞り込み（narrowing）

## 概要

TypeScript は `if` / `return` / `throw` / 三項演算子 / `&&` などの **コードの流れ（制御フロー）を追跡** し、「この地点ではこの変数はこの型のはず」と型を自動で狭めてくれます。これを **絞り込み (narrowing)** と呼び、ユニオン型（`T | undefined`、`Error | null`、`unknown` など）を安全に扱うための中心的な仕組みです。

型アサーション `as` や `!` と違い、**実際に実行時のチェックを書いた結果として** 型が狭まるので安全です。

## このプロジェクトでの実装

### 早期 return による絞り込み

`web-app/src/components/TransactionList.tsx:78`（説明用に元のコメントを省き、`// ここでは ...` のコメントを追記・一部整形しています）

```ts
const RecentTransactionList = ({ hooks, maxTransactions }: RecentTransactionListComponentProps) => {
  const { transactionList, isLoading, error } = hooks;

  if (isLoading) {
    return <Spinner />;
  }

  if (error) {
    // ここでは error: Error
    return <Text color="red.500">{error.message}</Text>;
  }
  // ここでは error: null

  if (!transactionList?.transactions.length) {
    return <Text>取引はまだありません。</Text>;
  }
  // ここでは transactionList: TransactionListInfo（undefined が除かれている）

  const recentTransactions = transactionList.transactions.slice(0, maxTransactions);
  return <TransactionList transactions={recentTransactions} />;
};
```

- `if (error)` の中では `error` は `Error | null` から `null` が除かれ `Error` になるので、`error.message` にアクセスできます（**truthiness による絞り込み**）。
- `if (!transactionList?.transactions.length) return ...` の後では、`transactionList` が `undefined` だったら必ず return しているので、`TransactionListInfo` に絞り込まれます。そのため `transactionList.transactions` を `?.` なしで書けます。

### JSX 内の `&&` による絞り込み

`web-app/src/pages/Input.tsx:111`

```tsx
{error && <Text color="red.500">{error.message}</Text>}
```

`&&` の右側は左側が truthy のときだけ評価されるので、右側では `error` は `Error` です。

### 三項演算子 + instanceof

`web-app/src/hooks/useAddTransactions.ts:25`

```ts
err instanceof Error ? err : new Error("不明なエラーが発生しました。")
```

→ `15-catch-unknown-instanceof.md`

### 等価比較 `===`

`web-app/src/pages/Input.tsx:34`

```ts
if (transactionType === "expense" && adjustAmount > 0) {
```

`transactionType` は `"income" | "expense"` で、この条件の中では `"expense"` に絞り込まれます。

### typeof（backend）

`backend/src/index.ts:85-87`

```ts
if (typeof amount !== "number" || amount === 0) {
  return c.json({ message: "金額は0以外の数値である必要があります。" }, 400);
}
```

`typeof` は代表的な型ガードです。ただしここでは `amount` が `any`（`c.req.json()` 由来）なので、型の上での恩恵はありません（→ `17-any-propagation.md`）。もし `amount` が `unknown` なら、この後ろで `number` に絞り込まれます。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 制御フロー解析 (control flow analysis) | 分岐や return を追って、各地点の型を計算するコンパイラの仕組み |
| narrowing | ユニオン型などを、条件によってより狭い型にすること |
| 型ガード (type guard) | 絞り込みを引き起こす式。`typeof`, `instanceof`, `in`, `===`, truthiness, 型述語関数 |
| truthiness narrowing | `if (x)` で falsy な型（`null`, `undefined` など）を除外する絞り込み |
| 早期 return (early return / guard clause) | 条件を満たさない場合に先に関数を抜け、以降の処理を単純にする書き方 |

## 仕様・注意点

- **truthiness は `0` や `""` も除外します。** `if (amount)` だと `0` が弾かれます。`number | undefined` から `undefined` だけ除きたいなら `amount !== undefined` と書きます。
- **関数をまたぐと絞り込みが消えることがあります。** コールバック関数の中では、外側で絞り込んだ `let` 変数の型が元に戻ることがあります（その間に再代入される可能性があるため）。`const` なら維持されやすいです。
- **`Array.prototype.includes` は型を絞り込みません。** `["income", "expense", "all"].includes(type)`（`backend/src/index.ts:32`）の後でも `type` は `string` のままです（→ `03-literal-union-types.md`）。
- オブジェクトのプロパティ（`hooks.error` など）も絞り込まれますが、そのプロパティ（や途中のオブジェクト）へ代入すると絞り込みが解除され、コールバック関数の中には絞り込みが引き継がれません（なお、途中で普通の関数呼び出しを挟んでも TypeScript は絞り込みを解除しません。関数がプロパティを書き換えても検出できない、という意図的なトレードオフです）。このプロジェクトのように **分割代入で `const` のローカル変数に取り出してから** 判定すると確実です。

## 今後に活かせるポイント

- 「異常系を先に return して、最後に正常系を書く」早期 return スタイルは、型の絞り込みと相性が良く、ネストも浅くなります。
- 独自の型ガード関数（`v is T`）を作れば、複雑な判定も絞り込みに使えます（→ `14-runtime-validation.md`）。
- 判別可能ユニオンなら、`switch (state.status)` だけで各ケースのプロパティを安全に扱えます。

## 改善するなら

`isLoading` / `error` / `transactionList` が独立した値なので、「`isLoading` が false、`error` が null、`transactionList` が undefined」という状態も型の上ではあり得ます（現状は「取引はまだありません」と表示される）。判別可能ユニオンにすれば、絞り込みで状態ごとの値が確定します。

```ts
type TransactionsState =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: TransactionListInfo };

switch (state.status) {
  case "loading":
    return <Spinner />;
  case "error":
    return <Text color="red.500">{state.error.message}</Text>; // error がある
  case "success":
    return <TransactionList transactions={state.data.transactions.slice(0, maxTransactions)} />;
}
```

## 次に学ぶこと

- 判別可能ユニオンと `never` による網羅性チェック
- `in` 演算子による絞り込み（`"message" in body`）
- アサーション関数 `asserts x is T`
- TypeScript 5.5 の「推論される型述語」（`arr.filter((x) => x !== undefined)` の結果が自動で絞り込まれる）

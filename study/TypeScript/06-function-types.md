# 関数型の書き方（`() => void`、`(t: X) => Promise<boolean>`）

## 概要

TypeScript では「関数そのもの」も型で表せます。`(引数名: 引数の型) => 戻り値の型` という矢印の形で書きます。オブジェクトのプロパティに関数を持たせるとき（フックの戻り値など）や、関数を引数として受け取るときに使います。

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

- `refetch: () => void` は「引数なし・戻り値を使わない関数」。

`web-app/src/hooks/transactions.ts:23`

```ts
export type AddTransactionHooks = {
  addTransaction: (transaction: NewTransaction) => Promise<boolean>;
  isLoading: boolean;
  error: Error | null;
};
```

- `addTransaction` は「`NewTransaction` を 1 つ受け取り、`boolean` を返す Promise を返す関数」。成功なら `true`、失敗なら `false` で解決します。
- 型の中の引数名（`transaction`）はドキュメント的な意味しかなく、実装側で別名にしてもかまいません。

実装側の `async` 関数（`web-app/src/hooks/useAddTransactions.ts:9`）:

```ts
const addTransaction = async (transaction: NewTransaction) => {
  ...
  try {
    ...
    return true;
  } catch (err) {
    ...
    return false;
  } finally {
    setIsLoading(false);
  }
};
```

- **`async` 関数の戻り値は必ず Promise になります。** 本体で `return true` / `return false` しているので、推論される型は `Promise<boolean>` です。これが `AddTransactionHooks["addTransaction"]` の型と一致するため、戻り値オブジェクトに入れられます。

`refetch` の実装（`web-app/src/hooks/useIncomeTransactions.ts:10`, `:38`）:

```ts
const fetchIncomeTransactions = async () => { ... }; // 型は () => Promise<void>
...
refetch: fetchIncomeTransactions,
```

- 実体は `() => Promise<void>` ですが、型は `() => void` です。**戻り値が `void` の関数型には、何かを返す関数も代入できる** というルールがあるため、エラーになりません（後述）。

普通の関数宣言に型を付ける例（`web-app/src/components/TransactionList.tsx:180`）:

```ts
const formatDate = (dateString: string): string => {
  const parts = dateString.split("-");
  return `${parts[0]}年${parts[1]}月${parts[2]}日`;
};
```

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 関数型 (function type) | `(a: A, b: B) => R` の形で書く関数の型 |
| void | 「戻り値を使わない」ことを表す型 |
| Promise\<T\> | 将来 `T` 型の値で解決される非同期処理の型 |
| async 関数 | 戻り値が自動で Promise に包まれる関数 |
| メソッド記法 | `refetch(): void` のようにオブジェクト型の中でメソッドとして書く方法 |

## 仕様・注意点

- **`void` 戻り値の代入互換性**: `() => void` 型の変数には `() => Promise<void>` や `() => number` も代入できます。「戻り値を無視するので何を返してもよい」という扱いだからです。便利な反面、**呼び出し側は Promise が返ってきていることに気付けず、`await` もエラー処理もできない** という弱点があります（例: `refetch()` が失敗しても呼び出し側では分からない）。
- ただし、関数 *宣言* に直接 `: void` と書いた場合は、値を `return` するとエラーになります。互換ルールが効くのは「関数型への代入」の場面だけです。
- **関数プロパティ記法 `f: (x: T) => R` と メソッド記法 `f(x: T): R` の違い**: `strictFunctionTypes`（`strict` に含まれる）が厳密にチェックするのは前者だけで、メソッド記法の引数は互換性チェックが緩く（双変, bivariant）なります。このプロジェクトのように関数プロパティ記法で書くほうが安全です。
- 引数の数: 少ない引数の関数は、多い引数を受け取る関数型に代入できます（`arr.map((x) => ...)` で index を省略できるのと同じ理屈）。

## 今後に活かせるポイント

- コールバックやフックの戻り値の関数は、型エイリアスの中で `(引数) => 戻り値` 形式で明示しておく。
- 非同期関数を公開するなら、戻り値は `void` ではなく `Promise<void>` と書くと、呼び出し側で `await` できることが型から伝わります。
- 成否を `boolean` で返すのはシンプルですが、失敗理由が必要になったら Result 型（`{ ok: true; data } | { ok: false; error }`）が選択肢になります。

## 改善するなら

`refetch` が非同期であることを型に反映すると、呼び出し側で完了を待てるようになります。

```ts
export type TransactionsHooks = {
  transactionList: TransactionListInfo | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};
```

`addTransaction` で失敗理由も返したいなら Result 型にする例:

```ts
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

addTransaction: (transaction: NewTransaction) => Promise<Result<Transaction>>;
```

## 次に学ぶこと

- 関数のオーバーロード（`useState` の型定義が 2 つあるのはこれ → `09-generics-usestate.md`）
- `ReturnType<F>` / `Parameters<F>` で関数型から型を取り出す
- Result 型 / 判別可能ユニオンによるエラー表現
- `strictFunctionTypes` と変性 (variance)

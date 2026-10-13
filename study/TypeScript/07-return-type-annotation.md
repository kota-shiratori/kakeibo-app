# 戻り値の型注釈（`: TransactionsHooks`）

## 概要

関数の引数リストの後ろに `: 型` を書くと、**戻り値の型を明示** できます。書かなくても TypeScript は本体から推論してくれますが、明示すると「この関数はこういう値を返す約束だ」という契約になり、実装が約束を破ったときに関数の中でエラーが出るようになります。

## このプロジェクトでの実装

`web-app/src/hooks/useIncomeTransactions.ts:5`

```ts
export const useIncomeTransactions = (): TransactionsHooks => {
  const [incomeList, setIncomeList] = useState<TransactionListInfo>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  ...
  return {
    transactionList: incomeList,
    isLoading,
    error,
    refetch: fetchIncomeTransactions,
  };
};
```

- `(): TransactionsHooks` の `()` は引数なし、`: TransactionsHooks` が戻り値の型。
- `useExpenseTransactions`（`web-app/src/hooks/useExpenseTransactions.ts:5`）も同じ `TransactionsHooks` を返すので、**2 つのフックが同じ形を返すことが型で保証**されます。だからこそ `TransactionList.tsx` の共通コンポーネント `RecentTransactionList` が、どちらのフックの戻り値でも `hooks: TransactionsHooks` として受け取れます（`web-app/src/components/TransactionList.tsx:74`）。
- `useAddTransactions` も `(): AddTransactionHooks` と注釈しています（`web-app/src/hooks/useAddTransactions.ts:5`）。

`formatDate`（`web-app/src/components/TransactionList.tsx:180`）でも `: string` を明示しています。

```ts
const formatDate = (dateString: string): string => { ... };
```

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 戻り値の型注釈 | `function f(): T` / `const f = (): T => ...` の `: T` |
| 型推論 | 注釈がないとき、コンパイラが式から型を決めること |
| 契約 (contract) | 「この関数はこの型を返す」という、呼び出し側との約束 |

## 仕様・注意点

- **エラーが出る場所が変わる**: 戻り値型を書かない場合、`return` するオブジェクトのプロパティ名を間違えても関数自体はエラーにならず、*使う側* で初めてエラーになります。書いておけば *関数の中の return 文* でエラーになり、原因箇所がすぐ分かります。
- **余剰プロパティチェックも働く**: 戻り値型を注釈したうえでオブジェクトリテラルを `return` すると、型に無いプロパティを書いたときにエラーになります。
- **async 関数の戻り値型は `Promise<...>` で書く**: `async (): boolean => ...` はエラーです。`async (): Promise<boolean> => ...` と書きます。
- 戻り値型を注釈すると、推論された「より詳しい型」は失われ、注釈した型として扱われます（例: 実体は `() => Promise<void>` の `refetch` も、外からは `() => void` に見える）。

## 今後に活かせるポイント

- **export する関数（特にカスタムフックや API クライアント）には戻り値型を書く**。モジュールの公開インターフェースが明確になり、実装を変えたときの意図しない型の変化を防げます。
- ファイル内部の小さな関数は推論に任せてもよい、というバランスが一般的です。
- ライブラリを作る場合、TypeScript 5.5 で入った `isolatedDeclarations` を有効にすると、export する関数の戻り値型の明示が必須になります（型定義ファイルの高速生成のため）。

## 改善するなら

現状は良い書き方です。さらに進めるなら、`useIncomeTransactions` と `useExpenseTransactions` はほぼ同じ実装なので、引数で種別を受け取る 1 つのフックにまとめると、戻り値型の約束も 1 か所で済みます。

```ts
type TransactionKind = "income" | "expense";

export const useTransactions = (kind: TransactionKind): TransactionsHooks => {
  const [list, setList] = useState<TransactionListInfo>();
  ...
  const response = await fetch(`${BASE_URL}/transactions?type=${kind}`);
  ...
};
```

## 次に学ぶこと

- `satisfies` 演算子: 型チェックはしたいが、推論された詳しい型は残したいときに使う
- `isolatedDeclarations` と型定義ファイル (.d.ts) の生成
- `ReturnType<typeof useIncomeTransactions>` で逆に関数から型を取り出す方法

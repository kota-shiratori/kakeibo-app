# 分割代入と引数の型注釈（props に型を付ける）

## 概要

関数の引数で `({ a, b }: 型)` と書くと、「オブジェクトを受け取り、そのプロパティ `a` と `b` を取り出す（分割代入）」と「そのオブジェクト全体に型を付ける」を同時に行えます。React コンポーネントの props に型を付けるときの定番の書き方です。ここでは TypeScript の文法として整理します。

## このプロジェクトでの実装

`web-app/src/components/TransactionList.tsx:33`

```ts
export const RecentIncomeTransactionList = ({
  maxTransactions,
}: RecentTransactionListProps) => {
```

- `: RecentTransactionListProps` は **分割代入した各変数ではなく、引数のオブジェクト全体** に付く型注釈です。
- 次のコードと同じ意味です（ソース中のコメント `TransactionList.tsx:36` でも説明されています）。

  ```ts
  (props: RecentTransactionListProps) => {
    const maxTransactions = props.maxTransactions;
  }
  ```

`web-app/src/pages/Home.tsx:54`

```ts
type SummaryCardProps = {
  title: string;
  children: ReactNode;
};

const SummaryCard = ({ title, children }: SummaryCardProps) => { ... };
```

- `ReactNode` は React が提供する「JSX の子要素として置けるもの全般」の型です（文字列、数値、JSX 要素、配列、`null` など）。`import type { ReactNode } from "react"`（`Home.tsx:10`）で型だけを読み込んでいます。

関数本体内での分割代入（`web-app/src/components/TransactionList.tsx:82`）:

```ts
const { transactionList, isLoading, error } = hooks;
```

- `hooks` が `TransactionsHooks` 型なので、取り出した各変数にも自動で型が付きます（`transactionList: TransactionListInfo | undefined` など）。型注釈は不要です。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 分割代入 (destructuring) | `const { a } = obj` / `const [x, y] = arr` のように値を取り出す JavaScript の構文 |
| 引数の型注釈 | `(x: T) => ...` の `: T` |
| ReactNode | React の子要素として描画可能な値の型 |
| デフォルト値 | `({ max = 3 }: Props)` のように、分割代入時に `undefined` の場合の値を指定できる |

## 仕様・注意点

- **よくある間違い**: `({ maxTransactions: number })` と書くと、型注釈ではなく「`maxTransactions` を `number` という名前の変数に取り出す（リネーム）」という意味になります。型は必ず `}` の外側に `: 型` で書きます。

  ```ts
  ({ maxTransactions: number }) => {}            // NG: リネーム。型は付かない（引数は暗黙の any → strict ではエラー）
  ({ maxTransactions }: { maxTransactions: number }) => {} // OK
  ```

- オプショナルなプロパティ（`max?: number`）にデフォルト値を付けると、関数内では `undefined` が除かれた `number` 型として扱われます。
- `children` の型として、React 18 以降の `@types/react` では `React.FC` が暗黙に `children` を含まなくなったため、このプロジェクトのように props の型で明示的に `children: ReactNode` と書くのが標準的です。

## 今後に活かせるポイント

- props の型は `XxxProps` という名前の `type` にして、コンポーネントの直前に置くと読みやすい（このプロジェクトの書き方）。
- 引数が 3 つ以上になりそうな関数は、オブジェクト 1 つを分割代入で受け取る形にすると、呼び出し側で引数の順番を間違えにくくなります。

## 改善するなら

`maxTransactions` を省略可能にしてデフォルト値を持たせると、呼び出し側が楽になります。

```ts
type RecentTransactionListProps = {
  maxTransactions?: number;
};

export const RecentIncomeTransactionList = ({
  maxTransactions = 3,
}: RecentTransactionListProps) => { ... }; // 関数内では number
```

## 次に学ぶこと

- `React.ComponentProps<typeof Comp>` で既存コンポーネントの props 型を取り出す
- `PropsWithChildren<P>` ユーティリティ型
- 配列の分割代入とタプル型（`useState` の戻り値 `[S, Dispatch<...>]` → `09-generics-usestate.md`）

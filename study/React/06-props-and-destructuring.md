# props と分割代入

## 概要

**props** は、親コンポーネントから子コンポーネントへ渡すデータです。関数で言えば「引数」にあたります。
同じ部品に違う props を渡すことで、1 つのコンポーネントをいろいろな場面で使い回せます。

props は 1 つのオブジェクトとして渡ってくるので、受け取る側では **分割代入** で必要なプロパティを取り出すのが一般的です。

## このプロジェクトでの実装

### 渡す側（親）

`web-app/src/pages/Home.tsx:39-41`

```tsx
<SummaryCard title="収入履歴">
  <RecentIncomeTransactionList maxTransactions={3} />
</SummaryCard>
```

- `title="収入履歴"` … 文字列の props
- `maxTransactions={3}` … 数値の props（数値・真偽値・オブジェクトなど文字列以外は `{}` で渡す）

### 受け取る側（子）: 型を定義して分割代入

`web-app/src/components/TransactionList.tsx:22-35`

```tsx
type RecentTransactionListProps = {
  maxTransactions: number; // 最大何件まで表示するか
};

export const RecentIncomeTransactionList = ({
  maxTransactions,
}: RecentTransactionListProps) => {
  // ↑ ({ maxTransactions }: 型) は分割代入 + 型注釈。
  //   (props: 型) => { const maxTransactions = props.maxTransactions; } と同じ意味。
```

コメントにある通り、次の 2 つは同じ意味です。

```tsx
// 分割代入あり
const Comp = ({ maxTransactions }: RecentTransactionListProps) => { /* maxTransactions を使う */ };

// 分割代入なし
const Comp = (props: RecentTransactionListProps) => {
  const maxTransactions = props.maxTransactions;
};
```

### props の型を組み合わせる

`web-app/src/components/TransactionList.tsx:74-82`

```tsx
type RecentTransactionListComponentProps = RecentTransactionListProps & {
  hooks: TransactionsHooks; // useIncomeTransactions / useExpenseTransactions の戻り値
};

const RecentTransactionList = ({
  hooks,
  maxTransactions,
}: RecentTransactionListComponentProps) => {
  const { transactionList, isLoading, error } = hooks;
```

- `&` で型を合成しています（型の詳細は study/TypeScript 参照）。
- 関数の引数で props を分割代入したあと、さらに関数本体で `hooks` オブジェクトを分割代入しています。分割代入は props 以外の普通のオブジェクトにも使えます。

### props をそのまま下へ渡す（バケツリレー）

`web-app/src/components/TransactionList.tsx:44-49`

```tsx
return (
  <RecentTransactionList
    hooks={incomeTransactions}
    maxTransactions={maxTransactions}
  />
);
```

`Home` → `RecentIncomeTransactionList` → `RecentTransactionList` と `maxTransactions` を受け渡しています。このように props を何段も中継することを俗に「props のバケツリレー（prop drilling）」と呼びます。2〜3 段程度なら問題ありません。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| props | 親から子に渡すデータ。子の関数の第 1 引数（オブジェクト）として届く |
| 分割代入（destructuring） | `const { a, b } = obj` のように、オブジェクトや配列から値を取り出して変数にする構文 |
| 型注釈 | `: RecentTransactionListProps` のように、変数や引数に型を書くこと |
| prop drilling | props を中間コンポーネントで何段も中継すること |

## 仕様・注意点

- **props は読み取り専用。** 子コンポーネントの中で `props.maxTransactions = 5` のように書き換えてはいけません。値を変えたいなら親の state を変える（子には「変える関数」を props で渡す）のが React の流儀です（一方向データフロー）。
- props の値が変わると子コンポーネントは再描画されます。また、**親が再描画されると、props が変わっていなくても子は基本的に再描画されます**（`React.memo` で抑制できる）。
- 分割代入では **既定値** も指定できます: `({ maxTransactions = 3 }: Props)`。その場合は型を `maxTransactions?: number` と省略可能にします。
- `key` と（React 19 より前の）`ref` は特別扱いで、普通の props としては子に届きません。React 19 では関数コンポーネントで `ref` を props として受け取れるようになりました。`key` は今も子には届きません。

## 今後に活かせるポイント

- 「props の型を `type XxxProps = {...}` として定義 → 引数で分割代入」は React + TypeScript の定番の形。
- 似たコンポーネントで props の形が同じなら、型を共有する（このプロジェクトの `RecentTransactionListProps` のように）。
- 型を `&` で合成すると、「共通 props + 固有 props」を表現できる。

## 改善するなら

`hooks` という props 名は「フックそのもの（関数）」を渡しているように読めますが、実際に渡しているのは **フックの戻り値（状態の入ったオブジェクト）** です。名前で中身が分かるようにすると誤解を防げます。

```tsx
type RecentTransactionListComponentProps = RecentTransactionListProps & {
  query: TransactionsHooks; // フックの戻り値（データ・読み込み中・エラー）
};

const RecentTransactionList = ({ query, maxTransactions }: RecentTransactionListComponentProps) => {
  const { transactionList, isLoading, error } = query;
  // ...
};
```

あるいは、必要な値だけを個別の props として渡す方法もあります。こちらは「このコンポーネントが何に依存しているか」が型を見ただけで分かります。

```tsx
type Props = {
  transactions: Transaction[] | undefined;
  isLoading: boolean;
  error: Error | null;
  maxTransactions: number;
};
```

## 次に学ぶこと

- **Context（`createContext` / `use` / `useContext`）**: 深い階層へ props を中継せずに値を届ける仕組み。
- **`ComponentProps<typeof X>`**: 既存コンポーネントの props 型を取り出す TypeScript の型ユーティリティ。
- **`React.memo`**: props が変わらないときの再描画を省く。

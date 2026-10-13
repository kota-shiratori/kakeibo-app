# 表示ロジックとデータ取得の分離

## 概要

1 つのコンポーネントに「データを取ってくる処理」と「データを見せる処理」を全部書くと、長く複雑になり、再利用もしにくくなります。

そこで、責務ごとにコンポーネント（とフック）を分けるのが React のよくある設計です。

- **データを用意する層**（カスタムフック / それを呼ぶコンポーネント）
- **状態に応じて表示を切り替える層**
- **データを受け取って見せるだけの層**（props だけで動く、純粋な表示コンポーネント）

この考え方は、昔から「Container / Presentational パターン」として知られています。

## このプロジェクトでの実装

`web-app/src/components/TransactionList.tsx` は、1 つのファイルの中で 4 つのコンポーネントに役割を分けています。

```
Home.tsx
└ RecentIncomeTransactionList   … ① どのデータか決める（フックを呼ぶ）
  └ RecentTransactionList       … ② 状態で表示を切り替える（読み込み中/エラー/空/一覧）
    └ TransactionList           … ③ 配列を並べる
      └ TransactionListItem     … ④ 1 件を見せる
```

### ① データの入手: どのフックを使うかだけを決める

`web-app/src/components/TransactionList.tsx:33-68`

```tsx
export const RecentIncomeTransactionList = ({ maxTransactions }: RecentTransactionListProps) => {
  const incomeTransactions = useIncomeTransactions();
  return <RecentTransactionList hooks={incomeTransactions} maxTransactions={maxTransactions} />;
};

export const RecentExpenseTransactionList = ({ maxTransactions }: RecentTransactionListProps) => {
  const expenseTransactions = useExpenseTransactions();
  return <RecentTransactionList hooks={expenseTransactions} maxTransactions={maxTransactions} />;
};
```

この 2 つの違いは「呼ぶフック」だけです。表示の仕方は一切書いていません。

### ② 状態による切り替え: フックの「結果」だけを受け取る

`web-app/src/components/TransactionList.tsx:74-109`

```tsx
type RecentTransactionListComponentProps = RecentTransactionListProps & {
  hooks: TransactionsHooks;
};

const RecentTransactionList = ({ hooks, maxTransactions }: RecentTransactionListComponentProps) => {
  const { transactionList, isLoading, error } = hooks;
  if (isLoading) return <Spinner />;
  if (error) return <Text color="red.500">{error.message}</Text>;
  if (!transactionList?.transactions.length) return <Text>取引はまだありません。</Text>;
  const recentTransactions = transactionList.transactions.slice(0, maxTransactions);
  return <TransactionList transactions={recentTransactions} />;
};
```

（実際のコードはコメント付きで複数行。上は要約。）

このコンポーネントは **フックを呼びません**。収入か支出かも知りません。「`TransactionsHooks` の形をした値」さえ渡されれば動きます。だから収入・支出で 1 つの実装を共有できています。

### ③④ 純粋な表示: 配列・1 件のデータを受け取って見せるだけ

`web-app/src/components/TransactionList.tsx:114-172`

```tsx
const TransactionList = ({ transactions }: TransactionListProps) => (
  <Stack separator={<Separator size="sm" />}>
    {transactions.map((transaction) => (
      <TransactionListItem key={transaction.id} transaction={transaction} />
    ))}
  </Stack>
);

const TransactionListItem = ({ transaction }: TransactionListItemProps) => (
  <Flex justifyContent="space-between" alignItems="center">
    {/* 項目名・日付・金額を表示 */}
  </Flex>
);
```

（実際のコードは `return` 付き・コメント付き。上は要約。）

この 2 つは **props だけで表示が決まる** コンポーネントです。通信も state もありません。同じ props なら必ず同じ表示になります。

## この分け方の利点

| 利点 | 具体的に |
| --- | --- |
| 重複を減らせる | 収入・支出で、② ③ ④ を共通化できている |
| 変更の影響範囲が小さい | 見た目を変えるなら ④ だけ、API を変えるならフックだけ直せばよい |
| 早期 return とフックのルールが両立 | フックは ① だけ、早期 return は ② だけなので、Rules of Hooks に違反しにくい（13 参照） |
| テスト・確認がしやすい | ③ ④ は props を渡すだけで表示を確認できる（API サーバー不要） |
| 再利用しやすい | 例えば「全取引ページ」を作るときも、③ ④ はそのまま使える |

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 関心の分離（Separation of Concerns） | 異なる役割の処理を別々の場所に書くこと |
| Container / Presentational パターン | データを扱うコンポーネントと、見た目だけのコンポーネントを分ける設計 |
| 表示専用コンポーネント | props だけで描画が決まり、state や副作用を持たないコンポーネント |
| 依存性の注入（的な考え方） | 部品が自分でデータを取りに行かず、外から渡してもらうこと |

## 仕様・注意点

- フックの登場以降、「データ取得はカスタムフックに切り出す」ことで、Container コンポーネントをわざわざ作らない書き方も一般的になりました。このプロジェクトの ① は、フックを呼んで ② に渡すだけの薄いコンポーネントで、Container の役割をとても小さく保っています。
- 分割しすぎると、ファイル内を行ったり来たりしないと流れが追えなくなります。「名前を付けて意味がある単位」で分けるのが目安です。
- ② に渡している `hooks` という props 名は、中身（フックの戻り値）と少しずれています（06 参照）。

## 今後に活かせるポイント

- 新しい一覧画面を作るときは、「データ取得フック」「状態による切り替え」「一覧」「1 件」の 4 層で考えると整理しやすい。
- 「同じ形の戻り値を返すフック」+「その形を受け取る表示コンポーネント」の組み合わせで、データ源だけ違う画面を量産できる。
- 表示専用コンポーネントは、Storybook などで単体確認しやすい。

## 改善するなら

### フックの共通化と合わせて ① も 1 つにする

12 で紹介した `useTransactions(type)` を使えば、① の 2 つのコンポーネントも 1 つにまとめられます。

```tsx
type RecentTransactionListProps = {
  type: TransactionType; // "income" | "expense"
  maxTransactions: number;
};

export const RecentTransactionsByType = ({ type, maxTransactions }: RecentTransactionListProps) => {
  const query = useTransactions(type);
  return <RecentTransactionList query={query} maxTransactions={maxTransactions} />;
};

// Home.tsx
<SummaryCard title="収入履歴">
  <RecentTransactionsByType type="income" maxTransactions={3} />
</SummaryCard>
```

### 1 ファイルが大きくなったら分割

現在の `TransactionList.tsx` は 186 行で、その大半はコメントです。今のままでも問題ありませんが、他の画面で `TransactionList` / `TransactionListItem` を使いたくなったら、別ファイルに分けて export します。

## 次に学ぶこと

- **Storybook**: 表示専用コンポーネントを、アプリ本体から切り離して一覧・確認できるツール。
- **React Testing Library**: props を渡してコンポーネントを描画し、表示をテストする。
- **Server Components**（Next.js など）: データ取得をサーバー側のコンポーネントで行い、表示をクライアントに送る、分離の発展形。

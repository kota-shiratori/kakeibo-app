# カスタムフックでデータ取得ロジックを UI から分離する

## 概要

このプロジェクトでは、`fetch` を呼ぶコードはすべて `hooks/` のカスタムフックに入っており、**コンポーネントの中に `fetch` は 1 つもありません**。コンポーネントは「データ」「読み込み中か」「エラー」を受け取って表示を切り替えるだけです。

これにより、

- UI は「どうやって取ってくるか」を知らなくてよい（表示に集中できる）
- 通信方法（URL、ライブラリ、キャッシュ）を変えてもフックの中だけ直せばよい
- 同じデータを別の画面でも簡単に使える

という利点が生まれます。

## このプロジェクトでの実装

### 取得用フックの構造（`web-app/src/hooks/useIncomeTransactions.ts`）

```ts
export const useIncomeTransactions = (): TransactionsHooks => {   // :5 戻り値の型を約束
  const [incomeList, setIncomeList] = useState<TransactionListInfo>(); // :6 データ
  const [isLoading, setIsLoading] = useState(true);                   // :7 読み込み中
  const [error, setError] = useState<Error | null>(null);             // :8 エラー

  const fetchIncomeTransactions = async () => {                       // :10
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/transactions?type=income`); // :15
      if (!response.ok) {
        throw new Error("収入データの取得に失敗しました。");
      }
      const data = (await response.json()) as TransactionListInfo;
      setIncomeList(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("不明なエラーが発生しました。"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {                                                   // :30-32 マウント時に取得
    fetchIncomeTransactions();
  }, []);

  return { transactionList: incomeList, isLoading, error, refetch: fetchIncomeTransactions }; // :34-39
};
```

「データ / ローディング / エラー」の **3 つの状態をセットで持つ** のが、データ取得フックの基本形です。

### 送信用フック（`web-app/src/hooks/useAddTransactions.ts`）

取得とは違い、送信は「ユーザーが登録ボタンを押したとき」に行うので、`useEffect` は使わず、呼び出し用の関数 `addTransaction` を返します（`:9-31`）。成功/失敗を `Promise<boolean>` で返し、画面遷移するかどうかは **呼び出し側（ページ）が決める** 設計です。

```ts
// web-app/src/pages/Input.tsx:38-46
const ok = await addTransaction({ item, amount: adjustAmount, date });
if (ok) {
  navigate("/");
}
```

フックは「通信と状態」、ページは「次にどの画面へ行くか」と、責務が分かれています。

### UI 側の使い方

```tsx
// web-app/src/components/TransactionList.tsx:41-49
const incomeTransactions = useIncomeTransactions();
return <RecentTransactionList hooks={incomeTransactions} maxTransactions={maxTransactions} />;
```

```tsx
// web-app/src/components/TransactionList.tsx:85-98
if (isLoading) return <Spinner />;
if (error) return <Text color="red.500">{error.message}</Text>;
if (!transactionList?.transactions.length) return <Text>取引はまだありません。</Text>;
```

## 重要語句

- **カスタムフック**: `use` で始まり、内部で他のフック（`useState`, `useEffect` など）を使う関数。ロジックを再利用可能な単位に切り出す React の仕組み（API の詳細は React フォルダ参照）。
- **ロジックとビューの分離**: 「何を表示するか」と「データをどう扱うか」を別の場所に書くこと。
- **非同期処理の 3 状態**: loading / success（data）/ error。UI はこの 3 つすべてに対応する必要がある。
- **命令的な操作（mutation）**: データを変更する操作（POST など）。取得（query）と性質が違うため、フックの形も変わる。

## 仕様・注意点

- `response.json()` の結果を `as TransactionListInfo` で **型アサーション** しています（`useIncomeTransactions.ts:19`）。これは「そうであるはず」とコンパイラに伝えるだけで、実行時に中身は検証されません。サーバーが違う形を返しても気づけません（`14-api-contract-and-types.md`）。
- `refetch` を返していますが、現状どこからも使われていません。登録後の更新は画面遷移による再マウントで実現しています（`10-state-management.md`）。
- コンポーネントがアンマウントされた後に fetch が完了するケース（素早く画面遷移した場合など）への対策（`AbortController` 等）はありません。React 18 以降はアンマウント後の `setState` で警告は出ませんが、不要な通信は残ります。
- `useEffect` の依存配列が `[]` で、関数 `fetchIncomeTransactions` を依存に含めていません。動作上は問題ありませんが、ESLint（eslint-plugin-react-hooks）の `react-hooks/exhaustive-deps` を有効にすると指摘対象になります（現状の `.oxlintrc.json` では `react/rules-of-hooks` のみ明示。なお oxlint 1.86 の `react/exhaustive-deps` を有効にして試したところ、このケースは検出されず、代わりに既定で有効な `react/set-state-in-effect` の警告が出ます）。
- フック名 `useAddTransactions` は複数形ですが、追加するのは 1 件です（命名の小さな不一致）。

## 今後に活かせるポイント

- 「UI コンポーネントに `fetch` を書かない」は、どんなフレームワークでも通用するルール。
- フックの戻り値の型（`TransactionsHooks`）を先に決めておくと、実装をライブラリ（TanStack Query、SWR）に差し替えても UI は無傷で済む。
- 送信系は「成功したかどうか」を返し、その後の画面遷移は呼び出し側に任せると、フックを別画面でも再利用しやすい。

## 改善するなら

通信部分（純粋な関数）とフック（React の状態）をさらに分けると、通信部分を React なしでテストできます。

```ts
// api/transactions.ts（案）
export type TransactionType = "income" | "expense" | "all";

export async function fetchTransactions(type: TransactionType, signal?: AbortSignal) {
  const res = await fetch(`${BASE_URL}/transactions?type=${type}`, { signal });
  if (!res.ok) throw new Error("取引データの取得に失敗しました。");
  return (await res.json()) as TransactionListInfo;
}
```

```ts
// hooks/useTransactions.ts（案）— AbortController でアンマウント時に中断
useEffect(() => {
  const controller = new AbortController();
  fetchTransactions(type, controller.signal).then(setList, (e) => {
    if (e.name !== "AbortError") setError(e);
  }).finally(() => {
    // 中断済みのリクエストでは isLoading を下ろさない（StrictMode の 1 回目が中断されたとき、
    // 2 回目の取得中にスピナーが消えてしまうのを防ぐ）
    if (!controller.signal.aborted) setIsLoading(false);
  });
  return () => controller.abort();
}, [type]);
```

## 次に学ぶこと

- **TanStack Query（React Query）/ SWR**: キャッシュ・再取得・重複排除などを備えたサーバー状態管理ライブラリ。今回の自作フックが担っている役割の「完成形」。
- React 19 の `use()` と Suspense によるデータ取得（React フォルダ参照）。

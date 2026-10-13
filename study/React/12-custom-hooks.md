# カスタムフック

## 概要

**カスタムフック** は、`useState` や `useEffect` などのフックを組み合わせた処理を、`use` で始まる名前の関数として切り出したものです。

コンポーネントから「データの取り方・状態の管理」を追い出し、コンポーネントは「何を表示するか」に集中できるようになります。また、同じロジックを複数のコンポーネントで使い回せます。

## このプロジェクトでの実装

このプロジェクトには 3 つのカスタムフックがあります。

| ファイル | 役割 | 戻り値の型 |
| --- | --- | --- |
| `web-app/src/hooks/useIncomeTransactions.ts` | 収入一覧をマウント時に取得 | `TransactionsHooks` |
| `web-app/src/hooks/useExpenseTransactions.ts` | 支出一覧をマウント時に取得 | `TransactionsHooks` |
| `web-app/src/hooks/useAddTransactions.ts` | 取引を登録する関数と状態を提供 | `AddTransactionHooks` |

### 戻り値の「形」を型で決める

`web-app/src/hooks/transactions.ts:14-27`

```ts
export type TransactionsHooks = {
  transactionList: TransactionListInfo | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

export type AddTransactionHooks = {
  addTransaction: (transaction: NewTransaction) => Promise<boolean>;
  isLoading: boolean;
  error: Error | null;
};
```

フックが「何を返すか」を型として先に決めておくことで、収入用と支出用のフックが同じ形の値を返すことが保証されます。このおかげで、表示側の `RecentTransactionList` は「どちらのフックの戻り値か」を気にせず 1 つの実装で済んでいます（20 参照）。

### 取得系フック: 状態 + 取得関数 + effect をひとまとめに

`web-app/src/hooks/useIncomeTransactions.ts:5-40`

```ts
export const useIncomeTransactions = (): TransactionsHooks => {
  const [incomeList, setIncomeList] = useState<TransactionListInfo>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIncomeTransactions = async () => { /* ... */ };

  useEffect(() => {
    fetchIncomeTransactions();
  }, []);

  return {
    transactionList: incomeList,
    isLoading,
    error,
    refetch: fetchIncomeTransactions,
  };
};
```

### 操作系フック: 「実行する関数」を返す

`web-app/src/hooks/useAddTransactions.ts:5-38`

```ts
export const useAddTransactions = (): AddTransactionHooks => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const addTransaction = async (transaction: NewTransaction) => {
    // POST して成否を true / false で返す
  };

  return { addTransaction, isLoading, error };
};
```

取得系との違い:

- `useEffect` を使わない。**ユーザーが登録ボタンを押したとき** に呼ばれるので、マウント時に何かする必要がない。
- `isLoading` の初期値は `false`（最初は何もしていないから）。取得系は `true`（すぐ取得を始めるから）。

### 使う側

`web-app/src/components/TransactionList.tsx:41` と `web-app/src/pages/Input.tsx:27`

```tsx
const incomeTransactions = useIncomeTransactions();
```

```tsx
const { addTransaction, isLoading, error } = useAddTransactions();
```

コンポーネントからは、中で `fetch` しているのか、どの URL を叩いているのかは見えません。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| カスタムフック | 他のフックを使う、`use` で始まる名前の自作関数 |
| ロジックの再利用 | UI ではなく「状態の扱い方」を複数のコンポーネントで共有すること |
| 取得系（query） | データを読み込む処理。マウント時などに自動で実行することが多い |
| 操作系（mutation） | データを作成・更新・削除する処理。ユーザー操作をきっかけに実行する |

## 仕様・注意点

- **名前は必ず `use` で始める。** React（とリンター）は `use` で始まる関数をフックとみなし、Rules of Hooks（13 参照）のチェック対象にします。逆に、中でフックを使わない普通の関数には `use` を付けないのが推奨です。
- **カスタムフックは「state そのもの」ではなく「state を扱うロジック」を共有します。** `RecentIncomeTransactionList` が 2 か所で使われたら、`useIncomeTransactions` はそれぞれで別々に呼ばれ、**state もリクエストもそれぞれ独立** になります（2 回 fetch される）。複数のコンポーネントで同じデータを共有したい場合は、state を親に持ち上げるか、Context や TanStack Query などを使います。
- フック名 `useAddTransactions` は複数形ですが、`addTransaction` は 1 件ずつ登録する関数です。名前と中身を揃えると読み手が迷いません（`useAddTransaction` など）。
- 型名 `TransactionsHooks` / `AddTransactionHooks` は「フックの戻り値の型」ですが、名前からは「フックの集合」のようにも読めます。`UseTransactionsResult` のような命名もよく使われます。

## 今後に活かせるポイント

- 「`useState` + `useEffect` + fetch」がコンポーネントに出てきたら、カスタムフックに切り出す候補。
- 戻り値の型を先に定義しておくと、同じ形を返す複数のフックを、同じ表示コンポーネントで扱える。
- 取得系は「データ・読み込み中・エラー・再取得関数」、操作系は「実行関数・実行中・エラー」を返す、という形は TanStack Query の `useQuery` / `useMutation` とも近く、移行しやすい。

## 改善するなら

### 収入/支出フックの重複を type 引数で共通化

`useIncomeTransactions.ts` と `useExpenseTransactions.ts` は、URL のクエリ `type=income` / `type=expense` とエラーメッセージ以外まったく同じです。引数で切り替える 1 つのフックにまとめると、修正が 1 か所で済みます。ここではついでに、11 のクリーンアップと 22 の再取得も取り入れています。

```ts
// hooks/useTransactions.ts
import { useCallback, useEffect, useState } from "react";
import type { TransactionListInfo, TransactionsHooks } from "./transactions";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export type TransactionType = "income" | "expense";

const LABELS: Record<TransactionType, string> = {
  income: "収入",
  expense: "支出",
};

export const useTransactions = (type: TransactionType): TransactionsHooks => {
  const [transactionList, setTransactionList] = useState<TransactionListInfo>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // 再取得のきっかけ

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${BASE_URL}/transactions?type=${type}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`${LABELS[type]}データの取得に失敗しました。`);
        }
        setTransactionList((await response.json()) as TransactionListInfo);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err : new Error("不明なエラーが発生しました。"));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [type, reloadKey]); // type が変わったとき・refetch されたときに再取得

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  return { transactionList, isLoading, error, refetch };
};

// 既存の名前を残したいなら薄いラッパーにする
export const useIncomeTransactions = () => useTransactions("income");
export const useExpenseTransactions = () => useTransactions("expense");
```

注: この形でも effect 内で同期的に `setIsLoading(true)` を呼ぶため、oxlint の `set-state-in-effect` 警告が出る可能性があります。手書きの effect 取得の限界であり、本格的には TanStack Query などに任せるのが現代的な解決です。

## 次に学ぶこと

- **TanStack Query の `useQuery` / `useMutation`**: このプロジェクトの取得系・操作系フックをほぼそのまま置き換えられる。
- **`useSyncExternalStore`**: 外部のデータソース（ブラウザ API やストア）を購読するカスタムフックを正しく書くための API。
- **カスタムフックのテスト**: `@testing-library/react` の `renderHook` でフック単体をテストできる。

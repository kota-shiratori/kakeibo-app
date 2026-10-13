# 共通化と重複 — DRY とのバランス

## 概要

**DRY（Don't Repeat Yourself）** は「同じ知識を 2 か所に書かない」という原則です。しかし何でも共通化すればよいわけではなく、早すぎる共通化は「少し違うものを無理に 1 つにまとめた、条件分岐だらけのコード」を生みます。

このプロジェクトには、**うまく共通化できている箇所** と **重複が残っている箇所** の両方があり、比較教材としてちょうど良い状態です。

## このプロジェクトでの実装

### うまく共通化できている例

**1. Header の再利用**

`web-app/src/components/Header.tsx:3-18` の `Header` を、両方のページが使っています。

```tsx
// web-app/src/pages/Home.tsx:23
<Header />
// web-app/src/pages/Input.tsx:55
<Header />
```

アプリ名「シンプル家計簿」を変えたいときは 1 か所の修正で済みます。

**2. SummaryCard（画面内での共通化）**

`web-app/src/pages/Home.tsx:59-68` の `SummaryCard` は、タイトルと中身（`children`）を受け取るカードの「枠」です。

```tsx
// web-app/src/pages/Home.tsx:39-46
<SummaryCard title="収入履歴">
  <RecentIncomeTransactionList maxTransactions={3} />
</SummaryCard>
<SummaryCard title="支出管理">
  <RecentExpenseTransactionList maxTransactions={3} />
</SummaryCard>
```

`children` を使うことで「枠の見た目」と「中身」が分離され、枠は中身が何であっても使い回せます。今は Home でしか使わないので Home の中に置いている、というのも妥当な判断です。

**3. RecentTransactionList / TransactionList の共有**

収入と支出で「状態の振り分け」「一覧表示」の部分は共通のコンポーネントを使っています（`web-app/src/components/TransactionList.tsx:73` のコメント「収入と支出で同じ処理になるので、1 つにまとめて使い回している」）。

**4. 型の共有**

`TransactionsHooks`（`web-app/src/hooks/transactions.ts:14-19`）を両フックの戻り値型として共有しているので、両者の形がずれることはありません。

### 重複が残っている例

**収入フックと支出フックはほぼ同一**

`useIncomeTransactions.ts` と `useExpenseTransactions.ts` を比べると、名前（フック名・変数名・関数名）の違いを除けば、違いは次の 3 点だけです。

| 行 | useIncomeTransactions | useExpenseTransactions |
|---|---|---|
| :6 | `incomeList` | `expenseList` |
| :15 | `?type=income` | `?type=expense` |
| :17 | `"収入データの取得に失敗しました。"` | `"支出データの取得に失敗しました。"` |

残りの行は、名前の違いを除けばまったく同じです（40 行中、完全に同じ行は 32 行）。さらに `useAddTransactions.ts` も含めた 3 ファイルに、

- `const BASE_URL = import.meta.env.VITE_API_BASE_URL;`（各ファイルの `:3`）
- `err instanceof Error ? err : new Error("不明なエラーが発生しました。")` という同じエラー変換

が繰り返されています。

これに連動して、Container コンポーネントも `RecentIncomeTransactionList` と `RecentExpenseTransactionList` の 2 つが並んでいます（`TransactionList.tsx:33-68`）。

## 重要語句

- **DRY**: 同じ「知識（ルール・仕様）」を複数箇所に書かない原則。単なる「見た目が似たコード」の排除ではない点が重要。
- **WET / Rule of Three**: 「2 回までは重複を許し、3 回目で共通化を考える」という経験則。
- **早すぎる抽象化（premature abstraction）**: まだ変化の方向が分からないうちに共通化し、後で無理が出ること。
- **偶然の重複**: 今たまたま同じ形だが、別の理由で変わりうるコード。共通化すべきでない。
- **パラメータ化**: 違う部分だけを引数にして 1 つの関数にまとめる手法。

## 仕様・注意点

- 収入/支出フックの重複は「**本質的に同じ知識**（`/transactions?type=xxx` を取得する）」なので、共通化して問題ない典型例です。API 側も `type` パラメータ 1 つで切り替える設計になっており（`backend/src/index.ts:19-21`）、フロントもそれに合わせるのが自然です。
- 一方、`useAddTransactions`（送信）と取得系フックは「通信して loading/error を管理する」点は似ていても、**起動のタイミング（自動 / 手動）が違う** ので、無理に 1 つにまとめないほうがよいでしょう。
- `SummaryCard` を `components/` に移すのは、2 つ目の画面で必要になってからで十分です。

## 今後に活かせるポイント

- 共通化を判断する問い: 「片方を変えたとき、もう片方も **必ず** 同じように変えるべきか？」 Yes なら共通化、No なら重複のままでよい。
- 違いが「値」だけなら引数でパラメータ化、違いが「振る舞い」ならコンポーネントの `children` や関数の受け渡しで差し込む。
- 設定値（`BASE_URL`）のような **すべての通信が依存するもの** は 1 か所にまとめる価値が高い。

## 改善するなら

```ts
// hooks/useTransactions.ts（案）
import { useEffect, useState } from "react";
import type { TransactionListInfo, TransactionsHooks } from "./transactions";
import { apiFetch, toError } from "@/lib/apiClient";

type TransactionType = "income" | "expense" | "all";

const errorMessages: Record<TransactionType, string> = {
  income: "収入データの取得に失敗しました。",
  expense: "支出データの取得に失敗しました。",
  all: "取引データの取得に失敗しました。",
};

export const useTransactions = (type: TransactionType): TransactionsHooks => {
  const [list, setList] = useState<TransactionListInfo>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setList(await apiFetch<TransactionListInfo>(`/transactions?type=${type}`, errorMessages[type]));
    } catch (err) {
      setError(toError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, [type]);

  return { transactionList: list, isLoading, error, refetch: fetchList };
};
```

```ts
// lib/apiClient.ts（案）— BASE_URL とエラー変換を 1 か所に
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const toError = (err: unknown) =>
  err instanceof Error ? err : new Error("不明なエラーが発生しました。");

export async function apiFetch<T>(path: string, fallbackMessage: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) throw new Error(fallbackMessage);
  return (await res.json()) as T;
}
```

既存の `useIncomeTransactions` は `export const useIncomeTransactions = () => useTransactions("income");` とすれば、呼び出し側を変えずに段階的に移行できます。

## 次に学ぶこと

- **AHA プログラミング（Avoid Hasty Abstractions）**: 「早すぎる抽象化を避ける」という DRY の対となる考え方。
- **リファクタリング**（Martin Fowler）: 「関数の抽出」「パラメータ化」などの手法カタログ。

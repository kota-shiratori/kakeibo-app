# 非同期処理の 3 状態（isLoading / error / data）と try/catch/finally

## 概要

API 通信のような非同期処理には、少なくとも次の状態があります。

- **読み込み中**（まだ結果が来ていない）
- **失敗**（エラーが返ってきた・通信できなかった）
- **成功**（データが手に入った）

画面はそれぞれの状態に応じた表示（スピナー・エラーメッセージ・一覧）を出す必要があります。そのため、非同期処理を扱うカスタムフックでは **`isLoading` / `error` / `data` の 3 つの state** を持つのが定番です。そして、その 3 つを正しく更新するために `try` / `catch` / `finally` を使います。

## このプロジェクトでの実装

### 3 つの state

`web-app/src/hooks/useIncomeTransactions.ts:6-8`

```ts
const [incomeList, setIncomeList] = useState<TransactionListInfo>(); // data
const [isLoading, setIsLoading] = useState(true);                    // 読み込み中か
const [error, setError] = useState<Error | null>(null);              // エラー
```

### try / catch / finally で状態を遷移させる

`web-app/src/hooks/useIncomeTransactions.ts:10-28`

```ts
const fetchIncomeTransactions = async () => {
  setIsLoading(true);   // 開始: 読み込み中にする
  setError(null);       // 開始: 前回のエラーを消す

  try {
    const response = await fetch(`${BASE_URL}/transactions?type=income`);
    if (!response.ok) {
      throw new Error("収入データの取得に失敗しました。");
    }
    const data = (await response.json()) as TransactionListInfo;
    setIncomeList(data);        // 成功: データを保存
  } catch (err) {
    setError(
      err instanceof Error ? err : new Error("不明なエラーが発生しました。"),
    );                          // 失敗: エラーを保存
  } finally {
    setIsLoading(false);        // 成功でも失敗でも: 読み込み終了
  }
};
```

それぞれのブロックの役割:

| ブロック | 実行されるとき | ここでやっていること |
| --- | --- | --- |
| `try` | 常に（途中で例外が起きたらそこで中断） | 通信・データ保存 |
| `catch` | `try` の中で例外が投げられたとき | エラーを state に保存 |
| `finally` | 成功・失敗どちらでも **必ず最後に** | `isLoading` を `false` に戻す |

`finally` に `setIsLoading(false)` を書くことで、「成功時と失敗時の両方に書き忘れて、スピナーが回りっぱなしになる」というバグを防いでいます。

### `response.ok` のチェックが重要

`fetch` は **サーバーが 404 や 500 を返しても reject しません**（例外を投げない）。reject するのはネットワークエラー（サーバーに繋がらない、CORS で拒否された等）のときだけです。そのため、

```ts
if (!response.ok) {
  throw new Error("収入データの取得に失敗しました。");
}
```

と自分で `response.ok`（ステータスが 200〜299 なら `true`）を確認し、失敗なら `throw` して `catch` に飛ばしています。

### `err instanceof Error` で型を絞る

TypeScript では `catch (err)` の `err` は `unknown` 型です（JavaScript では `throw "文字列"` のように何でも投げられるため）。`tsconfig.app.json` には `strict` の記述がありませんが、TypeScript 6（このプロジェクトは 6.0.3）では `strict` 系の設定が既定で有効なため、`unknown` になります（`strict` が無効な環境では `any` になる）。`err instanceof Error` で Error オブジェクトか確認し、違えば汎用の Error を作って、state の型 `Error | null` に合わせています（型の絞り込みの詳細は study/TypeScript 参照）。

### 表示側: 3 状態に応じて出し分け

`web-app/src/components/TransactionList.tsx:85-108`

```tsx
if (isLoading) {
  return <Spinner />;
}
if (error) {
  return <Text color="red.500">{error.message}</Text>;
}
if (!transactionList?.transactions.length) {
  return <Text>取引はまだありません。</Text>;
}
// ...
return <TransactionList transactions={recentTransactions} />;
```

実際には「成功したがデータが 0 件」という **4 つ目の状態（空状態）** も区別しています。これはとても良い設計です（15 参照）。

### 操作系フックでも同じ型

`web-app/src/hooks/useAddTransactions.ts:9-31` も、`setIsLoading(true)` → `try` で POST → `catch` で `setError` → `finally` で `setIsLoading(false)` と同じ形です。こちらは結果を `return true` / `return false` で呼び出し元に返しています（09 参照）。表示側では `Input.tsx:111` でエラー表示、`Input.tsx:128` の `loading={isLoading}` で送信中のボタン表示に使っています。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `async` / `await` | Promise を同期処理のような見た目で書く構文。`await` で結果を待つ |
| `try` / `catch` / `finally` | 例外処理の構文。`finally` は成否に関係なく最後に実行される |
| `response.ok` | HTTP ステータスが 200〜299 なら `true` になる `Response` のプロパティ |
| `unknown` | 何が入っているか分からない型。使う前に型チェックが必要 |
| 空状態（empty state） | 処理は成功したが表示するデータがない状態 |

## 仕様・注意点

- **3 つの state は独立しているので、ありえない組み合わせも型上は作れてしまいます。** 例えば「`isLoading` が `true` なのに `error` もある」など。このプロジェクトは開始時に `setError(null)` しているので実際には起きませんが、更新を 1 つ書き忘れると不整合になりえます。
- **再取得時に前のデータが残る。** `fetchIncomeTransactions` は開始時に `incomeList` を消さないので、`refetch` 中も古いデータが残っています。ただし表示側は `isLoading` を最初に判定するので、再取得中はスピナーに切り替わり、一覧は一瞬消えます。「古いデータを表示したまま、小さく更新中マークを出す」方が使いやすい場合もあります。
- **`as TransactionListInfo` はただの型の「主張」で、実行時のチェックではありません。** サーバーが想定外の形を返しても TypeScript は気づけません。厳密にしたい場合は Zod などで検証します（study/TypeScript, study/API-Design 参照）。
- エラーメッセージを `error.message` でそのまま画面に出しています。自分で作ったメッセージなら問題ありませんが、ネットワークエラー時はブラウザの英語メッセージ（例: Chrome では `Failed to fetch`）が表示されます。

## 今後に活かせるポイント

- 非同期処理は「開始時に loading=true・error=null」「成功で data」「失敗で error」「finally で loading=false」というテンプレートで書く。
- `fetch` を使うときは必ず `response.ok` をチェックする。
- 表示側は「読み込み中 → エラー → 空 → データあり」の 4 パターンを用意する。

## 改善するなら

### 状態を 1 つの判別可能なユニオン型にまとめる

ありえない組み合わせを型で禁止できます（判別可能なユニオンは study/TypeScript 参照）。

```ts
type FetchState<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: T };

const [state, setState] = useState<FetchState<TransactionListInfo>>({ status: "loading" });

// 成功時
setState({ status: "success", data });
// 失敗時
setState({ status: "error", error });

// 表示側
switch (state.status) {
  case "loading": return <Spinner />;
  case "error":   return <Text color="red.500">{state.error.message}</Text>;
  case "success": return <TransactionList transactions={state.data.transactions} />;
}
```

### ユーザー向けのエラーメッセージを統一する

```ts
} catch (err) {
  console.error(err); // 開発者向けの詳細はコンソールへ
  setError(new Error("収入データの取得に失敗しました。時間をおいて再度お試しください。"));
}
```

## 次に学ぶこと

- **React 19 の Actions / `useActionState`**: フォーム送信などの非同期処理で、pending 状態・結果・エラーを React が管理してくれる仕組み。`useAddTransactions` の `isLoading` 管理を置き換えられる。
- **`useTransition`**: 非同期関数を `startTransition` に渡すと `isPending` が自動で管理される（React 19 から async 関数を渡せる）。
- **Suspense + Error Boundary**: 読み込み中とエラーの表示を、コンポーネントの外側で宣言的に扱う方式。
- **TanStack Query**: `isPending` / `isError` / `data` などを自動で管理する。

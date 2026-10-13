# useEffect と依存配列（マウント時のデータ取得）

## 概要

`useEffect` は、**描画が終わった後に「副作用」を実行する** ためのフックです。
副作用とは、画面の描画そのもの以外の処理 — API 通信、タイマー、ブラウザ API の操作、外部ライブラリとの連携など — のことです。

コンポーネント本体（描画中）で `fetch` を呼ぶと、描画のたびにリクエストが飛び、結果を state に入れるとまた再描画…と無限ループになります。そこで「描画後に、必要なときだけ実行する」ために `useEffect` を使います。

## このプロジェクトでの実装

`web-app/src/hooks/useIncomeTransactions.ts:5-40`（`useExpenseTransactions.ts` も同じ構造）

```ts
export const useIncomeTransactions = (): TransactionsHooks => {
  const [incomeList, setIncomeList] = useState<TransactionListInfo>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIncomeTransactions = async () => {
    // ...（fetch して state を更新する）
  };

  useEffect(() => {
    fetchIncomeTransactions();
  }, []);

  return { /* ... */ };
};
```

`useEffect(関数, 依存配列)` の 2 つの引数:

1. **第 1 引数（effect 関数）**: 描画後に実行したい処理。ここではデータ取得関数を呼んでいる。
2. **第 2 引数（依存配列）**: 「どの値が変わったら effect を再実行するか」のリスト。ここでは空配列 `[]`。

### 実行の流れ（Home 画面を開いたとき）

```
1. Home が描画される
   → RecentIncomeTransactionList が useIncomeTransactions() を呼ぶ
   → isLoading の初期値は true なので、まず <Spinner /> が表示される
2. 描画が画面に反映された後、useEffect の中身が実行される
   → fetchIncomeTransactions() で GET /transactions?type=income
3. レスポンスが返ると setIncomeList(data), setIsLoading(false)
4. state が変わったので再描画 → 一覧が表示される
5. 依存配列が [] なので、再描画されても effect は再実行されない
```

`isLoading` の初期値を `true` にしている（`useIncomeTransactions.ts:7`）のは、手順 1 の最初の描画で「データなし」と表示させず、すぐにスピナーを出すためです。もし初期値が `false` だと、最初の一瞬「取引はまだありません。」が表示されてしまいます（`TransactionList.tsx:96-98` の分岐に入るため）。

## 依存配列の 3 パターン

| 書き方 | effect が実行されるタイミング |
| --- | --- |
| `useEffect(fn)`（第 2 引数なし） | **毎回の描画後** |
| `useEffect(fn, [])` | **マウント時（最初の描画後）に 1 回だけ**（開発時の StrictMode では 2 回。02 参照） |
| `useEffect(fn, [a, b])` | マウント時 + `a` か `b` が前回の描画から変わったとき |

値が「変わったか」は `Object.is` で前回と比較されます。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 副作用（side effect） | 描画以外の処理。通信・タイマー・DOM 操作・購読など |
| effect 関数 | `useEffect` の第 1 引数。描画が画面に反映された後に実行される |
| 依存配列（deps） | effect が使う、変化しうる値（props・state・それらから作った値）のリスト |
| マウント時取得 | コンポーネントが表示されたタイミングでデータを取りに行くパターン |
| クリーンアップ関数 | effect 関数が `return` する関数。後片付け用（11 参照） |

## 仕様・注意点

- **effect 関数自体を `async` にしてはいけません。** `useEffect(async () => {...})` と書くと、effect が Promise を返すことになりますが、React は effect の戻り値を「クリーンアップ関数」として扱うため不正です（型定義も `EffectCallback = () => void | Destructor` で、Promise は許されない。`node_modules/@types/react/index.d.ts:1672`）。このプロジェクトのように、**async 関数を別に定義して effect の中から呼ぶ** のが正しい書き方です。
- **依存配列には、effect の中で使っている「変化しうる値」をすべて書くのが原則です。** このプロジェクトの effect は、コンポーネント内で定義した `fetchIncomeTransactions` を使っているのに依存配列が `[]` です。ESLint の `eslint-plugin-react-hooks` の `exhaustive-deps` ルールなら「missing dependency: 'fetchIncomeTransactions'」と警告される典型パターンです。ただし今回は関数の中身が使う値（`BASE_URL`・セッター）がどれも描画ごとに変わらないので、実害はありません。
  - このプロジェクトの lint（`web-app/.oxlintrc.json`）では `react/rules-of-hooks` のみ明示的に有効化されています。oxlint 1.86.0 で `react/exhaustive-deps` を追加で有効にして試したところ、このコードには警告が出ませんでした（ツールによって判定が異なる）。
- **現在の `npx oxlint` では `react(set-state-in-effect)` の警告が出ます**（`useIncomeTransactions.ts:31:5` と `useExpenseTransactions.ts:31:5`）。「effect の中で同期的に setState すると、連鎖的な再描画を引き起こす」という警告で、`fetchIncomeTransactions` の冒頭の `setIsLoading(true)` / `setError(null)` が effect 内から同期的に呼ばれるためです。React 公式も「effect は外部システムとの同期のためのもの」としており、データ取得を effect で手書きするのは推奨度の低い方法になりつつあります（「次に学ぶこと」参照）。
- effect は **描画が画面に反映された後** に実行されます。描画前に同期的に DOM を測りたい場合は `useLayoutEffect` を使います（まれ）。
- 本番でも、ページを移動して戻ってくると Home が再マウントされ、effect が再実行されます。登録画面から戻ると最新データが表示されるのはこのためです（22 参照）。

## 今後に活かせるポイント

- 「マウント時に 1 回データを取る」= `useEffect(() => { load(); }, [])` は基本形として覚えておく。
- 非同期処理は「effect の中で async 関数を定義して呼ぶ」か「外で定義した async 関数を呼ぶ」。effect 自体を async にしない。
- 依存配列は「何が変わったら再実行したいか」ではなく「effect が何を使っているか」で決める。使っている値を全部書いて、困るなら effect の書き方を見直す。

## 改善するなら

依存配列の警告を正しく解消するには、関数を effect の **中** に移すのが最もシンプルです。そうすれば effect が外部の関数に依存しなくなります。

```ts
useEffect(() => {
  const load = async () => {
    // fetch して state を更新
  };
  load();
}, []); // effect 内で使う外部の値がないので [] で正しい
```

ただし、このプロジェクトでは `refetch` として同じ関数を外にも公開しているため、単純に移すことはできません。その場合は「再取得用のカウンター state を依存配列に入れる」方法や、`useCallback` で関数を安定させて依存配列に入れる方法があります（12・11・22 参照）。

```ts
const fetchIncomeTransactions = useCallback(async () => {
  // ...
}, []); // 中で使う変化しうる値がないので []

useEffect(() => {
  fetchIncomeTransactions();
}, [fetchIncomeTransactions]); // 依存を正しく宣言
```

## 次に学ぶこと

- **TanStack Query（React Query）**: キャッシュ・再取得・重複排除・ローディング管理を自動化するデータ取得ライブラリ。手書きの `useEffect` 取得の課題をほぼ解決する。
- **React 19 の `use` + Suspense**: Promise を `use(promise)` で読み、読み込み中は `<Suspense fallback>` で表示する方式。
- **React Router の loader**: ルート遷移時にデータを取得する仕組み（study/Routing 参照）。
- **You Might Not Need an Effect**: react.dev の記事。effect を使わずに済むケースの見分け方。

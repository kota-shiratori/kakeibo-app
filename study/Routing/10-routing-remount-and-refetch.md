# ルーティングと再取得の関係（登録後に Home が再マウントされる流れ）

## 概要

このアプリでは、入力画面で取引を登録してホームに戻ると、**新しい取引が一覧に反映されています**。しかし、`Input` から `Home` に「データを更新して」と伝えるコードはどこにもありません。

これが成り立つのは、**ルートが切り替わるとページコンポーネントがアンマウント → 再マウントされ、マウント時の `useEffect` で一覧を取り直す** からです。ルーティングが「再取得のきっかけ」を担っている、という関係です。

## このプロジェクトでの実装

### 関わるコード

```tsx
// web-app/src/App.tsx:9-10
<Route path="/" element={<Home />} />
<Route path="/input" element={<Input />} />
```

```tsx
// web-app/src/pages/Home.tsx:38-47（抜粋）
<SummaryCard title="収入履歴">
  <RecentIncomeTransactionList maxTransactions={3} />
</SummaryCard>
...
<SummaryCard title="支出管理">
  <RecentExpenseTransactionList maxTransactions={3} />
</SummaryCard>
```

```tsx
// web-app/src/components/TransactionList.tsx:41
const incomeTransactions = useIncomeTransactions();
// web-app/src/components/TransactionList.tsx:60
const expenseTransactions = useExpenseTransactions();
```

```tsx
// web-app/src/hooks/useIncomeTransactions.ts:30-32
useEffect(() => {
  fetchIncomeTransactions();
}, []);   // ← 依存配列が空 = マウント時に 1 回だけ実行
```

（`web-app/src/hooks/useExpenseTransactions.ts:30-32` も同じ形）

```tsx
// web-app/src/pages/Input.tsx:38-46
const ok = await addTransaction({ item, amount: adjustAmount, date });
if (ok) {
  navigate("/");
}
```

### 時系列で追う

```
① ホームを開く（URL: /）
   <Routes> が <Home /> を描画
   → RecentIncome/ExpenseTransactionList がマウント
   → useEffect(..., []) が実行され GET /transactions?type=income / ?type=expense

② 「登録」ボタン → navigate("/input")
   <Routes> の一致結果が <Input /> に変わる
   → <Home /> とその子孫はすべてアンマウント（state も破棄）
   → <Input /> がマウント

③ フォーム送信 → POST /transactions が成功 → navigate("/")
   → <Input /> はアンマウント（入力中の state も破棄）
   → <Home /> が「新しく」マウント
   → 子の useEffect(..., []) が再び実行され、GET で最新の一覧を取得
   → 登録したばかりの取引が表示される
```

ポイントは **③で `Home` が以前のものの続きではなく、まっさらな状態から作り直される** ことです。`<Routes>` は一致したルートの `element` だけを描画するため、`/input` にいる間 `Home` は画面上に存在しません。

### 補足: Header も毎回作り直される

`Header` は `Home`（`web-app/src/pages/Home.tsx:23`）と `Input`（`web-app/src/pages/Input.tsx:55`）のそれぞれの中で描画されているので、ページが切り替わるたびに `Header` もアンマウント → マウントされます。今は state を持たない表示だけの部品なので問題ありませんが、共通化の余地があります（[12-layout-route-and-outlet.md](./12-layout-route-and-outlet.md)）。

## 重要語句

- **マウント（mount）**: コンポーネントが初めて画面（React のツリー）に追加されること。
- **アンマウント（unmount）**: コンポーネントがツリーから取り除かれること。その state は破棄される。
- **再マウント**: 一度アンマウントされたコンポーネントが、再び新しく追加されること。state は初期値から始まる。
- **useEffect の空の依存配列 `[]`**: 「マウント時に 1 回だけ実行する」という意味（React の詳細は study/React 担当）。
- **再取得（refetch）**: サーバーのデータが変わったあとに、最新のデータを取り直すこと。

## 仕様・注意点

- **この「再マウントで再取得」は、ルート間を移動したときにだけ働きます**。同じ画面の中で取引を追加・削除するような UI にした場合、`Home` はアンマウントされないので一覧は更新されません。その場合はカスタムフックが返している `refetch`（`web-app/src/hooks/useIncomeTransactions.ts:38`）を呼ぶなどの対応が必要です。
- **同じルートのまま URL のパラメータだけが変わる場合も再マウントされません**。例えば将来 `/transactions/:id` を作り、`/transactions/1` → `/transactions/2` と移動しても、同じ `<Route>` の同じ `element` なのでコンポーネントは再利用されます。`useEffect` の依存配列に `id` を入れるか、`key` を変える工夫が必要です。
- ブラウザの「戻る」で `/input` → `/` に戻った場合も、同じく `Home` が再マウントされて再取得が走ります。
- 開発時は `main.tsx` の `<StrictMode>`（`web-app/src/main.tsx:7`）により、マウント時の effect が意図的に 2 回実行されるため、GET リクエストが 2 回ずつ見えることがあります。本番ビルドでは 1 回です（詳細は study/React 担当）。
- 再マウントのたびに必ず通信するため、画面遷移のたびに一瞬ローディング表示が出ます。キャッシュがない、シンプルさ優先の設計です。

## 今後に活かせるポイント

- 「**画面遷移 = コンポーネントの作り直し = 初期化処理が再実行される**」という理解は、データ取得だけでなく、フォームの初期化（`Input` に戻るたびに入力欄が空になる）などにも効いています。
- 「別画面で更新 → 元の画面に戻ったら最新」をどう実現するかは、アプリが大きくなると重要な設計テーマになります。今回は「ルーティングによる再マウント」という一番シンプルな方法で解決しています。

## 改善するなら

### 1. 依存関係を明示したいなら key で再マウントを強制する

同じルート内で確実に作り直したい場合、`key` を変えると React は別のコンポーネントとして扱い、再マウントします。

```tsx
import { useLocation } from "react-router";

function Home() {
  const location = useLocation();
  // location.key は遷移ごとに変わるので、遷移のたびに一覧を作り直す
  return <RecentIncomeTransactionList key={location.key} maxTransactions={3} />;
}
```

### 2. データ取得をルーターに任せる（Data モード）

Data モードの `loader` を使うと、「ルートに入るときにデータを取る」「`action` で更新したら関連する `loader` を自動で再実行（revalidation）する」をルーターが面倒を見てくれます。

```tsx
// 概念図（Data モード）
const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
    loader: async () => {
      const [income, expense] = await Promise.all([
        fetch(`${BASE_URL}/transactions?type=income`).then((r) => r.json()),
        fetch(`${BASE_URL}/transactions?type=expense`).then((r) => r.json()),
      ]);
      return { income, expense };
    },
  },
  { path: "/input", Component: Input },
]);

// Home.tsx
const { income, expense } = useLoaderData();
```

### 3. データ取得ライブラリを使う

TanStack Query（React Query）や SWR を使うと、キャッシュ・再検証・登録後の無効化（`invalidateQueries`）などを宣言的に書けます。画面遷移時のローディングのチラつきも抑えられます。

## 次に学ぶこと

- Data モードの `loader` / `action` / revalidation（`useRevalidator`）
- TanStack Query のキャッシュと `invalidateQueries`
- `useLocation().key` と `key` prop による再マウント制御

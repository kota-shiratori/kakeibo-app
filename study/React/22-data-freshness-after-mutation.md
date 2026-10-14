# 登録後のデータ再取得と refetch

## 概要

データを登録・更新・削除した後は、一覧などの表示を最新の状態にする必要があります。React で手書きのデータ取得をしている場合、「いつ、誰が、もう一度データを取りに行くのか」を自分で設計しなければなりません。

このプロジェクトでは、**画面遷移によるコンポーネントの再マウント** によって、結果的に最新データが表示される仕組みになっています。その仕組みと、用意されているが使われていない `refetch` について整理します。

## このプロジェクトでの実装

### 登録 → 一覧へ戻る流れ

`web-app/src/pages/Input.tsx:38-46`

```tsx
const ok = await addTransaction({ item, amount: adjustAmount, date });

if (ok) {
  navigate("/");
}
```

`web-app/src/App.tsx:8-11`

```tsx
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/input" element={<Input />} />
</Routes>
```

何が起きているか:

```
1. Home 表示中に「登録」ボタン → navigate("/input")
   → Home はアンマウントされる（state も消える）
2. Input で登録成功 → navigate("/")
   → Input はアンマウント、Home が「新しく」マウントされる
3. Home の中の useIncomeTransactions / useExpenseTransactions も新しく呼ばれ、
   useEffect(..., []) が再び実行される（10 参照）
   → 最新のデータを取得して表示
```

`Routes` は URL に合う `Route` の要素だけを描画するので、別のパスへ移るとそれまでのページはアンマウントされます（ルーティングの詳細は study/Routing 参照）。つまり「マウントのたびに取得する」設計と「ページ遷移でアンマウントされる」構造の組み合わせで、登録内容が一覧に反映されています。

ただし Home の各カードに出るのは、サーバーが日付の新しい順（`ORDER BY date DESC`、`backend/src/index.ts:51`）で返した一覧の **先頭 3 件** だけです（`maxTransactions={3}`）。新しい日付の取引がすでに 3 件以上ある状態で古い日付の取引を登録すると、再取得はされていても画面には出てきません（並び順の詳細は 16 参照）。

### 用意されているが使われていない refetch

`web-app/src/hooks/transactions.ts:18` と `web-app/src/hooks/useIncomeTransactions.ts:34-39`

```ts
refetch: () => void;
```

```ts
return {
  transactionList: incomeList,
  isLoading,
  error,
  refetch: fetchIncomeTransactions,
};
```

`refetch` は「もう一度取得する」ための関数として返されていますが、現在どのコンポーネントからも呼ばれていません。

型の上では `() => void` ですが、実際に入っているのは `async` 関数（`() => Promise<void>`）です。TypeScript では「戻り値が `void` の関数型」に「何かを返す関数」を代入できるため、エラーにはなりません。その代わり、呼び出し側は完了を `await` で待てない形になっています。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 再マウント | 一度アンマウントされたコンポーネントが、新しく作り直されて表示されること。state は初期値から始まる |
| refetch | データを再取得すること・その関数 |
| キャッシュの無効化（invalidation） | 保持しているデータを「古い」とみなし、次に必要なときに取り直させること |
| ミューテーション（mutation） | データの作成・更新・削除のこと |

## 仕様・注意点

- **今の仕組みは「Home が必ずアンマウントされる」ことに依存しています。** 将来、同じ画面内にモーダルで登録フォームを出すように変えると、Home はアンマウントされないので、登録しても一覧は更新されません。そのときは `refetch` を呼ぶなどの対応が必要になります。
- 毎回マウント時に取得するので、Home に戻るたびに一瞬スピナーが表示され、通信も発生します。データをキャッシュする仕組みはありません。
- 収入と支出は別々のフックなので、どちらか一方だけ更新したくても、今の仕組みでは両方とも取り直します（再マウントされるため）。

## 今後に活かせるポイント

- データを変更する機能を作るときは、「変更後にどの画面のどのデータを取り直すか」を必ずセットで設計する。
- 「マウント時に取得」は単純で確実だが、キャッシュがないので通信が多くなる。規模が大きくなったら、キャッシュと無効化の仕組みを持つライブラリを検討する。
- 取得系フックから `refetch` を返しておくと、「更新ボタン」「登録後の再取得」などに後から対応しやすい。

## 改善するなら

### 1. 同じ画面で登録する場合は refetch を呼ぶ

```tsx
const income = useIncomeTransactions();
const expense = useExpenseTransactions();

const handleAdded = (type: "income" | "expense") => {
  if (type === "income") income.refetch();
  else expense.refetch();
};
```

### 2. refetch を「カウンターを増やすだけ」にして effect に一本化する

`refetch` が直接 fetch を呼ぶと、effect 経由の取得とクリーンアップの仕組みが別々になり、競合状態（11 参照）が起きやすくなります。再取得のきっかけを state にして、effect の依存配列に入れると、取得の入口が 1 つになります。

```ts
const [reloadKey, setReloadKey] = useState(0);

useEffect(() => {
  const controller = new AbortController();
  // ...（fetch に controller.signal を渡して取得）
  return () => controller.abort();
}, [reloadKey]);

const refetch = useCallback(() => setReloadKey((k) => k + 1), []);
```

（完全なコードは 12-custom-hooks.md の `useTransactions` を参照。）

### 3. 型を実態に合わせる

完了を待ちたい呼び出し側のために、型を `() => Promise<void>` にする選択肢もあります。

```ts
export type TransactionsHooks = {
  // ...
  refetch: () => Promise<void>;
};
```

### 4. TanStack Query でキャッシュと無効化を任せる（イメージ）

```tsx
// 取得
const { data, isPending, error } = useQuery({
  queryKey: ["transactions", "income"],
  queryFn: ({ signal }) => fetchTransactions("income", signal),
});

// 登録後に、関係するキャッシュを無効化して自動で再取得させる
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: postTransaction,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transactions"] }),
});
```

## 次に学ぶこと

- **TanStack Query / SWR**: キャッシュ・再取得・無効化・重複排除をまとめて扱うデータ取得ライブラリ。
- **`useOptimistic`**（React 19）: サーバーの応答を待たずに、登録した取引を一覧に先に表示する（楽観的更新）。
- **React Router のデータ API（loader / action）**: action 完了後に loader を自動で再実行してくれる仕組み（study/Routing 参照）。

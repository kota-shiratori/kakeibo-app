# Rules of Hooks（フックのルール）

## 概要

`useState` や `useEffect`、カスタムフックなどの **フックには守るべきルール** があります。

1. **トップレベルでのみ呼ぶ** — `if` / ループ / ネストした関数 / 早期 `return` の後で呼ばない
2. **React の関数からのみ呼ぶ** — 関数コンポーネントか、カスタムフックの中だけで呼ぶ

React は「何番目に呼ばれたフックか」という **呼び出し順** で、各フックの state を管理しています。描画ごとに呼び出し順が変わると、state の対応がずれて壊れてしまいます。ルールはそれを防ぐためのものです。

## このプロジェクトでの実装

### リンターでルールを強制している

`web-app/.oxlintrc.json:1-8`

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

`react/rules-of-hooks` を `"error"` にしているので、ルール違反は `npm run lint` でエラーになります（oxlint の設定は study/Tooling 参照）。

### ルールを守っている例: 早期 return より前でフックを呼ぶ

`web-app/src/components/TransactionList.tsx:33-50`

```tsx
export const RecentIncomeTransactionList = ({ maxTransactions }: RecentTransactionListProps) => {
  const incomeTransactions = useIncomeTransactions(); // ← トップレベルで無条件に呼ぶ
  return <RecentTransactionList hooks={incomeTransactions} maxTransactions={maxTransactions} />;
};
```

`web-app/src/components/TransactionList.tsx:78-98`

```tsx
const RecentTransactionList = ({ hooks, maxTransactions }: RecentTransactionListComponentProps) => {
  const { transactionList, isLoading, error } = hooks;

  if (isLoading) {
    return <Spinner />;  // ← 早期 return
  }
  // ...
};
```

`RecentTransactionList` には早期 return がありますが、この中ではフックを一切呼んでいません。フックは親の `RecentIncomeTransactionList` で呼び、**結果だけを props で受け取る** 設計なので、早期 return があっても安全です。

### フックの中でフックを呼ぶ（カスタムフック）

`web-app/src/hooks/useIncomeTransactions.ts:5-8, 30-32`

```ts
export const useIncomeTransactions = (): TransactionsHooks => {
  const [incomeList, setIncomeList] = useState<TransactionListInfo>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // ...
  useEffect(() => { /* ... */ }, []);
```

カスタムフックの中で `useState` / `useEffect` を呼ぶのは「React の関数から呼ぶ」に該当するので OK です。

### イベントハンドラではフックを呼ばない

`web-app/src/pages/Input.tsx:26-27, 29-31`

```tsx
const navigate = useNavigate();                                 // ← トップレベル
const { addTransaction, isLoading, error } = useAddTransactions(); // ← トップレベル

const handleSubmit = async (e: FormEvent) => {
  // ここで useAddTransactions() を呼ぶのは NG。
  // トップレベルで受け取った addTransaction 関数を呼ぶのが正しい。
  const ok = await addTransaction({ /* ... */ });
```

「フックはトップレベルで呼んで **関数や値を受け取り**、ハンドラの中では **受け取った関数を呼ぶ**」という役割分担がポイントです。`useNavigate()` も同じで、トップレベルで `navigate` 関数を受け取り、ハンドラ内で `navigate("/")` を呼んでいます。

## ルール違反の例

```tsx
// NG 1: 条件の中で呼ぶ
const Comp = ({ type }: { type: "income" | "expense" }) => {
  if (type === "income") {
    const data = useIncomeTransactions(); // 描画ごとに呼ばれたり呼ばれなかったりする
  }
};

// NG 2: 早期 return の後で呼ぶ
const Comp2 = ({ show }: { show: boolean }) => {
  if (!show) return null;
  const [value, setValue] = useState(""); // show が false の描画では呼ばれない
};

// NG 3: イベントハンドラの中で呼ぶ
const Comp3 = () => {
  const onClick = () => {
    const { addTransaction } = useAddTransactions();
  };
};

// NG 4: 普通の関数（名前が use で始まらない・コンポーネントでもない）の中で呼ぶ
function getData() {
  return useIncomeTransactions();
}
```

条件によって使うフックを変えたい場合は、**フックは常に呼び、引数や中の処理で分岐する** か、**コンポーネントを分ける** のが正解です。このプロジェクトが収入用・支出用のコンポーネントを分けているのは、まさに後者の形です。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| Rules of Hooks | フックはトップレベルで、React の関数からだけ呼ぶというルール |
| トップレベル | 関数本体の直下。`if` やループ、内側の関数の中ではない場所 |
| 呼び出し順 | React が各フックの state を識別するために使う「何番目のフック呼び出しか」 |
| `react/rules-of-hooks` | ルール違反を検出するリンタールール（ESLint の react-hooks プラグイン由来。oxlint にも実装がある） |

## 仕様・注意点

- **React 19 の `use` は例外的に、`if` の中などで条件付きで呼べます**（ただしコンポーネントかフックの中であることは必要）。名前は似ていても他のフックと扱いが違うので注意。
- `use` で始まる名前の関数は、リンターが「フック」とみなしてルールを適用します。中でフックを使っていない関数に `use` を付けると、不要な制約を受けることになります。
- `try` / `catch` / `finally` ブロックの中で呼ぶのもルール違反です。

## 今後に活かせるポイント

- 「フックはコンポーネントの先頭にまとめて書く → その後に計算・早期 return → 最後に JSX を返す」という順序を習慣にすると、ルール違反をほぼ防げる。
- 早期 return が多い表示コンポーネントは、フックを持たない「表示専用」にし、フックは親で呼んで props で渡す（このプロジェクトの `RecentTransactionList` 方式）。
- 新しいプロジェクトでも最初から `rules-of-hooks` をリンターで有効にしておく。

## 改善するなら

ルールの順守自体には問題はありません。追加するなら、依存配列の漏れを検出する `react/exhaustive-deps` も有効にしておくと、10・11 で説明した依存配列の問題に気づきやすくなります（実際にどこまで検出されるかはツールのバージョンで異なるので、導入時に確認すること）。

```json
{
  "rules": {
    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "warn",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

（lint 設定の詳細は study/Tooling 参照。）

## 次に学ぶこと

- **React Compiler と `eslint-plugin-react-hooks` の新ルール群**: コンポーネントの純粋性などをより広く検査する（oxlint の `set-state-in-effect` もこの流れのルール）。
- **`use` API**: 条件付きで呼べる特別なフック。Promise や Context を読む。

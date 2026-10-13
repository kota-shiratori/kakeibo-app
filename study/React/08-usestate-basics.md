# useState の基本（初期値・型引数・更新関数）

## 概要

`useState` は、コンポーネントに **状態（state）** を持たせるためのフックです。
コンポーネントは描画のたびに関数が呼び直されるので、普通の変数は毎回リセットされます。描画をまたいで値を覚えておき、**値が変わったら画面を描き直してほしい** ときに `useState` を使います。

## このプロジェクトでの実装

### フォーム入力の状態

`web-app/src/pages/Input.tsx:20-24`

```tsx
const [transactionType, setTransactionType] =
  useState<TransactionType>("expense");
const [item, setItem] = useState("");
const [amount, setAmount] = useState("");
const [date, setDate] = useState("");
```

`useState(初期値)` は **長さ 2 の配列** を返し、それを配列の分割代入で受け取っています。

- 1 つ目（`item`）… 現在の値
- 2 つ目（`setItem`）… 値を更新する関数（**セッター**、更新関数）

命名は `[xxx, setXxx]` とするのが慣習です。

### 型引数あり・なしの使い分け

| コード | 推論される型 | 説明 |
| --- | --- | --- |
| `useState("")` (`Input.tsx:22`) | `string` | 初期値から型が推論されるので型引数不要 |
| `useState(true)` (`useIncomeTransactions.ts:7`) | `boolean` | 同上 |
| `useState<TransactionType>("expense")` (`Input.tsx:20-21`) | `"income" \| "expense"` | 型引数なしだと `string` と推論されてしまうので、型引数で絞る |
| `useState<Error \| null>(null)` (`useIncomeTransactions.ts:8`) | `Error \| null` | 初期値 `null` だけだと型が `null` になってしまうので、型引数で広げる |
| `useState<TransactionListInfo>()` (`useIncomeTransactions.ts:6`) | `TransactionListInfo \| undefined` | 初期値を省略すると `undefined` が含まれる |

最後の行は `@types/react` の次のオーバーロードによるものです（`node_modules/@types/react/index.d.ts:1704`）。

```ts
function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
```

そのため `TransactionsHooks` の型でも `transactionList: TransactionListInfo | undefined;`（`web-app/src/hooks/transactions.ts:15`）となっています。

### 更新関数を呼ぶ

`web-app/src/pages/Input.tsx:90`

```tsx
onChange={(e) => setItem(e.target.value)}
```

`setItem(新しい値)` を呼ぶと、React は **新しい値でコンポーネントを再描画** します。再描画時には `useState("")` の行が再び実行されますが、初期値 `""` は無視され、覚えている最新の値が返ってきます。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| state（状態） | コンポーネントが描画をまたいで覚えておく値。変わると再描画される |
| フック（Hook） | `use` で始まる、React の機能をコンポーネントから使うための関数 |
| セッター / 更新関数 | `setXxx`。新しい値を渡して state を更新し、再描画を予約する |
| 初期値 | 最初の描画でだけ使われる値。2 回目以降は無視される |
| 型引数（ジェネリクス） | `useState<型>()` の `<型>` 部分。state の型を明示する |

## 仕様・注意点

- **初期値は最初の描画でしか使われません。** 例えば props から初期値を作った場合、後で props が変わっても state は自動では追従しません。
- **初期値の計算が重い場合は関数で渡す（遅延初期化）。** `useState(heavyCalc())` だと毎回の描画で `heavyCalc` が実行されてしまいます（結果は捨てられる）。`useState(() => heavyCalc())` と関数を渡すと、初回だけ実行されます。型定義上も `initialState: S | (() => S)` となっています（`index.d.ts:1696`）。
- **state を直接書き換えない。** `item = "x"` や、オブジェクト・配列の state に `list.push(x)` をしても React は変更に気づきません。必ずセッターに **新しい値** を渡します（配列なら `setList([...list, x])`）。
- **同じ値をセットしても再描画されない（ことがある）。** React は `Object.is` で前の値と比べ、同じなら再描画を省略します。
- **セッターを呼んでも、その場で変数は変わりません。** 次の描画で新しい値になります（09 参照）。
- フォームの `amount` は数値ですが、`<input type="number">` の `e.target.value` は **文字列** なので、state も文字列（`useState("")`）で持ち、送信時に `Number(amount)` で変換しています（`Input.tsx:32`）。入力欄が空のときに `0` ではなく空欄を表示できるという利点があります。

## 今後に活かせるポイント

- 型引数は「初期値から推論される型が狭すぎる / 広すぎるとき」だけ書けばよい。
- 「まだデータがない」状態を `undefined` で表すか、`null` で表すかをプロジェクト内で統一すると読みやすい（このプロジェクトはデータが `undefined`、エラーが `null` と混在している）。
- フォームの入力値は「表示用の文字列」として state に持ち、送信時に変換するのが扱いやすい。

## 改善するなら

フォームの項目が増えると `useState` が並びがちです。関連する値は 1 つのオブジェクトにまとめる方法もあります（ただし更新時にスプレッド構文が必要になる）。

```tsx
type FormState = {
  transactionType: TransactionType;
  item: string;
  amount: string;
  date: string;
};

const [form, setForm] = useState<FormState>({
  transactionType: "expense",
  item: "",
  amount: "",
  date: "",
});

// 更新: 前の値をコピーして 1 項目だけ変える
<Input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
```

項目数が少ないうちは、現状のように個別の `useState` の方がシンプルで読みやすいので、無理にまとめる必要はありません。項目が多くバリデーションも必要になったら React Hook Form などの導入を検討します（18 参照）。

また、日付の初期値を空ではなく「今日」にすると入力の手間が減ります。遅延初期化の良い例です。

```tsx
const [date, setDate] = useState(() => new Date().toLocaleDateString("sv-SE")); // "2026-10-12" 形式
```

（`sv-SE` ロケールが `YYYY-MM-DD` 形式になることを利用した小技。`toISOString()` は UTC 基準なので、日本時間の深夜〜朝 9 時には前日の日付になる点に注意。）

## 次に学ぶこと

- **`useReducer`**: 状態の更新ロジックが複雑なときに、更新処理を 1 か所にまとめるフック。
- **state の持ち上げ（Lifting State Up）**: 複数のコンポーネントで state を共有したいとき、共通の親に state を置く考え方。
- **`useRef`**: 値を覚えておきたいが、変わっても再描画は不要なときに使うフック。

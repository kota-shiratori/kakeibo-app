# 制御コンポーネント（value + onChange）

## 概要

フォームの入力欄の値を **React の state で管理する** 方式を **制御コンポーネント（controlled component）** と呼びます。

- `value={state}` で、入力欄に表示する値を state から決める
- `onChange={(e) => setState(e.target.value)}` で、ユーザーが入力するたびに state を更新する

「state が唯一の正しい値（Single Source of Truth）」になるので、入力値を使った表示・バリデーション・送信が簡単になります。

これに対して、入力欄の値をブラウザ（DOM）に任せ、必要なときに読み取る方式を **非制御コンポーネント（uncontrolled component）** と呼びます。

## このプロジェクトでの実装

### 制御コンポーネント: 項目・金額・日付

`web-app/src/pages/Input.tsx:22-24`

```tsx
const [item, setItem] = useState("");
const [amount, setAmount] = useState("");
const [date, setDate] = useState("");
```

`web-app/src/pages/Input.tsx:84-110`

```tsx
<Field.Root required>
  <Field.Label>項目</Field.Label>
  <Input
    placeholder="項目を入力してください"
    value={item}
    maxLength={20}
    onChange={(e) => setItem(e.target.value)}
  />
</Field.Root>
<Field.Root required>
  <Field.Label>金額</Field.Label>
  <Input
    type="number"
    placeholder="金額を入力してください"
    value={amount}
    onChange={(e) => setAmount(e.target.value)}
    min={0}
  />
</Field.Root>
<Field.Root required>
  <Field.Label>日付</Field.Label>
  <Input
    type="date"
    value={date}
    onChange={(e) => setDate(e.target.value)}
  />
</Field.Root>
```

データの流れ:

```
ユーザーが「ラ」と入力
  → onChange が呼ばれる（e.target.value === "ラ"）
  → setItem("ラ")
  → 再描画。value={item} に "ラ" が入り、入力欄に「ラ」が表示される
```

入力欄に表示される文字は、常に state `item` の値です。`Field.Root` / `Input` などの部品は Chakra UI のもの（study/ChakraUI 参照）ですが、`value` / `onChange` の仕組みは HTML の `<input>` と同じです。

### 非制御コンポーネント: 収支の種別（ラジオボタン）

`web-app/src/pages/Input.tsx:65-70`

```tsx
<RadioGroup.Root
  defaultValue="expense"
  onValueChange={(e) =>
    setTransactionType(e.value as TransactionType)
  }
>
```

こちらは `value` ではなく **`defaultValue`**（初期値だけ指定）を使っています。選択状態は RadioGroup 自身が内部で管理し、変化を `onValueChange` で通知して state にも写しています。つまり「表示上の選択状態（RadioGroup 内部）」と「送信に使う値（state `transactionType`）」が **2 か所** にある状態です。現状は初期値がどちらも `"expense"` で一致しているので問題なく動きます。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 制御コンポーネント | 入力値を state で持ち、`value` と `onChange` で同期させる方式 |
| 非制御コンポーネント | 入力値を DOM（または部品の内部）に任せる方式。`defaultValue` で初期値だけ渡す |
| Single Source of Truth | 正しい値の置き場所を 1 か所に決めること |
| `defaultValue` | 非制御コンポーネントの初期値。後から変えても表示は変わらない |

## 仕様・注意点

- **`value` を指定して `onChange` を書かないと、入力できなくなります。** React は `value` の値を表示し続けるため、キーを押しても state が変わらず元に戻ります。開発時には警告も出ます。読み取り専用にしたいなら `readOnly` を付けます。
- **`value` に `undefined` を渡すと非制御扱いになります。** 後から文字列に変わると「非制御から制御に切り替わった」という警告が出ます。このプロジェクトのように初期値を `""` にしておけば安全です。
- **入力値は常に文字列です。** `type="number"` でも `e.target.value` は文字列（例: `"1500"`）なので、計算に使うときは `Number()` で変換します（`Input.tsx:32`）。
- 1 文字入力するたびにコンポーネント全体が再描画されます。小さなフォームでは問題になりませんが、巨大なフォームでは非制御方式（React Hook Form など）の方が有利なことがあります。
- `maxLength={20}` や `min={0}`、`required` は HTML 標準の入力制約です。`min={0}` はスピンボタンや送信時のブラウザ検証には効きますが、キーボードで `-5` と打つこと自体は防げません。

## 今後に活かせるポイント

- 入力値をリアルタイムに使う（文字数表示・入力中のバリデーション・入力に応じた表示切替）なら制御コンポーネント。
- 制御か非制御か、**1 つの入力については必ずどちらかに統一** する。
- 送信後にフォームをクリアしたいときも、制御コンポーネントなら `setItem("")` するだけで済む。

## 改善するなら

### ラジオボタンも制御コンポーネントにして「値の置き場所」を 1 つにする

```tsx
<RadioGroup.Root
  value={transactionType}
  onValueChange={(e) => setTransactionType(e.value as TransactionType)}
>
```

`defaultValue` を `value={transactionType}` に変えるだけで、表示と state が常に一致します。初期値を変えたいときも `useState<TransactionType>("expense")` の 1 か所を直すだけになります（Chakra UI v3 の RadioGroup の `value` / `onValueChange` の詳細は study/ChakraUI 参照）。

### 項目が増えたらフォームライブラリを検討

```tsx
// React Hook Form の例（イメージ）
const { register, handleSubmit } = useForm<FormValues>({
  defaultValues: { item: "", amount: "", date: "" },
});

<Input {...register("item", { required: true, maxLength: 20 })} />
```

## 次に学ぶこと

- **React Hook Form**: 非制御方式をベースにした高速なフォームライブラリ。Zod と組み合わせたバリデーションが定番。
- **React 19 のフォーム Actions**: `<form action={関数}>` と `useActionState` で、`FormData` から値を読む非制御寄りの書き方（19 参照）。
- **`useId`**: ラベルと入力欄を結び付ける一意な ID を生成するフック。

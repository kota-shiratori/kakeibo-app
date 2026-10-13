# RadioGroup（Root / Item / ItemHiddenInput / ItemIndicator / ItemText と onValueChange）

## 概要

`RadioGroup` は「複数の選択肢から1つを選ぶ」ラジオボタンの部品です。v3 では複合コンポーネントとして提供され、内部の状態管理とキーボード操作・ARIA 属性は **Ark UI（さらにその下の Zag.js）** が担当しています。

パーツ一覧（`dist/types/components/radio-group/namespace.d.ts`）:

| パーツ | 役割 |
| --- | --- |
| `RadioGroup.Root` | グループ全体。選択値（value）を管理する |
| `RadioGroup.Label` | グループ全体のラベル |
| `RadioGroup.Item` | 選択肢1つ分（`<label>` として描画） |
| `RadioGroup.ItemHiddenInput` | 画面には見えない本物の `<input type="radio">` |
| `RadioGroup.ItemIndicator` | 丸いラジオマーク（見た目） |
| `RadioGroup.ItemControl` | ItemIndicator の土台となるパーツ（自分で組み立てる場合に使用） |
| `RadioGroup.ItemText` | 選択肢のテキスト |

## このプロジェクトでの実装

`web-app/src/pages/Input.tsx:65-83`

```tsx
<RadioGroup.Root
  defaultValue="expense"
  onValueChange={(e) =>
    setTransactionType(e.value as TransactionType)
  }
>
  <HStack gap={4}>
    <RadioGroup.Item value="expense">
      <RadioGroup.ItemHiddenInput />
      <RadioGroup.ItemIndicator />
      <RadioGroup.ItemText>支出</RadioGroup.ItemText>
    </RadioGroup.Item>
    <RadioGroup.Item value="income">
      <RadioGroup.ItemHiddenInput />
      <RadioGroup.ItemIndicator />
      <RadioGroup.ItemText>収入</RadioGroup.ItemText>
    </RadioGroup.Item>
  </HStack>
</RadioGroup.Root>
```

`web-app/src/pages/Input.tsx:20-21`（対応する state）

```tsx
const [transactionType, setTransactionType] =
  useState<TransactionType>("expense");
```

### 処理の流れ

1. 初期表示時、`defaultValue="expense"` により「支出」が選択された状態になる
2. ユーザーが「収入」をクリック → `RadioGroup.Root` 内部の状態が `"income"` に変わる
3. `onValueChange` が呼ばれ、引数 `e` の `e.value` に `"income"` が入っている
4. `setTransactionType` で React の state を更新 → 送信時（`Input.tsx:34`）に支出なら金額をマイナスにするのに使われる

### onValueChange の引数の型（node_modules で確認）

`@zag-js/radio-group/dist/radio-group.types.d.ts`

```ts
interface ValueChangeDetails {
    value: string | null;
}
// RadioGroup の props（抜粋）
value?: string | null | undefined;          // 制御モードの値
defaultValue?: string | null | undefined;   // 非制御モードの初期値
name?: string | undefined;                  // フォーム送信用の name
disabled?: boolean; invalid?: boolean; required?: boolean; readOnly?: boolean;
onValueChange?: ((details: ValueChangeDetails) => void) | undefined;
orientation?: "horizontal" | "vertical" | undefined;
```

- 引数はイベントオブジェクトではなく **「詳細オブジェクト（details）」** です。値は `e.target.value` ではなく **`e.value`** で取り出します。
- `e.value` の型は `string | null`。`TransactionType`（`"income" | "expense"`）ではないので、このコードでは `as TransactionType` で型を合わせています。

### 各パーツの実装

- `RadioGroup.Item` は Ark UI の `RadioGroup.Item` で、`<label>` 要素として描画されます（`@ark-ui/react/.../radio-group-item.js` の `ark.label`）。そのため選択肢の文字をクリックしても選択できます。
- `RadioGroup.ItemIndicator` は Chakra 側で `ItemControl` + `Radiomark`（丸印）を組み合わせたものです（`dist/esm/components/radio-group/radio-group.js`）。
- `RadioGroup.ItemHiddenInput` は本物の `<input type="radio">` を視覚的に隠して描画します。キーボード操作やフォーム送信、フォーカスのために必要です。

### 見た目（`theme/recipes/radio-group.js` / `radiomark.js`）

既定は `variant: "solid"`, `size: "md"`。選択時のマークは `bg: "colorPalette.solid"` です。このコードでは `colorPalette` を指定していないので、既定の `gray`（`html` に設定されている `colorPalette: "gray"`）が使われ、選択時は gray.900（ほぼ黒）の丸になります。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| 非制御（uncontrolled） | 値をコンポーネント内部で管理し、初期値だけ `defaultValue` で渡す方式 |
| 制御（controlled） | 値を React の state で管理し、`value` で常に渡す方式 |
| `onValueChange` | 選択値が変わったときに呼ばれるコールバック。引数は `{ value }` |
| ValueChangeDetails | `onValueChange` の引数の型（`{ value: string \| null }`） |
| Zag.js | Ark UI の内部で使われている、状態機械（ステートマシン）ベースの UI ロジックライブラリ |
| 型アサーション（`as`） | 「この値はこの型だ」と TypeScript に伝える書き方。実行時のチェックはない |

## 仕様・注意点

- **v2 との違い**:
  - v2 は `<RadioGroup onChange={(value) => ...}>` + `<Radio value="...">` で、`onChange` の引数は値（文字列）そのものでした。
  - v3 は `RadioGroup.Root` + `RadioGroup.Item` の複合コンポーネントになり、コールバック名は **`onValueChange`**、引数は **`{ value }` オブジェクト** です。v2 の書き方を真似て `onValueChange={(value) => setX(value)}` と書くと、オブジェクトが state に入るバグになります。
- **初期値が2か所にある**: `useState<TransactionType>("expense")` と `defaultValue="expense"` の両方で初期値を指定しています。どちらかだけ変更すると、画面の表示と state がずれるバグの原因になります。
- `as TransactionType` は実行時チェックをしないので、もし `value` に想定外の文字列が来ても気づけません。
- `ItemHiddenInput` を省略すると、キーボード操作やフォーカス表示が正しく動かない可能性があります。公式の例でも必ず含まれているので、省略しないのが安全です。
- `RadioGroup.Root` に `name` を指定していません。今回は JavaScript（state）で値を扱っているので問題ありませんが、`FormData` で値を取り出したい場合は `name` が必要です。

## 今後に活かせるポイント

- 「イベントオブジェクトではなく details オブジェクトを受け取るコールバック」は、Ark UI / Zag.js ベースの v3 部品（Checkbox の `onCheckedChange`、Select の `onValueChange`、Dialog の `onOpenChange` など）に共通の形です。
- 制御 / 非制御の違いは React のフォーム全般で重要な概念です（詳しくは study/React）。

## 改善するなら

1. **制御コンポーネントにして初期値を1か所にする**

```tsx
<RadioGroup.Root
  value={transactionType}
  onValueChange={(e) => {
    if (e.value === "income" || e.value === "expense") {
      setTransactionType(e.value); // 型ガードにより as が不要になる
    }
  }}
  colorPalette="teal"
>
```

- `value={transactionType}` で、表示は常に state と一致します。
- `if` による型の絞り込み（型ガード）で、`as` を使わずに安全に `TransactionType` として扱えます。
- `colorPalette="teal"` で、選択マークをアプリのテーマ色に揃えられます。

2. **グループにラベルを付ける**（スクリーンリーダー向けに「何を選ぶラジオか」を伝える）

```tsx
<RadioGroup.Root ...>
  <RadioGroup.Label>種類</RadioGroup.Label>
  <HStack gap={4}>...</HStack>
</RadioGroup.Root>
```

3. 選択肢を配列にして `map` で描画すると、重複が減り、選択肢の追加が簡単になります。

```tsx
const options = [
  { value: "expense", label: "支出" },
  { value: "income", label: "収入" },
] as const;

{options.map((o) => (
  <RadioGroup.Item key={o.value} value={o.value}>
    <RadioGroup.ItemHiddenInput />
    <RadioGroup.ItemIndicator />
    <RadioGroup.ItemText>{o.label}</RadioGroup.ItemText>
  </RadioGroup.Item>
))}
```

## 次に学ぶこと

- `SegmentGroup`（支出/収入のような2択を、セグメント切り替えボタン風に表示できる）
- `RadioCard`（カード型の選択肢）
- `Checkbox` / `Switch`（`onCheckedChange` の details パターン）

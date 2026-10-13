# Input（テキスト・数値・日付の入力欄）

## 概要

`Input` は `<input>` 要素にスタイルを付けた部品です。`type` を変えるだけで、テキスト・数値・日付などの入力欄になります。
`Field.Root` の中に置くと、`required` などの状態やラベルとの紐付けが自動で行われます（[15-field.md](./15-field.md)）。

## このプロジェクトでの実装

`web-app/src/pages/Input.tsx:86-91`（テキスト）

```tsx
<Input
  placeholder="項目を入力してください"
  value={item}
  maxLength={20}
  onChange={(e) => setItem(e.target.value)}
/>
```

`web-app/src/pages/Input.tsx:95-101`（数値）

```tsx
<Input
  type="number"
  placeholder="金額を入力してください"
  value={amount}
  onChange={(e) => setAmount(e.target.value)}
  min={0}
/>
```

`web-app/src/pages/Input.tsx:105-109`（日付）

```tsx
<Input
  type="date"
  value={date}
  onChange={(e) => setDate(e.target.value)}
/>
```

- `value` + `onChange` で React の state と同期する **制御コンポーネント** として使っています（state の仕組みは study/React 参照）。
- `maxLength` / `min` / `type` / `placeholder` は通常の HTML 属性で、そのまま `<input>` に渡ります。

### 実装とレシピ（node_modules で確認）

`dist/esm/components/input/input.js`

```js
import { Field } from '@ark-ui/react/field';
const { withContext, PropsProvider } = createRecipeContext({ key: "input" });
const Input = withContext(Field.Input);
```

`dist/esm/theme/recipes/input.js`（抜粋）

```js
base: {
  width: "100%",
  borderRadius: "l2",
  height: "var(--input-height)",
  "--focus-color": "colors.colorPalette.focusRing",
  "--error-color": "colors.border.error",
  _invalid: { focusRingColor: "var(--error-color)", borderColor: "var(--error-color)" }
},
variants: {
  size: { /* 2xs〜2xl */ md: { textStyle: "sm", px: "3", "--input-height": "sizes.10" } },
  variant: { outline: {...}, subtle: {...}, flushed: {...} }
},
defaultVariants: { size: "md", variant: "outline" }
```

既定では「幅 100%・高さ 40px（sizes.10 = 2.5rem）・枠線あり（outline）」の入力欄になります。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| 制御コンポーネント | 入力値を React の state で管理し、`value` と `onChange` で同期する方式 |
| `type="number"` | 数値入力欄。スピンボタン付き。`value` は **文字列** で取得される |
| `type="date"` | ブラウザ標準の日付ピッカー。値は `"YYYY-MM-DD"` 形式の文字列 |
| `variant` | outline（枠線）/ subtle（塗り）/ flushed（下線のみ） |

## 仕様・注意点

- **`type="number"` でも `e.target.value` は文字列**です。このプロジェクトでも `Number(amount)` で数値に変換しています（`Input.tsx:32`）。
- `min={0}` はブラウザのバリデーション（送信時チェック）とスピンボタンの下限に効きますが、キーボードで `-5` と入力すること自体は防げません。
- `type="number"` は `e`（指数表記）や小数も入力欄に打ち込めてしまいます。ただし `type="number"` の `step` の既定値は `1` なので、`1.5` のような小数は送信時のブラウザのバリデーションで「無効」と判定されます（`step` を書かなくても整数のみ。小数を許可したいときは `step="0.01"` や `step="any"` を指定）。入力そのものを制限したい場合は Chakra の `NumberInput` を検討します。
- **v2 との違い**: v2 の `Input` は `isInvalid` / `isDisabled` / `isRequired` を受け取りましたが、v3 では `Field.Root` 側で `invalid` / `disabled` / `required` を指定するのが基本です。Input 単体でも HTML 標準の `disabled` / `required` 属性は使えます。
- `Input` の既定 `width` は 100% なので、親要素の幅いっぱいに広がります。

## 今後に活かせるポイント

- `type` を正しく選ぶと、スマホでは適切なキーボード（数字キーなど）が表示され、入力しやすくなります。
- HTML 標準の属性（`maxLength`, `min`, `step`, `inputMode`, `autoComplete`）を活用するだけで、入力体験はかなり改善できます。

## 改善するなら

1. 金額欄を整数のみ・スマホで数字キーボードにする。

```tsx
<Input
  type="number"
  inputMode="numeric"
  step={1}
  min={1}
  value={amount}
  onChange={(e) => setAmount(e.target.value)}
/>
```

2. 「円」を入力欄の右に表示したい場合は `InputGroup` が使えます。

```tsx
import { InputGroup } from "@chakra-ui/react";

<InputGroup endElement="円">
  <Input type="number" ... />
</InputGroup>
```

3. 日付の初期値を今日にしておくと、入力の手間が減ります（`useState(() => new Date().toISOString().slice(0, 10))` など。ただし `toISOString()` は UTC なのでタイムゾーンに注意）。

## 次に学ぶこと

- `NumberInput`（増減ボタン付きの数値入力。複合コンポーネント）
- `InputGroup`（入力欄の前後にアイコンや単位を付ける）
- `Textarea` / `NativeSelect` / `DatePicker`

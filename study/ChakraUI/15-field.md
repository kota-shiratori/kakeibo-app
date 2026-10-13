# Field（Field.Root / Field.Label と required）

## 概要

`Field` は、フォームの「ラベル + 入力欄 + 補足説明 + エラーメッセージ」を1つのまとまりとして扱う複合コンポーネントです（v2 の `FormControl` に相当）。
`Field.Root` に `required` / `invalid` / `disabled` / `readOnly` を指定すると、その情報が中の `Input` や `Label` に自動で伝わり、`id` と `htmlFor` の紐付けや ARIA 属性も自動で設定されます。

パーツ一覧（`dist/types/components/field/namespace.d.ts`）:

| パーツ | 役割 |
| --- | --- |
| `Field.Root` | 全体。状態（required / invalid など）を持つ |
| `Field.Label` | ラベル（`<label>`、入力欄と自動で紐付く） |
| `Field.HelperText` | 補足説明 |
| `Field.ErrorText` | エラーメッセージ（**invalid のときだけ表示**） |
| `Field.ErrorIcon` | エラーアイコン |
| `Field.RequiredIndicator` | 必須マーク（既定は `*`、**required のときだけ表示**） |

## このプロジェクトでの実装

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
  <Input type="number" ... min={0} />
</Field.Root>
<Field.Root required>
  <Field.Label>日付</Field.Label>
  <Input type="date" ... />
</Field.Root>
```

### required がどう伝わるか（node_modules で確認）

Chakra の `Input` は Ark UI の `Field.Input` をラップしたものです（`dist/esm/components/input/input.js`: `const Input = withContext(Field.Input)`）。
Ark UI の `useField`（`@ark-ui/react/dist/components/field/use-field.js`）は、入力欄に次の props を渡します。

```js
const getControlProps = () => ({
  "aria-describedby": hasHelperText ? helperTextId : void 0,
  "aria-errormessage": errorMessageId,
  "aria-invalid": ariaAttr(invalid),
  "data-invalid": dataAttr(invalid),
  "data-required": dataAttr(required),
  id,
  required,
  disabled,
  readOnly
});
```

ラベルには `htmlFor: id` が付きます。つまり:

1. `<Field.Root required>` と書くだけで、中の `<input>` に **HTML の `required` 属性** が付く
2. `<form>`（このプロジェクトでは `VStack as="form"`）の送信時に、空欄があればブラウザが送信を止めて「このフィールドを入力してください」と表示する
3. ラベルをクリックすると入力欄にフォーカスが移る（`id` / `htmlFor` が自動で一致）

### スロットレシピ（`dist/esm/theme/recipes/field.js` 抜粋）

```js
root:  { display: "flex", width: "100%", position: "relative", gap: "1.5" },
label: { display: "flex", alignItems: "center", textStyle: "sm", fontWeight: "medium", gap: "1", ... },
requiredIndicator: { color: "fg.error", lineHeight: "1" },
errorText: { ..., color: "fg.error", textStyle: "xs" },
// orientation: vertical（既定）なら flexDirection: column, alignItems: flex-start
```

## 重要語句

| 語句 | 意味 |
| --- | --- |
| `required` | 必須入力。HTML の required 属性として input に付く |
| `invalid` | エラー状態。`aria-invalid` が付き、`Field.ErrorText` が表示される |
| `htmlFor` / `id` | label と input を紐付ける HTML の仕組み |
| `aria-invalid` / `aria-describedby` | スクリーンリーダーに状態や説明を伝える属性 |
| 制約バリデーション | `required` / `min` / `maxLength` などによるブラウザ標準の入力チェック |

## 仕様・注意点

- **`Field.Label` だけでは必須マーク（`*`）は表示されません**。`Field.RequiredIndicator` を明示的に置く必要があります（実装: `if (!field?.required) return fallback;` で required のときだけ描画）。現状のコードでは、必須であることが画面上で見えません。
- **`Field.ErrorText` は `invalid` が true のときだけ描画されます**（Ark UI の実装: `if (field?.invalid) return <ark.span .../>; return null;`）。`invalid` を指定しないと書いても表示されません。
- **v2 との違い**: v2 は `<FormControl isRequired isInvalid>` + `<FormLabel>` + `<FormErrorMessage>` でした。v3 は `Field.Root required invalid` + `Field.Label` + `Field.ErrorText` で、`is` 接頭辞がなくなりました（`isRequired` / `isInvalid` は v3 の型定義に存在しない）。
- v2 の `FormLabel` は required 時に自動で `*` を表示していましたが、v3 では `Field.RequiredIndicator` を自分で置く方式です。

## 今後に活かせるポイント

- ラベルと入力欄の紐付けや ARIA 属性を手書きするのは手間がかかり、ミスも起きがちです。Field のような部品に任せると、アクセシブルなフォームを簡単に作れます。
- ブラウザ標準のバリデーション（`required`, `min`, `maxLength`）は、JavaScript を書かずに使える最初の防衛線です。サーバー側の検証（study/Hono, study/API-Design 担当）と組み合わせて使います。

## 改善するなら

1. **必須マークを表示する**

```tsx
<Field.Root required>
  <Field.Label>
    項目
    <Field.RequiredIndicator />
  </Field.Label>
  <Input ... />
</Field.Root>
```

2. **Field.ErrorText でフィールドごとのエラーを表示する**（例: 金額が 0 以下）

```tsx
const amountInvalid = amount !== "" && Number(amount) <= 0;

<Field.Root required invalid={amountInvalid}>
  <Field.Label>
    金額 <Field.RequiredIndicator />
  </Field.Label>
  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={0} />
  <Field.HelperText>支出も正の数で入力してください</Field.HelperText>
  <Field.ErrorText>1円以上の金額を入力してください</Field.ErrorText>
</Field.Root>
```

`invalid` のとき、入力欄の枠が赤くなり（input レシピの `_invalid: { borderColor: "var(--error-color)" }`）、エラーテキストが表示されます。

3. フォーム全体のエラー（`Input.tsx:111` の `error.message`）は、`Alert` 部品で表示すると目立ちやすくなります。

## 次に学ぶこと

- `Fieldset`（複数の Field をグループ化。ラジオグループのまとまりにも使える）
- React Hook Form + Zod との組み合わせ（`invalid={!!errors.amount}` のように連携）
- `Alert`（フォーム全体のエラー表示）

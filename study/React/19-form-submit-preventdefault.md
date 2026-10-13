# フォーム送信と e.preventDefault()

## 概要

HTML の `<form>` は、送信されると **ページ全体を再読み込み（またはページ遷移）** してサーバーにデータを送る、というのがブラウザの標準動作です。

React のような SPA（シングルページアプリケーション）では、ページを再読み込みすると state がすべて消えてしまいます。そこで、送信イベントのハンドラで **`e.preventDefault()` を呼んでブラウザの標準動作を止め**、代わりに JavaScript（`fetch`）でデータを送ります。

## このプロジェクトでの実装

### form 要素と onSubmit

`web-app/src/pages/Input.tsx:58-64`

```tsx
<VStack
  maxW="xl"
  width="full"
  gap={4}
  as="form"
  onSubmit={handleSubmit}
>
```

Chakra UI の `VStack` に `as="form"` を指定して、実際の HTML としては `<form>` 要素を出力しています（`as` の詳細は study/ChakraUI 参照）。`onSubmit` にハンドラを渡しているので、フォームが送信されると `handleSubmit` が呼ばれます。

### 送信ボタンとキャンセルボタン

`web-app/src/pages/Input.tsx:113-131`

```tsx
<Button type="button" /* ... */ onClick={onCancel}>
  キャンセル
</Button>
<Button type="submit" colorPalette="teal" flex={1} fontWeight="bold" loading={isLoading}>
  登録
</Button>
```

- `type="submit"` のボタンをクリックすると、フォームの `submit` イベントが発生します。入力欄で Enter キーを押したときも同様です。
- キャンセルボタンには **`type="button"`** が明示されています。`<form>` の中の `<button>` は、`type` を省略すると **`submit` 扱い** になるため、これがないとキャンセルを押してもフォームが送信されてしまいます。正しい書き方です。

### 送信ハンドラ

`web-app/src/pages/Input.tsx:29-47`

```tsx
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();               // ① ページの再読み込みを止める

  let adjustAmount = Number(amount); // ② 文字列 → 数値
  if (transactionType === "expense" && adjustAmount > 0) {
    adjustAmount = -adjustAmount;    // ③ 支出ならマイナスにする
  }

  const ok = await addTransaction({  // ④ API に送信
    item,
    amount: adjustAmount,
    date,
  });

  if (ok) {
    navigate("/");                   // ⑤ 成功したら一覧画面へ
  }
};
```

1. `e.preventDefault()` でブラウザ標準の送信（再読み込み）を止める。
2. 金額の state は文字列なので `Number()` で数値にする。
3. 「支出」が選ばれていたら符号を反転。サーバーには「収入はプラス、支出はマイナス」で送る仕様になっている（API の仕様は study/API-Design 参照）。
4. カスタムフックの `addTransaction` で POST。成否が `true` / `false` で返ってくる。
5. 成功時だけ画面遷移。失敗時は画面に留まり、`error` が `Input.tsx:111` で表示される。

### ブラウザの入力検証

`Field.Root required`（`Input.tsx:84, 93, 103`）により、入力欄に `required` 属性が付きます（Chakra UI の `Field` の仕組みは study/ChakraUI 参照）。ブラウザ標準の検証は **`submit` イベントの前** に行われるので、未入力の項目があると `handleSubmit` 自体が呼ばれず、ブラウザが「このフィールドを入力してください」と表示します。そのため `handleSubmit` の中では「空欄かどうか」のチェックを省略できています。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `submit` イベント | フォームが送信されるときに `<form>` 要素で発生するイベント |
| `e.preventDefault()` | イベントに対するブラウザの標準動作（リンク遷移・フォーム送信など）をキャンセルする |
| SPA | 1 枚の HTML の中で、JavaScript が画面を書き換えて動くアプリ |
| `type="submit"` / `type="button"` | ボタンの種類。form 内の `<button>` の既定は `submit` |
| 制約検証（Constraint Validation） | `required`・`min`・`maxLength` などによるブラウザ標準の入力チェック |

## 仕様・注意点

- **`e.preventDefault()` は `await` より前、ハンドラの最初に呼ぶ。** `await` の後で呼んでも、その時点ではすでにブラウザが送信（再読み込み）を始めてしまっていて手遅れです。
- **`onClick` ではなく `onSubmit` で処理する。** 送信ボタンの `click` イベントはブラウザの入力検証（`required` など）より **前** に発生するため、`onClick` に処理を書くと未入力のまま処理が走ってしまいます（`preventDefault` しなければ、その後フォーム送信も起きる）。なお入力欄での Enter キーは、仕様上「既定の送信ボタンへの click」として扱われるので `onClick` も呼ばれますが、送信の入口は検証後に発生する `submit` イベントにまとめるのが基本です。
- **`Number("")` は `0`、`Number("abc")` は `NaN`** になります。このプロジェクトは `required` と `type="number"` で空欄・非数値の送信をほぼ防いでいますが、JavaScript 側でもチェックするとより安全です。
- 符号反転は `adjustAmount > 0` のときだけ行っているので、`0` はそのまま `0` で送られます（`min={0}` なので負の値は通常ブラウザ検証で弾かれる）。
- 送信中に 2 回押されると 2 回 POST されてしまいます。このプロジェクトは `loading={isLoading}` でボタンを送信中表示にしており、Chakra UI の `Button` は `loading` 中に無効化されるので二重送信対策になっています（study/ChakraUI 参照）。
- ハンドラの引数型 `FormEvent` は `@types/react` 19.3 で非推奨です（17 参照）。

## 今後に活かせるポイント

- React のフォームは「`<form onSubmit={handle}>` + ハンドラ冒頭で `e.preventDefault()`」が基本形。
- form 内の送信以外のボタンには必ず `type="button"` を書く。
- 必須チェックなど単純な検証はブラウザ標準（`required` 等）に任せ、複雑な検証だけ JavaScript で書く。
- 処理の成否は戻り値で受け取り、成功時だけ画面遷移する。

## 改善するなら

### 数値の妥当性チェックを追加する

```tsx
// VStack as="form" に渡す場合は SubmitEvent<HTMLElement> にする（17 参照）
const handleSubmit = async (e: SubmitEvent<HTMLElement>) => {
  e.preventDefault();

  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    // 例: エラー用の state を用意して表示する
    setFormError("金額は 1 円以上で入力してください。");
    return;
  }

  const signedAmount = transactionType === "expense" ? -value : value;
  // ...
};
```

### React 19 のフォーム Actions で書く

React 19 では `<form action={関数}>` に関数を渡せます。送信時に `FormData` が渡され、`preventDefault` も不要です。`useActionState` と組み合わせると、送信中フラグ（`isPending`）や結果も React が管理してくれます。

```tsx
import { useActionState } from "react";

const [error, submitAction, isPending] = useActionState(
  async (_prev: string | null, formData: FormData) => {
    const ok = await addTransaction({
      item: String(formData.get("item")),
      amount: Number(formData.get("amount")),
      date: String(formData.get("date")),
    });
    if (!ok) return "登録に失敗しました。";
    navigate("/");
    return null;
  },
  null,
);

<form action={submitAction}>
  <input name="item" required />
  {/* ... */}
  <button type="submit" disabled={isPending}>登録</button>
</form>
```

注意: React 19 の `action` を使ったフォームは、送信が成功すると **非制御の入力欄が自動でリセット** されます。また Chakra UI の部品と組み合わせる際は `name` 属性の受け渡しなどを確認する必要があります。

## 次に学ぶこと

- **`useActionState`**: フォーム送信の状態（結果・pending）を管理するフック。
- **`useFormStatus`**（`react-dom`）: 子コンポーネントから親フォームの送信中状態を読む。
- **`useOptimistic`**: サーバーの応答を待たずに、成功した前提で画面を先に更新する（楽観的更新）。
- **React Hook Form + Zod**: スキーマでバリデーションを宣言するフォーム構築の定番。

# イベントハンドラと async ハンドラ

## 概要

ボタンのクリックや入力欄への文字入力など、ユーザーの操作に反応する関数を **イベントハンドラ** と呼びます。React では `onClick` や `onChange` などの props に **関数を渡す** ことで登録します。

state を更新するのは、主にこのイベントハンドラの中です。また、API を呼ぶなどの非同期処理を行う **async ハンドラ** もよく使います。

## このプロジェクトでの実装

### 1. インラインのアロー関数で渡す

`web-app/src/pages/Home.tsx:28-35`

```tsx
<Button
  colorPalette="teal"
  fontWeight="bold"
  onClick={() => navigate("/input")}
>
  <FaPlus />
  登録
</Button>
```

`onClick={() => navigate("/input")}` は「クリックされたら `navigate("/input")` を実行する関数」を渡しています（`navigate` は React Router の関数。study/Routing 参照）。

### 2. 名前を付けた関数を定義して渡す

`web-app/src/pages/Input.tsx:49-51, 113-122`

```tsx
const onCancel = () => {
  navigate("/");
};

// ...
<Button type="button" color="gray.500" variant="outline" flex={1} onClick={onCancel} fontWeight="bold">
  キャンセル
</Button>
```

`onClick={onCancel}` と、**関数そのもの** を渡しています（`onCancel()` と呼び出してはいない）。

### 3. イベントオブジェクトを受け取る

`web-app/src/pages/Input.tsx:86-91`

```tsx
<Input
  placeholder="項目を入力してください"
  value={item}
  maxLength={20}
  onChange={(e) => setItem(e.target.value)}
/>
```

ハンドラは引数で **イベントオブジェクト**（`e`）を受け取れます。`e.target.value` で入力欄の現在の文字列を取り出しています。

### 4. async ハンドラ

`web-app/src/pages/Input.tsx:29-47`

```tsx
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();

  let adjustAmount = Number(amount);
  if (transactionType === "expense" && adjustAmount > 0) {
    adjustAmount = -adjustAmount;
  }

  const ok = await addTransaction({ item, amount: adjustAmount, date });

  if (ok) {
    navigate("/");
  }
};
```

- `async` を付けたので、中で `await` を使って API の完了を待てます。
- **`e.preventDefault()` は `await` より前に呼ぶ必要があります**（19 参照）。
- `addTransaction` は内部で例外を `catch` して `true` / `false` を返すので、`handleSubmit` 自身が例外を投げることはありません。async ハンドラで例外が漏れると「未処理の Promise の拒否（unhandled rejection）」になるので、このように内側で処理しておくのは良い設計です。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| イベントハンドラ | ユーザー操作などのイベントに反応して実行される関数 |
| イベントオブジェクト | ハンドラの引数に渡される、イベントの情報（対象の要素・入力値など）を持つオブジェクト |
| 合成イベント（SyntheticEvent） | React がブラウザのネイティブイベントを包んだもの。ブラウザ差を吸収している |
| `e.target` | イベントが発生した要素 |
| unhandled rejection | 誰も `catch` しなかった Promise のエラー |

## 仕様・注意点

- **関数を「渡す」のであって「呼ぶ」のではありません。**

  ```tsx
  onClick={onCancel}         // OK: クリック時に呼ばれる
  onClick={() => onCancel()} // OK: 同上
  onClick={onCancel()}       // NG: 描画のたびに即実行され、戻り値（undefined）が渡される
  onClick={navigate("/")}    // NG: 描画した瞬間に画面遷移しようとする
  ```

- 引数を渡したいときはアロー関数で包みます: `onClick={() => navigate("/input")}`。
- **props 名は `on` + イベント名のキャメルケース**（`onClick`, `onChange`, `onSubmit`）。ハンドラ関数の名前は `handle` + イベント名（`handleSubmit`）とするのが慣習です。このプロジェクトでは `handleSubmit` と `onCancel` が混在しています。
- **イベントハンドラは StrictMode でも二重実行されません**（02 参照）。副作用（API 呼び出し・画面遷移）はハンドラに書くのが安全です。
- `onChange={(e) => setItem(e.target.value)}` の `e` の型は、`Input` コンポーネントの props の型から自動的に推論されます（文脈的型付け）。インラインで書く限り、自分で型を書く必要はありません。
- **`FormEvent` 型は非推奨になっています。** このプロジェクトに入っている `@types/react` 19.3.0 の型定義（`node_modules/@types/react/index.d.ts:2172-2177` 付近）では、`FormEvent` に `@deprecated FormEvent doesn't actually exist.` と書かれており、用途に応じて `ChangeEvent` / `InputEvent` / `SubmitEvent` / `SyntheticEvent` を使うよう案内されています。フォーム送信なら `SubmitEvent<HTMLFormElement>` が適切です（`onSubmit` の型も `SubmitEventHandler<T>` になっている）。

## 今後に活かせるポイント

- 短い処理はインライン（`onClick={() => ...}`）、複数行の処理は名前付き関数（`handleXxx`）に切り出す。
- async ハンドラは「中で `try/catch` するか、呼び出す関数が例外を投げない設計にする」。成否は戻り値で受け取る。
- 二重送信を防ぐには、送信中はボタンを無効化・ローディング表示にする（このプロジェクトは `loading={isLoading}` で実現。Chakra UI の `Button` の `loading` は study/ChakraUI 参照）。

## 改善するなら

### 非推奨の `FormEvent` を `SubmitEvent` に置き換える

```tsx
import { useState, type SubmitEvent } from "react";

const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
  e.preventDefault();
  // ...
};
```

（ただしこのプロジェクトでは `<VStack as="form" onSubmit={handleSubmit}>` と Chakra UI 経由で渡しているので、`VStack` の `onSubmit` の型と合うかは実際に型チェック（`npm run build` の `tsc -b`）で確認すること。実際に試すと、`as="form"` を付けても `VStack` の `onSubmit` は `SubmitEventHandler<HTMLDivElement>` として型付けされるため、`SubmitEvent<HTMLFormElement>` では型エラーになりました。`VStack` に渡す場合は `SubmitEvent<HTMLElement>` か、型引数なしの `SubmitEvent` なら通ります。素の `<form>` に渡すなら `SubmitEvent<HTMLFormElement>` で問題ありません。）

### ハンドラ名の統一

```tsx
const handleCancel = () => {
  navigate("/");
};

<Button onClick={handleCancel}>キャンセル</Button>
```

## 次に学ぶこと

- **`useCallback`**: ハンドラ関数を描画ごとに作り直さず、同じ関数を再利用する（`React.memo` した子に渡すときなどに意味がある）。
- **`useEffectEvent`**: effect の中から「イベント的な処理」を呼ぶためのフック。
- **イベントの伝播（バブリング）と `e.stopPropagation()`**: 子のクリックが親にも伝わる仕組み。

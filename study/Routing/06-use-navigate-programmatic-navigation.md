# useNavigate によるプログラム的遷移

## 概要

`useNavigate` は **JavaScript のコードから画面遷移するための関数（navigate）を返すフック** です。

```tsx
const navigate = useNavigate();
navigate("/input");   // /input へ遷移
```

返ってくる `navigate` の型は次のとおりです（`node_modules/react-router/dist/development/index.d.ts` より）。

```ts
interface NavigateFunction {
  (to: To, options?: NavigateOptions): void | Promise<void>;
  (delta: number): void | Promise<void>;
}
```

- `to` … 遷移先。文字列（`"/input"`）か、`{ pathname, search, hash }` のオブジェクト
- `options` … `replace` や `state` などのオプション（[07-navigate-options.md](./07-navigate-options.md)）
- `delta` … 数値を渡すと履歴を前後に移動（`-1` で戻る）

公式ドキュメント（`docs/start/declarative/navigating.md`）は、`useNavigate` を **「ユーザーがリンクを操作していないが遷移させたい場面」** に使うよう勧めています。例として挙がっているのは:

- フォーム送信が完了した後
- 一定時間操作がないときのログアウト
- クイズなど時間制限のある UI

## このプロジェクトでの実装

このプロジェクトでは `useNavigate` を 3 か所で使っています。

### 1. ホームの「登録」ボタン → 入力画面へ

```tsx
// web-app/src/pages/Home.tsx:17-35（抜粋）
import { useNavigate } from "react-router";

function Home() {
  const navigate = useNavigate();          // :20
  return (
    ...
    <Button
      colorPalette="teal"
      fontWeight="bold"
      onClick={() => navigate("/input")}   // :31
    >
      <FaPlus />
      登録
    </Button>
```

ボタンのクリックで `/input` に遷移します。`onClick={() => navigate("/input")}` と **アロー関数で包んでいる** 点に注意してください。`onClick={navigate("/input")}` と書くと、描画中に navigate が実行されてしまいます。

### 2. 登録成功後 → ホームへ

```tsx
// web-app/src/pages/Input.tsx:26-47（抜粋）
const navigate = useNavigate();                              // :26
const { addTransaction, isLoading, error } = useAddTransactions();

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();                                        // :30 フォームの本来の送信（ページ遷移）を止める
  ...
  const ok = await addTransaction({ item, amount: adjustAmount, date }); // :38-42

  if (ok) {
    navigate("/");                                           // :45 成功したときだけホームへ
  }
};
```

- API 呼び出し（`addTransaction`）の **完了を `await` で待ってから** 遷移しています。
- 失敗時（`ok === false`）は遷移せず、同じ画面でエラーメッセージを表示します（`web-app/src/pages/Input.tsx:111`）。
- `e.preventDefault()` はブラウザ標準のフォーム送信（＝ページの再読み込み）を止めるために必要です。これがないと SPA なのにページ全体がリロードされてしまいます。

これは公式が挙げる「フォーム送信完了後」の典型例で、`useNavigate` の使いどころとして最適です。

### 3. キャンセル → ホームへ

```tsx
// web-app/src/pages/Input.tsx:49-51
const onCancel = () => {
  navigate("/");
};
```

```tsx
// web-app/src/pages/Input.tsx:113-122
<Button
  type="button"        // ← submit ではないのでフォーム送信は起きない
  ...
  onClick={onCancel}
>
  キャンセル
</Button>
```

`type="button"` を指定しているので、このボタンを押してもフォームの `onSubmit` は発火しません。素の HTML では `<form>` 内の `<button>` は既定で `type="submit"` になるため、これを忘れるとキャンセルのつもりが登録処理が走ってしまいます。なお Chakra UI v3 の `<Button>` は実装で既定値 `type="button"` を付けている（`@chakra-ui/react/dist/esm/components/button/button.js`）ので、このプロジェクトではキャンセル側の `type="button"` は念のための明示で、逆に登録ボタン側（`Input.tsx:124`）の `type="submit"` は省略できない、という点に注意します。

## 重要語句

- **useNavigate**: 遷移用の関数 `navigate` を返すフック。
- **プログラム的遷移（programmatic navigation）**: リンクのクリックではなく、コードの処理結果に応じて遷移させること。
- **To**: 遷移先を表す型。文字列か `Partial<Path>`（`pathname`, `search`, `hash`）。
- **絶対パス / 相対パス**: `"/input"` のように `/` で始まると絶対パス。`"input"` や `".."` のように `/` で始まらないと、現在のルートからの相対パスとして解決される。

## 仕様・注意点

- **描画中（レンダー中）に `navigate()` を呼ばない**。React Router は初回描画前の呼び出しを無視し、開発時に「`You should call navigate() in a React.useEffect(), not when your component is first rendered.`」と警告します。イベントハンドラか `useEffect` の中で呼びましょう。描画時に条件付きでリダイレクトしたいなら `<Navigate to="/" />` コンポーネントを返す方法もあります。
- **Declarative モードでは `navigate` は `void` を返します**。Data / Framework モードでは遷移完了で解決する `Promise` を返します。型が `void | Promise<void>` の union になっているため、`typescript-eslint` の `no-floating-promises` などで警告が出ることがあります。その場合、JSDoc にある通り `declare module "react-router"` で `NavigateFunction` 型を上書き（augment）する方法が案内されています。
- **Declarative モードの `navigate` は参照が安定しません**（遷移のたびに関数の同一性が変わり得る）。`useEffect` の依存配列に入れると、遷移のたびに effect が再実行されることがあるので注意します。
- `useNavigate` は `<BrowserRouter>` の内側でしか使えません（[09-hooks-inside-router.md](./09-hooks-inside-router.md)）。
- ユーザーがクリックして移動するだけのナビゲーションには `<Link>` の方が適しています（右クリック「新しいタブで開く」などが使える）。詳しくは [08-link-navlink-vs-a-tag.md](./08-link-navlink-vs-a-tag.md)。

## 今後に活かせるポイント

- 「**処理が成功したら遷移、失敗したらその場でエラー表示**」は、ログインや登録フォームで何度も使うパターンです。`addTransaction` が `boolean` を返す設計（`web-app/src/hooks/useAddTransactions.ts:22,27`）は、この分岐を書きやすくしています。
- v5 の `useHistory()` / `history.push()` は v6 以降 `useNavigate()` / `navigate()` に置き換わりました。古い記事を見たら読み替えます。

## 改善するなら

- **ホームの「登録」ボタンは `<Link>` にできる**: ユーザーのクリックで移動するだけなので、公式の推奨に従うなら `<Link to="/input">` が適しています（Chakra UI の `asChild` で Button の見た目のまま Link にできます。詳細は study/ChakraUI 側）。

```tsx
import { Link } from "react-router";

<Button asChild colorPalette="teal" fontWeight="bold">
  <Link to="/input">
    <FaPlus />
    登録
  </Link>
</Button>
```

- **登録成功後は `replace: true`** を検討する（[07-navigate-options.md](./07-navigate-options.md)）。
- **パス文字列を定数化**して `navigate(PATHS.home)` のように書く（[04-browser-router-routes-route.md](./04-browser-router-routes-route.md) の「改善するなら」参照）。

## 次に学ぶこと

- `<Navigate>` コンポーネント（描画時のリダイレクト）
- Data モードの `action` + `redirect`（JSDoc にも「`action` / `loader` 内では `redirect` を使う方が良いことが多い」とある）
- `useBlocker`（入力途中で離脱しようとしたときに確認する。Data / Framework モードのみ）

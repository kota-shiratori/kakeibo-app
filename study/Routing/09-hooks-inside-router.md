# ルーター系フックは Router の内側でしか使えない

## 概要

`useNavigate` / `useLocation` / `useParams` などのフックや、`<Link>` / `<Routes>` などのコンポーネントは、**`<BrowserRouter>` の内側（子孫）でしか使えません**。

理由は、これらが React の **Context** を通じて「現在の location」や「遷移を実行する navigator」を受け取っているからです。`<BrowserRouter>` は内部で `<Router>` を描画し、そこで `NavigationContext` / `LocationContext` に値を提供しています。外側にはその値がないため、フックは仕事ができません。

React Router の実装では、フックの冒頭で「ルーターの中にいるか」（`useInRouterContext()`）をチェックし、外にいれば次のようなエラーを投げます（`node_modules/react-router/dist/development/chunk-*.mjs` より）。

```
useNavigate() may be used only in the context of a <Router> component.
useLocation() may be used only in the context of a <Router> component.
useHref() may be used only in the context of a <Router> component.
```

`<Link>` もルーターの外では動きません。ただし 7.18.4 の実装では、`useHref` のチェックより先に `NavigationContext`（外では `null`）を分割代入するため、上記の分かりやすいメッセージではなく「`Cannot destructure property 'basename' of ... as it is null.`」という `TypeError` になります（scratchpad で `renderToString(<Link to="/" />)` を実行して確認）。このエラーを見たときも「ルーターの外に `<Link>` がある」と読み替えましょう。

## このプロジェクトでの実装

コンポーネントの親子関係（ツリー）は次のようになっています。

```
main.tsx
└─ <StrictMode>                       web-app/src/main.tsx:7
   └─ <ChakraProvider>                web-app/src/main.tsx:8
      └─ <App>                        web-app/src/main.tsx:9
         └─ <BrowserRouter>           web-app/src/App.tsx:7   ← ここから内側でルーター系 API が使える
            └─ <Routes>               web-app/src/App.tsx:8
               ├─ <Home>              web-app/src/App.tsx:9   ← useNavigate を使用（Home.tsx:20）
               └─ <Input>             web-app/src/App.tsx:10  ← useNavigate を使用（Input.tsx:26）
```

`Home` と `Input` はどちらも `<BrowserRouter>` の子孫なので、`useNavigate()` を問題なく呼べます。

一方、**`App` コンポーネント自身** は `<BrowserRouter>` を「返す」側なので、`App` の関数本体で `useNavigate()` を呼ぶとエラーになります。

```tsx
// ❌ ダメな例
function App() {
  const navigate = useNavigate(); // App はまだ BrowserRouter の外！
  return (
    <BrowserRouter>
      ...
    </BrowserRouter>
  );
}
```

`App` の中に書いた `<BrowserRouter>` は、`App` が返す JSX の一部にすぎません。フックは **そのコンポーネントの関数が呼ばれた時点で、祖先に Provider があるか** で判断されるので、`App` の祖先（`ChakraProvider`, `StrictMode`）にルーターはありません。

## 重要語句

- **Context**: 親から深い子孫へ、props を経由せずに値を渡す React の仕組み（詳細は study/React 担当）。
- **Provider**: Context に値を流し込むコンポーネント。`<BrowserRouter>` はルーター用の Provider の役割を持つ。
- **useInRouterContext**: 「今ルーターの内側にいるか」を `boolean` で返すフック。Declarative モードでも使える。
- **invariant**: 「この条件は必ず満たされているはず」というチェック。満たされないとエラーを投げる。

## 仕様・注意点

- **Router の外に置きがちなもの** に注意します。
  - 共通ヘッダーやフッターを `<BrowserRouter>` の外に置き、その中で `<Link>` を使う
  - テストでコンポーネント単体を描画したとき（ルーターで包んでいない）
  - Storybook でページコンポーネントを表示したとき
- テストや Storybook では `<MemoryRouter>`（メモリ上で履歴を管理するルーター）で包むのが一般的です。
- `<BrowserRouter>` を **入れ子にしてはいけません**（ルーターの中に別のルーターを置くとエラーになる）。アプリ全体で 1 つにします。
- `react-router` と `react-router-dom` が両方インストールされて別々に読み込まれると、ルーターの中にいるはずなのに「外」と判定されることがあります（[02-react-router-v7-package.md](./02-react-router-v7-package.md)）。

## 今後に活かせるポイント

- 「`may be used only in the context of a <Router>`」というエラーを見たら、**そのコンポーネントがツリー上で `BrowserRouter` の内側にあるか** を確認する、と覚えておけば即解決できます。
- Chakra UI の `ChakraProvider` など、他の Provider も同じ原理です。「Provider の内側でしか使えないフック」は React のライブラリ全般で共通のパターンです。

## 改善するなら

ルーターで包む位置を `main.tsx` に移すと、`App` の中でもルーター系フックが使えるようになり、Provider がエントリーポイントにまとまって見通しが良くなります（公式の Declarative モードのインストール手順もこの形です）。

```tsx
// web-app/src/main.tsx（改善例）
import { BrowserRouter } from "react-router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ChakraProvider>
  </StrictMode>,
);
```

```tsx
// web-app/src/App.tsx（改善例）
function App() {
  // ここで useLocation() なども使える
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/input" element={<Input />} />
    </Routes>
  );
}
```

テストでは次のように `MemoryRouter` で包み、`initialEntries` で開始 URL を指定できます。

```tsx
import { MemoryRouter } from "react-router";

render(
  <MemoryRouter initialEntries={["/input"]}>
    <App />
  </MemoryRouter>,
);
```

## 次に学ぶこと

- `MemoryRouter` / `createMemoryRouter` を使ったコンポーネントテスト
- Data モードの `createRoutesStub`（ルートをスタブ化してテストする）

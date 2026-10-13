# 関数コンポーネント

## 概要

React の画面は **コンポーネント**（画面の部品）を組み合わせて作ります。現在の React では、コンポーネントは「**JSX を返す JavaScript の関数**」として書くのが標準です（関数コンポーネント）。

昔はクラス（`class X extends React.Component`）で書く方法もありましたが、フック（`useState` など）が登場した React 16.8 以降、新しく書くコードはほぼすべて関数コンポーネントです。

## このプロジェクトでの実装

このプロジェクトには、関数コンポーネントの書き方が 2 種類混在しています。

### 書き方 A: `function` 宣言

`web-app/src/App.tsx:5-15`

```tsx
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/input" element={<Input />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
```

`web-app/src/pages/Home.tsx:19`（`function Home()`）、`web-app/src/pages/Input.tsx:19`（`function InputPage()`）も同じ書き方です。

### 書き方 B: アロー関数を `const` に代入

`web-app/src/components/Header.tsx:3-18`

```tsx
export const Header = () => {
  return (
    <Box as="header" bg="teal.500" color="white" py={4} textAlign="center" boxShadow="md">
      <Text fontSize="xl" fontWeight="bold">
        シンプル家計簿
      </Text>
    </Box>
  );
};
```

`TransactionList.tsx` の各コンポーネントや `Home.tsx:59` の `SummaryCard` もこの書き方です。

どちらも React から見ればまったく同じ「関数コンポーネント」です。

### コンポーネントとして使う

定義したコンポーネントは、JSX の中でタグのように書いて使います。

`web-app/src/pages/Home.tsx:22-23`

```tsx
<>
  <Header />
```

`<Header />` と書くと、React が `Header` 関数を呼び出し、返ってきた JSX をその位置に描画します。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| コンポーネント | 画面の部品。関数として定義し、JSX を返す |
| 関数コンポーネント | 関数で書いたコンポーネント。現在の標準 |
| クラスコンポーネント | `class` で書く旧来の方式。新規ではほぼ使わない（Error Boundary など一部を除く） |
| default export | `export default App;` のように 1 ファイル 1 つだけの「既定の」公開。import 側で好きな名前を付けられる |
| named export | `export const Header` のように名前付きで公開。import 側は `{ Header }` と同じ名前で受け取る |

## 仕様・注意点

- **コンポーネント名は大文字で始める（PascalCase）。** JSX では、小文字で始まるタグ（`<div>`）は HTML 要素、大文字で始まるタグ（`<Header>`）はコンポーネントとして扱われます。`const header = ...` と小文字で定義して `<header />` と書くと、HTML の `<header>` 要素になってしまいます。
- **コンポーネントは毎回の描画で「呼び直される」関数**です。関数の中に書いた普通の変数（`let x = 0` など）は、描画のたびに初期化されます。描画をまたいで値を覚えておきたいときは `useState` を使います（08 参照）。
- コンポーネントは **純粋** に保つ必要があります。描画中（関数本体の実行中）に API を呼ぶ・外部の変数を書き換えるなどの副作用を起こしてはいけません。副作用は `useEffect` やイベントハンドラで行います（02・10 参照）。
- **コンポーネントの中でコンポーネントを定義しない。** 親が再描画されるたびに「別の関数」として作り直されるため、子の state が毎回リセットされます。このプロジェクトは `SummaryCard` などをすべてファイルのトップレベルで定義しており、正しい書き方です。
- `Input.tsx` は `function InputPage()` と定義して `export default InputPage;` していますが、`App.tsx:3` では `import Input from "@/pages/Input";` と別名で受け取っています。default export は import 側で名前を自由に付けられるためです。Chakra UI の `Input` 部品と名前が衝突しないよう、ファイル内では `InputPage` にしていると考えられます。

## 今後に活かせるポイント

- `function` 宣言とアロー関数のどちらを使うかはチームで統一する。迷ったら「ページは `function` + default export、部品はアロー関数 + named export」のように規則を決めるとよい。
- 1 コンポーネントが長くなったら、意味のある単位で別コンポーネントに切り出す（このプロジェクトの `TransactionListItem` のように）。

## 改善するなら

書き方の混在は動作には影響しませんが、読む人の迷いの元になります。例えば named export に統一すると、import 名がファイル内の名前と必ず一致し、エディタの自動 import や一括リネームも効きやすくなります。

```tsx
// pages/Home.tsx
export const Home = () => {
  // ...
};

// App.tsx
import { Home } from "@/pages/Home";
import { InputPage } from "@/pages/Input";
```

（ただし React の遅延読み込み `lazy()`（`React.lazy`）のように、default export を前提にする仕組みもあるので、使う予定の仕組みに合わせて決めます。なお React Router のルート定義の `lazy` は default export ではなく `Component` などの名前付きのプロパティを返す形です。）

## 次に学ぶこと

- **`React.memo`**: props が変わらないときに再描画を省略する仕組み。
- **Error Boundary**: 現在もクラスコンポーネントでしか書けない数少ない機能（`react-error-boundary` ライブラリで関数風に使える）。
- **React Compiler**: 純粋な関数コンポーネントを自動で最適化するツール。

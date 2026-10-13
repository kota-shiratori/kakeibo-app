# Link / NavLink と a タグ・useNavigate の使い分け

## 概要

React Router で画面遷移する手段は主に 3 つあります。

| 手段 | 描画される HTML | 使いどころ |
| --- | --- | --- |
| `<Link to="/input">` | `<a href="/input">` | ユーザーがクリックして移動する普通のリンク |
| `<NavLink to="/input">` | `<a href="/input">`（アクティブ時に `class="active"` と `aria-current="page"`） | ナビゲーションメニューなど「今いるページ」を強調したいリンク |
| `useNavigate()` | （HTML なし。JS の関数） | フォーム送信完了後など、ユーザーのリンク操作ではない遷移 |

そして、**素の `<a href="/input">` は使わない** のが原則です。

### なぜ素の a タグではダメなのか

`<a href="/input">` をクリックすると、ブラウザは通常のページ遷移を行い、**サーバーから HTML を取り直してアプリ全体を再起動** します（フルリロード）。React の state はすべて消え、JS の再読み込み・再初期化も発生します。

`<Link>` は見た目は同じ `<a href>` を出力しますが、クリック時に次の処理をします（`useLinkClickHandler` の実装より）。

1. 「普通の左クリック」かを判定する（`shouldProcessLinkClick`）
   - 左クリック（`event.button === 0`）である
   - `target` 属性が無いか `_self` である
   - Ctrl / Cmd / Shift / Alt キーが押されていない
2. 普通の左クリックなら `event.preventDefault()` でブラウザの遷移を止め、`navigate(to, ...)` でクライアントサイド遷移する
3. それ以外（Cmd+クリック、中クリック、`target="_blank"` など）は **ブラウザに任せる** → 新しいタブで開くなどが普通に動く

つまり `<Link>` は「**a タグの良さ（右クリックメニュー、新しいタブで開く、URL のホバー表示、アクセシビリティ）を保ったまま SPA 遷移する**」部品です。

### useNavigate との違い

公式ドキュメント（`docs/start/declarative/navigating.md`）は次のように述べています。

> For normal navigation, it's best to use `Link` or `NavLink`. They provide a better default user experience like keyboard events, accessibility labeling, "open in new window", right click context menus, etc.

`<button onClick={() => navigate("/input")}>` は、見た目はリンクのように使えても

- 右クリック →「新しいタブで開く」ができない
- ホバーしても遷移先 URL が表示されない
- スクリーンリーダーには「ボタン」として読み上げられる（「リンク」ではない）

といった違いがあります。

## このプロジェクトでの実装

このプロジェクトでは **`<Link>` / `<NavLink>` は使っておらず、遷移はすべて `useNavigate`** です。

```tsx
// web-app/src/pages/Home.tsx:28-35
<Button
  colorPalette="teal"
  fontWeight="bold"
  onClick={() => navigate("/input")}
>
  <FaPlus />
  登録
</Button>
```

```tsx
// web-app/src/pages/Input.tsx:44-51
if (ok) {
  navigate("/");     // フォーム送信完了後 → useNavigate が適切
}
...
const onCancel = () => {
  navigate("/");     // ユーザーのクリックで移動 → Link でも書ける
};
```

それぞれの評価:

| 箇所 | 現状 | 適切な手段 |
| --- | --- | --- |
| `Home.tsx:31` 登録ボタン | `navigate("/input")` | ユーザーのクリックによる単純な移動なので **`<Link>` が適する** |
| `Input.tsx:45` 登録成功後 | `navigate("/")` | API 完了を待ってからの遷移なので **`useNavigate` が適する** |
| `Input.tsx:50` キャンセル | `navigate("/")` | 単純な移動なので `<Link>` でも書ける（フォーム内のボタンとして扱う現状も実用上は問題ない） |

また、ヘッダー（`web-app/src/components/Header.tsx:13-15`）の「シンプル家計簿」というタイトルはただのテキストで、クリックしてもホームに戻れません。

## 重要語句

- **Link**: クライアントサイド遷移する `<a>` を描画するコンポーネント。主な props: `to`, `replace`, `state`, `relative`, `reloadDocument`, `target`。
- **NavLink**: `Link` にアクティブ状態の機能を加えたもの。`className` / `style` / `children` に関数を渡すと `{ isActive, isPending, isTransitioning }` を受け取れる（`isPending` が意味を持つのは Data / Framework モード）。
- **end**: `NavLink` の prop。`to="/tasks"` は既定で `/tasks/123` でもアクティブになるが、`end` を付けると `/tasks` ちょうどのときだけアクティブになる。`to="/"` は特別扱いで、ルートでのみアクティブになる。
- **reloadDocument**: `Link` の prop。付けるとクライアントサイド遷移をせず、普通の a タグのようにフルリロードする。
- **aria-current="page"**: 「現在のページ」を支援技術に伝える属性。`NavLink` がアクティブ時に自動で付与する。

## 仕様・注意点

- `<Link>` も `useNavigate` と同様、`<BrowserRouter>` の内側でしか使えません。
- 外部サイトへのリンク（`https://...`）は普通の `<a href>` で書きます。
- 現在と同じ URL への `<Link>` をクリックすると、既定で replace 扱いになり履歴が増えません（[07-navigate-options.md](./07-navigate-options.md)）。
- Chakra UI の `<Button>` の中に `<Link>` を入れる（`<Button><Link/></Button>`）と `<button>` の中に `<a>` が入る不正な HTML になります。Chakra UI v3 では `asChild` を使って `<Button asChild><Link .../></Button>` とし、Button のスタイルを `<a>` 要素に適用します（Chakra 側の詳細は study/ChakraUI 担当）。
- v5 の `NavLink` にあった `activeClassName` / `activeStyle` は v6 以降ありません。`className={({ isActive }) => ...}` を使います。

## 今後に活かせるポイント

- 判断基準はシンプルです: **「ユーザーがクリックして移動するだけ」なら `<Link>`、「何かの処理の結果として移動する」なら `useNavigate`**。
- ナビゲーションバーやタブには `<NavLink>` を使い、アクティブ表示を自前の state で管理しない。URL が唯一の情報源（single source of truth）になります。

## 改善するなら

### 1. 登録ボタンを Link にする

```tsx
// web-app/src/pages/Home.tsx（改善例）
import { Link } from "react-router";

<Button asChild colorPalette="teal" fontWeight="bold">
  <Link to="/input">
    <FaPlus />
    登録
  </Link>
</Button>
```

これで Cmd+クリックで入力画面を別タブで開けるようになり、`useNavigate` の import も不要になります。

### 2. ヘッダーのタイトルをホームへのリンクにする

```tsx
// web-app/src/components/Header.tsx（改善例）
import { Link } from "react-router";

<Text fontSize="xl" fontWeight="bold">
  <Link to="/">シンプル家計簿</Link>
</Text>
```

### 3. 画面が増えたら NavLink でメニューを作る

```tsx
import { NavLink } from "react-router";

<nav>
  <NavLink to="/" end>ホーム</NavLink>
  <NavLink to="/input">登録</NavLink>
</nav>
```

```css
/* アクティブなリンクには自動で class="active" が付く */
nav a.active {
  font-weight: bold;
  text-decoration: underline;
}
```

## 次に学ぶこと

- `useLinkClickHandler`（独自のリンク部品を作るときに `<Link>` と同じクリック判定を再利用できる）
- Framework モードの `<Link prefetch>`（リンク先のデータやコードを事前取得）
- アクセシビリティ: ボタンとリンクの意味の違い（「操作」か「移動」か）

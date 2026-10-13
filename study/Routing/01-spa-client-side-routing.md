# SPA とクライアントサイドルーティングの仕組み

## 概要

家計簿アプリは **SPA（Single Page Application）** です。サーバーから受け取る HTML は `index.html` の 1 枚だけで、「ホーム画面（`/`）」と「入力画面（`/input`）」の切り替えはブラウザ上の JavaScript（React Router）が行っています。

従来型の Web サイト（MPA: Multi Page Application）とページ遷移の流れを比べると違いがよく分かります。

| | MPA（従来型） | SPA（このアプリ） |
| --- | --- | --- |
| リンクを押したとき | ブラウザがサーバーに新しい HTML を要求する | JavaScript が URL だけを書き換え、画面を描き直す |
| HTML の取得 | ページごとに毎回 | 最初の 1 回だけ |
| 画面の白いチラつき | 起きやすい | 起きない |
| JS の状態（変数など） | 遷移のたびに消える | `BrowserRouter` より上の状態は残る |
| URL とページの対応を決めるのは | サーバー | ブラウザ側のルーター（React Router） |

「URL に応じて表示するコンポーネントを、ブラウザ内で切り替える」ことを **クライアントサイドルーティング** と呼びます。

### 仕組みの中心は History API

ブラウザには URL と「戻る/進む」の履歴を JavaScript から操作できる **History API** があります。

- `history.pushState(state, "", url)` … 履歴に新しいエントリを積み、アドレスバーの URL を変える。**ページの再読み込みは起きない**
- `history.replaceState(state, "", url)` … 現在の履歴エントリを置き換える（履歴は増えない）
- `popstate` イベント … ユーザーがブラウザの「戻る/進む」を押したときに発火する

React Router v7 の `BrowserRouter` は内部でこの API を使っています。`node_modules/react-router` の実装（`createBrowserHistory`）を覗くと、実際に `globalHistory.pushState(...)` / `globalHistory.replaceState(...)` を呼び、`window.addEventListener("popstate", ...)` で戻る/進むを監視していることが確認できます。

流れをまとめると次のとおりです。

```
[登録ボタン押下] → navigate("/input")
   → history.pushState(..., "/input")   ← URL だけ変わる。サーバー通信なし
   → React Router が「location が変わった」と React に通知
   → <Routes> が新しい URL に一致する <Route> を探す
   → <Input /> を描画
```

```
[ブラウザの戻るボタン]
   → popstate イベント
   → React Router が新しい location（"/"）を受け取る
   → <Home /> を描画
```

## このプロジェクトでの実装

HTML は `index.html` 1 枚だけで、中身は空の `<div id="root">` と JS の読み込みだけです。

`web-app/index.html:9-12`

```html
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
```

`web-app/src/main.tsx:6-12` で React が `#root` に `<App />` を描画し、`web-app/src/App.tsx:7-12` の `BrowserRouter` がクライアントサイドルーティングを担当します。

```tsx
// web-app/src/App.tsx:7-12
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/input" element={<Input />} />
  </Routes>
</BrowserRouter>
```

ホームの「登録」ボタン（`web-app/src/pages/Home.tsx:31`）で `navigate("/input")` を呼ぶと、ネットワークタブには **HTML のリクエストは発生しません**。発生する通信は、`Input` 画面や `Home` 画面が自分で行う API 呼び出し（`fetch`）だけです。

## 重要語句

- **SPA（Single Page Application）**: HTML を 1 枚だけ読み込み、以降の画面切り替えを JavaScript で行うアプリ。
- **MPA（Multi Page Application）**: ページごとにサーバーから HTML を取得する従来型のサイト。
- **クライアントサイドルーティング**: URL と表示する画面の対応付けをブラウザ側で行うこと。
- **History API**: `pushState` / `replaceState` / `popstate` など、URL と履歴を JS から扱うブラウザ API。
- **履歴スタック（history stack）**: 「戻る/進む」で行き来できる URL の積み重ね。
- **location**: 現在の URL（pathname, search, hash など）を表すオブジェクト。

## 仕様・注意点

- `pushState` は **URL を変えるだけ** で、サーバーには何も問い合わせません。そのため「`/input` という URL のファイルがサーバーに存在するか」は遷移時には関係ありません。ただし **ユーザーが `/input` を直接開いたり、リロードしたりしたとき** はブラウザがサーバーに `/input` を要求します。この問題は [11-spa-fallback-and-deploy.md](./11-spa-fallback-and-deploy.md) で扱います。
- `window.location.href = "/input"` のように書くと、**フルリロード（HTML の再取得）** になってしまい、SPA の利点が失われます。React Router の API（`navigate` や `<Link>`）を使いましょう。
- ルーターの外で `window.history.pushState` を直接呼ぶと、React Router は変化に気づかず画面が更新されません。URL 操作は必ずルーターを通します。

## 今後に活かせるポイント

- 「SPA は HTML を 1 回しか取得しない」「URL 変更は History API」という 2 点を押さえておくと、Vue Router や TanStack Router など他のルーターでも同じ理解で読めます。
- DevTools の Network タブで「Doc（HTML）」のリクエストが遷移時に出ていないかを見ると、SPA として正しく遷移しているかを確認できます。

## 次に学ぶこと

- SSR（サーバーサイドレンダリング）や SSG と SPA の違い。React Router v7 の Framework モードでは SPA / SSR / 静的プリレンダリングを選べます（[03-react-router-modes.md](./03-react-router-modes.md)）。
- `HashRouter`（`/#/input` のように `#` 以降で管理する方式）。サーバー設定なしで動く代わりに URL が不格好になります。

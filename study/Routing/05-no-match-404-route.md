# 一致するルートがないとき（404 / path="*" が無い現状）

## 概要

`<Routes>` は現在の URL に一致する `<Route>` がないとき **`null` を返します**（`<Routes>` の JSDoc: 「`null` if no route matches」）。つまり、存在しない URL にアクセスすると **画面が真っ白** になります。

これを防ぐには、どの URL にも一致する **`path="*"`（スプラット / キャッチオール）** のルートを用意して「ページが見つかりません」画面を出すのが定石です。

## このプロジェクトでの実装

現在のルート定義は 2 つだけで、`path="*"` はありません。

```tsx
// web-app/src/App.tsx:8-11
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/input" element={<Input />} />
</Routes>
```

そのため、例えば `http://localhost:5173/inptu`（タイプミス）を開くと次のようになります。

1. Vite の開発サーバーは SPA フォールバックで `index.html` を返す（[11-spa-fallback-and-deploy.md](./11-spa-fallback-and-deploy.md)）
2. React が起動し、`<Routes>` が `/inptu` に一致するルートを探す
3. 見つからない → `<Routes>` は何も描画しない
4. **ヘッダーも含めて真っ白な画面** になる（`Header` は各ページの中で描画しているため。`web-app/src/pages/Home.tsx:23`, `web-app/src/pages/Input.tsx:55`）
5. 開発モードではコンソールに `No routes matched location "/inptu"` という警告が出る（React Router の実装内の `warning(...)` による）

## 重要語句

- **404 Not Found**: 「要求されたリソースが見つからない」ことを表す HTTP ステータス。SPA では「一致するルートがない」状態を指して 404 ページと呼ぶことが多い。
- **スプラット（splat）/ キャッチオール**: `*` を使って「残りの URL すべて」に一致させるパターン。`path="*"` はすべての URL に一致する。
- **`params["*"]`**: スプラットに一致した残りの部分。`useParams()` で取得できる（例: `path="files/*"` で `/files/a/b` なら `"a/b"`）。

## 仕様・注意点

- `path="*"` は **最も点数の低い（具体性の低い）ルート** として扱われるので、`<Routes>` 内のどこに書いても、他のルートに一致しなかったときだけ選ばれます（並び順に依存しない）。慣習的には最後に書くと読みやすいです。
- SPA の 404 ページはあくまで **クライアント側の表示** です。サーバーは SPA フォールバックで `index.html` を返しているため、HTTP ステータスは **200** のままです。検索エンジン向けに正しい 404 ステータスを返したい場合は SSR（Framework モードなど）やサーバー側の設定が必要です。
- v5 では `<Route component={NotFound} />`（path なし）を `<Switch>` の最後に置く書き方でしたが、v6 以降は `path="*"` を使います。

## 今後に活かせるポイント

- ルートを定義したら **「一致しなかったとき」を必ず用意する**。API の 404 ハンドリングと同じ考え方です。
- 「真っ白な画面」に出会ったら、まずコンソールの `No routes matched location` 警告を確認すると原因を素早く切り分けられます。

## 改善するなら

`NotFound` ページを作って `path="*"` に割り当てます。ホームへ戻る導線は、ユーザーのクリックによる遷移なので `<Link>` が適しています（[08-link-navlink-vs-a-tag.md](./08-link-navlink-vs-a-tag.md)）。

```tsx
// web-app/src/pages/NotFound.tsx（例）
import { Link } from "react-router";
import { Header } from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main style={{ textAlign: "center", padding: "2rem" }}>
        <h1>ページが見つかりません</h1>
        <p>URL が間違っているか、ページが移動した可能性があります。</p>
        <Link to="/">ホームへ戻る</Link>
      </main>
    </>
  );
}
```

```tsx
// web-app/src/App.tsx（例）
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/input" element={<Input />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

存在しない URL を自動でホームに戻したいだけなら、`<Navigate>` コンポーネント（Declarative モードで使用可）でリダイレクトする方法もあります。ただし、ユーザーは「なぜホームに戻ったのか」が分からないので、通常は NotFound ページを表示する方が親切です。

```tsx
import { Navigate } from "react-router";

<Route path="*" element={<Navigate to="/" replace />} />
```

## 次に学ぶこと

- Data / Framework モードの `errorElement` / `ErrorBoundary` と `useRouteError`（一致しない URL や loader のエラーをルート単位で扱える）
- `isRouteErrorResponse` で 404 と他のエラーを区別する方法

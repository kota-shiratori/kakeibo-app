# Routing 学習ノート（クライアントサイドルーティングと React Router v7）

家計簿アプリ（`web-app/`）のコードを題材に、SPA のクライアントサイドルーティングと React Router v7 を学ぶノートです。

- 対象バージョン: `react-router` 7.18.4（`web-app/node_modules/react-router/package.json`）、Vite 8.3.1、React 19.3（`package.json` の指定は `^19.2.8`、インストール済みは 19.3.0）
- 本プロジェクトのモード: **Declarative モード**（`<BrowserRouter>` + `<Routes>` + `<Route>`）
- 関連ファイル: `web-app/src/App.tsx`, `web-app/src/main.tsx`, `web-app/src/pages/Home.tsx`, `web-app/src/pages/Input.tsx`, `web-app/vite.config.ts`
- 事実確認の一次情報: `web-app/node_modules/react-router/` 内の型定義（`dist/development/*.d.ts`）、`docs/`、`CHANGELOG.md`、実装コード

## 目次（学習順）

| # | ノート | 内容 |
| --- | --- | --- |
| 01 | [SPA とクライアントサイドルーティングの仕組み](./01-spa-client-side-routing.md) | HTML を再取得せず History API（pushState / popstate）で画面を切り替える仕組み |
| 02 | [React Router v7 のパッケージ統合](./02-react-router-v7-package.md) | `react-router-dom` が `react-router` に統合された経緯と import の読み替え |
| 03 | [React Router v7 の 3 つのモード](./03-react-router-modes.md) | Declarative / Data / Framework の違いと、このアプリが Declarative である根拠 |
| 04 | [BrowserRouter / Routes / Route](./04-browser-router-routes-route.md) | 3 つの部品の役割、`path` と `element`、ルートのマッチング規則 |
| 05 | [一致するルートがないとき（404）](./05-no-match-404-route.md) | `path="*"` が無いと真っ白になる現状と NotFound ページの追加方法 |
| 06 | [useNavigate によるプログラム的遷移](./06-use-navigate-programmatic-navigation.md) | 登録ボタン・登録成功後・キャンセルの 3 か所の遷移と注意点 |
| 07 | [navigate のオプション](./07-navigate-options.md) | `replace` / `state` / `navigate(-1)` と履歴スタックの動き、モード別の対応 |
| 08 | [Link / NavLink と a タグ・useNavigate の使い分け](./08-link-navlink-vs-a-tag.md) | a タグのフルリロード問題、Link のクリック判定、NavLink のアクティブ表示 |
| 09 | [ルーター系フックは Router の内側でしか使えない](./09-hooks-inside-router.md) | Context による制約、エラーメッセージの読み方、MemoryRouter でのテスト |
| 10 | [ルーティングと再取得の関係](./10-routing-remount-and-refetch.md) | 登録後に `/` へ戻ると Home が再マウントされ useEffect で一覧を取り直す流れ |
| 11 | [SPA フォールバックと dev / preview / 本番の挙動](./11-spa-fallback-and-deploy.md) | 直接 `/input` を開いたときの 404 問題、Vite の `appType: "spa"`、本番の rewrite 設定 |
| 12 | [レイアウトルートと Outlet](./12-layout-route-and-outlet.md) | ネストルートと `<Outlet />` で Header を共通化する改善案 |

## このアプリのルーティング早見表

| URL | 表示 | 遷移元 |
| --- | --- | --- |
| `/` | `Home`（収入・支出の最近の一覧） | 初期表示 / 登録成功後 `navigate("/")` / キャンセル `navigate("/")` |
| `/input` | `Input`（取引の登録フォーム） | Home の「登録」ボタン `navigate("/input")` |
| それ以外 | 何も表示されない（真っ白） | — （05 で改善案） |

## 改善案のまとめ（各ノートの「改善するなら」より）

1. `path="*"` の NotFound ページを追加する（05）
2. 登録成功後は `navigate("/", { replace: true })` にする（07）
3. ユーザーのクリックで移動するだけの箇所は `<Link>` にする / ヘッダータイトルをホームへのリンクにする（06, 08）
4. `BrowserRouter` を `main.tsx` に移す（09）
5. レイアウトルート + `<Outlet />` で Header と main の枠を共通化する（12）
6. ルートパスを定数化する（04）
7. デプロイ先の SPA フォールバック設定をリポジトリに含める（11）※ 2026-10-12 時点で `web-app/vercel.json` に Vercel 用の rewrite が追加済み

## 次のステップ

- Data モード（`createBrowserRouter` + `loader` / `action`）でデータ取得と再検証をルーターに任せる
- Framework モード（`@react-router/dev`、`routes.ts`、型安全なルートモジュール、SSR / プリレンダリング）
- 動的ルート `:id` と `useParams`、クエリ文字列と `useSearchParams`
- 型安全なルーティングを重視する別ライブラリ（TanStack Router など）との比較

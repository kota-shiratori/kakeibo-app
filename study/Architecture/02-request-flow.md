# リクエストの流れ — ブラウザから描画まで

## 概要

「画面に収入一覧が出る」までに、どのプログラムがどの順番で何をしているかを追います。流れを一度図にしておくと、バグが起きたときに「どの段階の問題か」を切り分けられるようになります。

## このプロジェクトでの実装

### 1. 一覧表示（GET）のシーケンス

```mermaid
sequenceDiagram
  autonumber
  actor U as ユーザー
  participant B as ブラウザ
  participant V as Vite dev server
  participant R as React (SPA)
  participant H as useIncomeTransactions
  participant API as Hono (port 3000)

  U->>B: http://localhost:(Viteのポート)/ を開く
  B->>V: GET /
  V-->>B: index.html
  B->>V: GET /src/main.tsx ほか（ESモジュール）
  V-->>B: 変換済み JS
  B->>R: createRoot(...).render(<App />)
  R->>R: BrowserRouter が "/" → <Home /> を選ぶ
  R->>H: RecentIncomeTransactionList がフックを呼ぶ
  H-->>R: 初期状態 isLoading=true → <Spinner />
  H->>API: fetch(`${BASE_URL}/transactions?type=income`)（useEffect 内）
  API->>API: cors ミドルウェア → type を検証 → 一覧と合計を計算
  API-->>H: 200 { transactions, totalCount, totalAmount }
  H->>H: setIncomeList(data), setIsLoading(false)
  H-->>R: state 更新 → 再レンダリング
  R-->>B: TransactionList を描画（先頭 maxTransactions 件）
```

対応するコード:

- エントリーポイント: `web-app/index.html:11` → `web-app/src/main.tsx:6`
- ルーティング: `web-app/src/App.tsx:9`
- フック呼び出し: `web-app/src/components/TransactionList.tsx:41`
- fetch: `web-app/src/hooks/useIncomeTransactions.ts:15`
- 取得開始のタイミング（マウント時に 1 回）: `web-app/src/hooks/useIncomeTransactions.ts:30-32`
- サーバー側処理: `backend/src/index.ts:18-49`
- 状態に応じた表示切り替え: `web-app/src/components/TransactionList.tsx:85-108`

Home には収入と支出の 2 つのリストがあるので、**同じ流れが 2 本並行して** 走ります（`type=income` と `type=expense`）。

### 2. 登録（POST）のシーケンス

```mermaid
sequenceDiagram
  autonumber
  actor U as ユーザー
  participant P as InputPage
  participant A as useAddTransactions
  participant B as ブラウザ
  participant API as Hono

  U->>P: フォーム入力 → 登録ボタン
  P->>P: e.preventDefault()、支出なら金額をマイナスに変換
  P->>A: addTransaction({ item, amount, date })
  A->>B: fetch POST /transactions (Content-Type: application/json)
  B->>API: OPTIONS /transactions（CORS プリフライト）
  API-->>B: 許可ヘッダー（cors ミドルウェア）
  B->>API: POST /transactions
  API->>API: 必須項目・金額・日付形式を検証
  alt 正常
    API-->>A: 201 受け取った body をそのまま返す
    A-->>P: true
    P->>P: navigate("/") → Home が再マウントされ一覧を再取得
  else 不正
    API-->>A: 400 { message }
    A-->>P: false（error に汎用メッセージ）
    P->>U: 赤字でエラー表示
  end
```

対応するコード:

- 送信処理: `web-app/src/pages/Input.tsx:29-47`
- fetch: `web-app/src/hooks/useAddTransactions.ts:14-18`
- CORS 設定: `backend/src/index.ts:8-16`
- 検証: `backend/src/index.ts:56-81`
- 成功レスポンス: `backend/src/index.ts:83`

`Content-Type: application/json` の POST はブラウザの「単純リクエスト」に当たらないため、実際の POST の前に OPTIONS によるプリフライトが送られます。`cors()` ミドルウェアは OPTIONS リクエストを自動で受け止めて 204 と許可ヘッダーを返します（`allowMethods` に `"OPTIONS"` を書かなくても応答します。`allowMethods` は `Access-Control-Allow-Methods` ヘッダーに載せる値の指定です）（CORS の詳細は Hono / API-Design フォルダ参照）。

## 重要語句

- **シーケンス図**: 登場人物（参加者）の間のメッセージのやり取りを時間順に描く図。
- **マウント**: コンポーネントが初めて画面に配置されること。`useEffect(..., [])` はマウント後に実行される。
- **プリフライトリクエスト**: クロスオリジンで「単純でない」リクエストを送る前に、ブラウザが自動で送る OPTIONS リクエスト。
- **再レンダリング**: state が変わったときに React がコンポーネント関数を再実行し、画面を更新すること。

## 仕様・注意点

- 開発時は `<StrictMode>`（`web-app/src/main.tsx:7`）により、マウント時の Effect が意図的に 2 回実行されます。そのため開発中はネットワークタブで GET が 2 回ずつ見えるのが正常です（本番ビルドでは 1 回）。
- 登録後に一覧が更新されるのは、POST の結果を state に反映しているからではなく、**画面遷移で Home が作り直され、フックが再度 fetch するから** です（`10-state-management.md`）。
- 本番では Vite dev server は存在せず、`npm run build`（`web-app/package.json:8`）で生成した静的ファイルを何らかの静的ホスティングから配信する形になります。バックエンドは `tsc` でビルドし `node dist/index.js` で起動します（`backend/package.json:6-7`）。

## 今後に活かせるポイント

- 不具合調査は「ブラウザのネットワークタブ → サーバーログ → フックの state → コンポーネント」の順にこの図をなぞると切り分けやすい。
- 新機能を設計するときも、まずシーケンス図を描くと「どこで検証するか」「どこで state を持つか」が自然に決まる。

## 改善するなら

- サーバー側にリクエストログを入れると流れを追いやすくなります（Hono には `logger` ミドルウェアがある。Hono フォルダ参照）。

```ts
import { logger } from "hono/logger";
app.use(logger());
```

## 次に学ぶこと

- ブラウザ DevTools の Network パネルの読み方（Timing、Preflight の表示）。
- **分散トレーシング**（OpenTelemetry）: 複数サービスにまたがるリクエストの流れを可視化する仕組み。

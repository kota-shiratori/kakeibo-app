# React 学習ノート（kakeibo-app）

家計簿アプリ `web-app/`（React 19 + Chakra UI v3 + React Router v7 + Vite）のコードから、**React そのもの** について学べることをまとめたノートです。番号順に読むと、基礎から応用へ進めるようになっています。

- 対象バージョン: `package.json` は `react` / `react-dom` が `^19.2.8`、実際にインストールされているのは 19.3.0（`@types/react` も 19.3.0）
- Chakra UI の部品 → `study/ChakraUI`、ルーティング → `study/Routing`、Vite・lint → `study/Tooling`、型 → `study/TypeScript`、API → `study/API-Design`、全体設計 → `study/Architecture` を参照

## 目次

### 第 1 部: アプリの起動と基本の書き方

| # | ノート | 内容 |
| --- | --- | --- |
| 01 | [エントリーポイントと createRoot](./01-entry-point-createroot.md) | `index.html` の空 div に `main.tsx` の `createRoot().render()` で React を描画する流れ |
| 02 | [StrictMode と開発時の二重実行](./02-strict-mode.md) | 開発時に effect が 2 回動き、API が 2 回呼ばれる理由と正しい向き合い方 |
| 03 | [関数コンポーネント](./03-function-components.md) | JSX を返す関数としてのコンポーネント、`function` とアロー関数、命名規則 |
| 04 | [JSX の基本ルールと「import React 不要」の理由](./04-jsx-basics-and-new-transform.md) | `{}` で式を埋め込む・属性名の違い・新しい JSX 変換（automatic runtime） |
| 05 | [Fragment](./05-fragment.md) | `<>...</>` で余計な div を作らずに複数要素を返す |

### 第 2 部: コンポーネント間のデータの受け渡し

| # | ノート | 内容 |
| --- | --- | --- |
| 06 | [props と分割代入](./06-props-and-destructuring.md) | 親から子へのデータ渡し、props の型定義と分割代入、バケツリレー |
| 07 | [children / ReactNode とコンポーネント合成](./07-children-and-composition.md) | `SummaryCard` に中身を差し込む合成パターンと `ReactNode` 型 |

### 第 3 部: 状態（state）

| # | ノート | 内容 |
| --- | --- | --- |
| 08 | [useState の基本](./08-usestate-basics.md) | 初期値・型引数の使い分け・更新関数・遅延初期化 |
| 09 | [state 更新のタイミングとバッチ処理](./09-state-update-timing-and-batching.md) | set してもすぐ変わらない理由、自動バッチ、成否を戻り値で返す設計 |

### 第 4 部: 副作用とデータ取得

| # | ノート | 内容 |
| --- | --- | --- |
| 10 | [useEffect と依存配列](./10-useeffect-fetch-on-mount.md) | マウント時のデータ取得、依存配列の 3 パターン、lint の警告 |
| 11 | [クリーンアップの無い effect と競合状態](./11-useeffect-race-condition-cleanup.md) | 古いリクエストが新しい結果を上書きする問題と AbortController / ignore フラグ |
| 12 | [カスタムフック](./12-custom-hooks.md) | `useIncomeTransactions` などの取得系・操作系フックと、type 引数での共通化 |
| 13 | [Rules of Hooks](./13-rules-of-hooks.md) | フックをトップレベルでのみ呼ぶ理由と、早期 return との両立 |
| 14 | [非同期処理の 3 状態と try/catch/finally](./14-async-state-loading-error-data.md) | isLoading / error / data の管理、`response.ok` チェック、判別可能なユニオン |

### 第 5 部: 表示の組み立て

| # | ノート | 内容 |
| --- | --- | --- |
| 15 | [条件付きレンダリング](./15-conditional-rendering.md) | 早期 return・`&&`・三項演算子の使い分けと `0` が表示される落とし穴 |
| 16 | [リスト描画と key](./16-list-rendering-and-keys.md) | `map` で一覧を描画し、ID を key にする理由。`slice` などの非破壊操作 |

### 第 6 部: ユーザー操作とフォーム

| # | ノート | 内容 |
| --- | --- | --- |
| 17 | [イベントハンドラと async ハンドラ](./17-event-handlers.md) | 関数を「渡す」書き方、イベントオブジェクト、非推奨になった `FormEvent` |
| 18 | [制御コンポーネント](./18-controlled-components.md) | `value` + `onChange` で入力値を state 管理。RadioGroup の非制御との混在 |
| 19 | [フォーム送信と e.preventDefault()](./19-form-submit-preventdefault.md) | `onSubmit` と再読み込み防止、`type="button"`、React 19 のフォーム Actions |

### 第 7 部: 設計

| # | ノート | 内容 |
| --- | --- | --- |
| 20 | [表示ロジックとデータ取得の分離](./20-separating-data-and-presentation.md) | `RecentTransactionList` と `TransactionList` の 4 層構造と、その利点 |
| 21 | [ファイル内の非公開コンポーネントとヘルパー関数](./21-private-components-and-helpers.md) | export しない部品、`formatDate`、下で定義した `const` が使える理由（TDZ） |
| 22 | [登録後のデータ再取得と refetch](./22-data-freshness-after-mutation.md) | 再マウントで最新化される仕組み、未使用の `refetch`、キャッシュ無効化 |

## このコードで見つかった主な改善ポイント（まとめ）

各ノートの「改善するなら」から、特に重要なものを抜き出しています。

1. **収入/支出フックの重複** → `useTransactions(type)` に共通化（12）
2. **effect にクリーンアップがない** → AbortController で中断し、競合状態を防ぐ（11）
3. **`refetch` が未使用で、effect と別経路** → 再取得カウンターを依存配列に入れて一本化（12, 22）
4. **`npx oxlint` で `set-state-in-effect` の警告が出ている** → 手書き effect 取得の限界。TanStack Query などを検討（10）
5. **`FormEvent` が `@types/react` 19.3 で非推奨** → `SubmitEvent` へ（`VStack as="form"` に渡すなら `SubmitEvent<HTMLElement>`。17）
6. **RadioGroup だけ非制御（`defaultValue`）** → `value` にして値の置き場所を 1 つに（18）
7. **3 状態が独立した state** → 判別可能なユニオン型で、ありえない組み合わせを防ぐ（14）

## 次に学ぶとよいトピック

- TanStack Query（データ取得・キャッシュ）
- React 19 の `use` / Actions / `useActionState` / `useOptimistic` / `useFormStatus`
- React Hook Form + Zod（フォームとバリデーション）
- `useMemo` / `useCallback` / `React.memo` と React Compiler（パフォーマンス）
- Suspense と Error Boundary（読み込み中・エラーの宣言的な扱い）
- Context（props のバケツリレーを避ける）

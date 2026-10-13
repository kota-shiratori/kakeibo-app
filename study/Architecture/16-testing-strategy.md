# テスト戦略 — まだテストがない状態から、どこから足すか

## 概要

現時点では、`backend/` にも `web-app/` にも **テストコードもテスト用の設定もありません**。`package.json` の `scripts` にも `test` はありません（`backend/package.json:4-8`, `web-app/package.json:6-12`）。品質を保つ仕組みとして存在するのは、TypeScript の型チェック（`web-app` の `build` は `tsc -b` を含む）と oxlint（`web-app/package.json:10`）だけです。

テストを書くこと自体よりも、「**どこから・何の種類のテストを足すと効果が高いか**」を設計の観点で考えます。

## このプロジェクトでの実装

### 現在の品質チェック

| 仕組み | 対象 | 設定 |
|---|---|---|
| 型チェック（web-app） | フロント全体 | `web-app/package.json:8`（`tsc -b && vite build`）、`tsconfig.app.json` |
| 型チェック（backend） | バックエンド | `backend/package.json:6`（`tsc`）、`backend/tsconfig.json:5` `strict: true` |
| Lint（web-app） | フロント | `web-app/.oxlintrc.json`（`react/rules-of-hooks` など） |
| 自動テスト | — | **なし** |

### テストしたい箇所と、今のコードのテストしやすさ

| 対象 | 場所 | 種類 | 今のテストしやすさ |
|---|---|---|---|
| POST の検証ルール | `backend/src/index.ts:56-81` | API テスト | △ `app` が export されておらず、ファイルを import すると `serve()` が走ってサーバーが起動する |
| GET の type 検証・合計計算 | `backend/src/index.ts:21-46` | API テスト | △ 同上 |
| 支出の符号変換 | `web-app/src/pages/Input.tsx:32-36` | 単体テスト | ✕ イベントハンドラの中に埋め込まれていて単独で呼べない |
| 日付整形 `formatDate` | `web-app/src/components/TransactionList.tsx:180-186` | 単体テスト | △ 純粋関数だが export されていない |
| 状態ごとの表示切替 | `web-app/src/components/TransactionList.tsx:85-108` | コンポーネントテスト | △ `RecentTransactionList` は export されていないが、props だけで描ける構造 |
| 取得フック | `web-app/src/hooks/*.ts` | フックのテスト | △ fetch のモックが必要 |
| 登録 → 一覧に戻る流れ | Input → Home | E2E テスト | ◯ ブラウザ操作で検証可能（ただし永続化がないので一覧の変化は確認できない） |

## 重要語句

- **単体テスト（Unit Test）**: 関数やモジュールを単独でテストする。速くて壊れにくい。
- **結合テスト（Integration Test）**: 複数の部品を組み合わせてテストする。API にリクエストを送ってレスポンスを確かめる、など。
- **E2E テスト（End-to-End）**: 本物のブラウザでユーザー操作を再現し、フロント〜バックまで通しで確認する。
- **テストピラミッド / テスティングトロフィー**: テストの種類ごとの理想的な比率を示す考え方。トロフィーは結合テストを厚くすることを勧める。
- **純粋関数**: 同じ入力に対して常に同じ出力を返し、副作用のない関数。最もテストしやすい。
- **テスト容易性（testability）**: コードがテストしやすい構造になっているか。設計の良さの指標でもある。

## 仕様・注意点

- テストを書こうとすると、**設計の問題が浮き彫りになる** ことが多いです。このプロジェクトでも、
  - `app` の定義とサーバー起動が同じファイルにある → API テストがしにくい
  - ドメインロジック（符号変換）が UI のイベントハンドラに埋まっている → 単体テストできない
  
  という構造上の課題が見つかります。逆に言えば、テストしやすい形に直すことがそのまま設計の改善になります。
- 永続化がない現状では、「登録したものが一覧に出る」という最重要シナリオはそもそも実現していないので、E2E はその実装後に書くほうが効率的です。

## 今後に活かせるポイント

おすすめの着手順（費用対効果の高い順）:

1. **バックエンドの API テスト**: 検証ルール（400 になる条件）は仕様そのもの。HTTP サーバーを起動せずに `app.request()` で呼べるので速い。
2. **ドメインロジックの単体テスト**: 符号変換・日付整形・合計計算を純粋関数に切り出してテスト。
3. **Presentational コンポーネントのテスト**: loading / error / 空 / データありの 4 状態で正しい表示になるか。
4. **E2E テスト**: 永続化を入れた後に「登録 → 一覧に表示」を 1 本。

## 改善するなら

### ステップ 0: テストしやすい形に分割する

```ts
// backend/src/app.ts（案）— app を export
export const app = new Hono();
// ...ミドルウェアとルート...

// backend/src/index.ts（案）— 起動だけ
import { serve } from "@hono/node-server";
import { app } from "./app.js";
serve({ fetch: app.fetch, port: 3000 });
```

```ts
// web-app/src/domain/transaction.ts（案）— 符号変換を純粋関数に
export const toSignedAmount = (kind: "income" | "expense", value: number) =>
  kind === "expense" ? -Math.abs(value) : Math.abs(value);
```

### ステップ 1: Vitest で API テスト

```ts
// backend/src/app.test.ts（案）
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("POST /transactions", () => {
  it("amount が 0 なら 400", async () => {
    const res = await app.request("/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: "x", amount: 0, date: "2025-01-01" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "金額は0以外の数値である必要があります。" });
  });
});
```

※ `env.ts` は import 時に `FRONTEND_URL` を検証するため、テスト実行時にも環境変数を用意する必要があります。

### ステップ 2: 単体テスト

```ts
// web-app/src/domain/transaction.test.ts（案）
it("支出は負の数になる", () => {
  expect(toSignedAmount("expense", 1500)).toBe(-1500);
  expect(toSignedAmount("income", 1500)).toBe(1500);
});
```

### ステップ 3: コンポーネントテスト（Testing Library）

`RecentTransactionList` を export し（または表示部分を別ファイルに分け）、`hooks` に `{ isLoading: true, ... }` などの固定値を渡して表示を確認します。Chakra UI のコンポーネントを描画するにはテストでも `ChakraProvider` で包む必要があります。

### ディレクトリ構成例

```text
backend/src/
├── app.ts
├── app.test.ts
web-app/src/
├── domain/
│   ├── transaction.ts
│   └── transaction.test.ts
└── components/
    ├── TransactionList.tsx
    └── TransactionList.test.tsx
e2e/                 ← Playwright（リポジトリルートまたは web-app 内）
└── add-transaction.spec.ts
```

## 次に学ぶこと

- **Vitest**: Vite と設定を共有できるテストランナー（Tooling フォルダ参照）。
- **Testing Library**: 「ユーザーから見える振る舞い」でコンポーネントをテストする考え方。
- **MSW（Mock Service Worker）**: fetch をネットワーク層でモックし、フックやページをテストする。
- **Playwright**: E2E テスト。
- **TDD（テスト駆動開発）**: テストを先に書いて設計を導く開発手法。

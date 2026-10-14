# テスト戦略 — まだテストがない状態から、どこから足すか

## 概要

現時点では、`backend/` にも `web-app/` にも **テストコードもテスト用の設定もありません**。`package.json` の `scripts` にも `test` はありません（`backend/package.json:4-7`, `web-app/package.json:6-12`）。品質を保つ仕組みとして存在するのは、TypeScript の型チェック（`web-app` の `build` は `tsc -b` を含む、backend は `typecheck`）と oxlint（`web-app/package.json:10`）だけです。

PostgreSQL を導入したことで、「登録したものが一覧に出る」という最重要シナリオが実際に動くようになりました。一方、テストの観点では **DB という外部依存** が加わり、何をどこまで本物の DB で確かめるかを考える必要が出てきました。

テストを書くこと自体よりも、「**どこから・何の種類のテストを足すと効果が高いか**」を設計の観点で考えます。

## このプロジェクトでの実装

### 現在の品質チェック

| 仕組み | 対象 | 設定 |
|---|---|---|
| 型チェック（web-app） | フロント全体 | `web-app/package.json:8`（`tsc -b && vite build`）、`tsconfig.app.json` |
| 型チェック（backend） | バックエンド | `backend/package.json:6`（`typecheck`: `tsc --noEmit`）、`backend/tsconfig.json:5` `strict: true` |
| Lint（web-app） | フロント | `web-app/.oxlintrc.json`（`react/rules-of-hooks` など） |
| 自動テスト | — | **なし** |

### テストしたい箇所と、今のコードのテストしやすさ

| 対象 | 場所 | 種類 | 今のテストしやすさ |
|---|---|---|---|
| POST の検証ルール（400） | `backend/src/index.ts:81-91` | API テスト | ◯ `app` が export され（108 行目）、`serve()` は `dev.ts` に分離済み。400 を返す経路は DB に触れないので、DB なしで `app.request()` できる（実験で確認） |
| GET の type 検証（400） | `backend/src/index.ts:32-39` | API テスト | ◯ 同上 |
| GET の絞り込み・並び順・合計、POST の保存 | `backend/src/index.ts:41-75`, `93-105` | 結合テスト（DB あり） | △ ハンドラが `pool` を直接使うため **本物の DB が必要**。テスト用 DB の用意・データの初期化が要る |
| 行の変換（`toYMD` など） | `backend/src/index.ts:22-27`, `56-61` | 単体テスト | △ `toYMD` は純粋関数だが export されていない |
| 支出の符号変換 | `web-app/src/pages/Input.tsx:32-36` | 単体テスト | ✕ イベントハンドラの中に埋め込まれていて単独で呼べない |
| 日付整形 `formatDate` | `web-app/src/components/TransactionList.tsx:180-186` | 単体テスト | △ 純粋関数だが export されていない |
| 状態ごとの表示切替 | `web-app/src/components/TransactionList.tsx:85-108` | コンポーネントテスト | △ `RecentTransactionList` は export されていないが、props だけで描ける構造 |
| 取得フック | `web-app/src/hooks/*.ts` | フックのテスト | △ fetch のモックが必要 |
| 登録 → 一覧に表示 | Input → Home | E2E テスト | ◯ ブラウザ操作で検証可能。永続化されたので「登録した行が一覧に出る」まで確認できる（DB を毎回きれいにする工夫が必要） |

## 重要語句

- **単体テスト（Unit Test）**: 関数やモジュールを単独でテストする。速くて壊れにくい。
- **結合テスト（Integration Test）**: 複数の部品を組み合わせてテストする。API にリクエストを送ってレスポンスを確かめる、など。
- **E2E テスト（End-to-End）**: 本物のブラウザでユーザー操作を再現し、フロント〜バックまで通しで確認する。
- **テストピラミッド / テスティングトロフィー**: テストの種類ごとの理想的な比率を示す考え方。トロフィーは結合テストを厚くすることを勧める。
- **純粋関数**: 同じ入力に対して常に同じ出力を返し、副作用のない関数。最もテストしやすい。
- **テスト容易性（testability）**: コードがテストしやすい構造になっているか。設計の良さの指標でもある。

## 仕様・注意点

- テストを書こうとすると、**設計の問題が浮き彫りになる** ことが多いです。このプロジェクトでも、
  - ~~`app` の定義とサーバー起動が同じファイルにある → API テストがしにくい~~ → Vercel 対応で `dev.ts` に分離され、解消済み
  - SQL がハンドラに直接書かれ、`pool` がモジュールのトップレベルにある → DB なしでは GET の中身や POST の成功系をテストできない
  - ドメインロジック（符号変換）が UI のイベントハンドラに埋まっている → 単体テストできない
  
  という構造上の課題が見つかります。逆に言えば、テストしやすい形に直すことがそのまま設計の改善になります。
- **`index.ts` を import すると `env` の検証が走る**: テストでも `FRONTEND_URL` と `DATABASE_URL` が必要です。`Pool` は最初のクエリまで接続しないので、400 の経路だけをテストするなら `DATABASE_URL` はダミー（存在しない接続先）でも動きます。ただし DB に届く経路は 500（`ECONNREFUSED`）になります（実験で確認）。
- **本物の DB を使うテストは開発用 DB と分ける**: 開発中のデータ（`kakeibo_db`）をテストで書き換えたり消したりしないよう、テスト専用の DB（例: 同じコンテナ内の `kakeibo_test`）を作り、テストの前にテーブルを作り直す・`TRUNCATE` するなどして毎回同じ状態から始めます（`../Database/04-migrations-and-schema-management.md`）。

## 今後に活かせるポイント

おすすめの着手順（費用対効果の高い順）:

1. **バックエンドの API テスト（DB なし）**: 検証ルール（400 になる条件）は仕様そのもの。`app` は export 済みなので、今すぐ `app.request()` で書ける。
2. **リポジトリ層の分離 + メモリ実装**: SQL をリポジトリに移せば、GET の絞り込み・合計や POST の成功系も DB なしでテストできる（`15-persistence-and-repository-layer.md`）。
3. **リポジトリの pg 実装の結合テスト**: 本物の PostgreSQL（Docker のテスト用 DB）で、SQL・型変換（`BIGINT` → number、`DATE` → `"YYYY-MM-DD"`）が正しいかを確かめる。
4. **ドメインロジックの単体テスト**: 符号変換・日付整形・合計計算を純粋関数に切り出してテスト。
5. **Presentational コンポーネントのテスト**: loading / error / 空 / データありの 4 状態で正しい表示になるか。
6. **E2E テスト**: 「登録 → 一覧に表示」を 1 本（テスト用 DB を使う）。

## 改善するなら

### ステップ 0: テストしやすい形に分割する

`app` と `serve()` の分離は済んでいます（`backend/src/index.ts:108` の `export default app`、`backend/src/dev.ts`）。次は SQL をリポジトリに移し、`app` をリポジトリを受け取って作る形にします（詳細は `15-persistence-and-repository-layer.md`）。

```ts
// backend/src/app.ts（案）
export const createApp = (repo: TransactionRepository) => {
  const app = new Hono();
  // ...ミドルウェアとルート（repo を使う）...
  return app;
};
```

```ts
// web-app/src/domain/transaction.ts（案）— 符号変換を純粋関数に
export const toSignedAmount = (kind: "income" | "expense", value: number) =>
  kind === "expense" ? -Math.abs(value) : Math.abs(value);
```

### ステップ 1: Vitest で API テスト

```ts
// backend/src/index.test.ts（案）— 今のコードのままでも書ける 400 のテスト
import { describe, expect, it } from "vitest";
import app from "./index.js";

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

※ `env.ts` は import 時に `FRONTEND_URL` と `DATABASE_URL` を検証するため、テスト実行時にも環境変数を用意する必要があります（400 の経路だけならダミーの `DATABASE_URL` で可）。

リポジトリ分離後は、メモリ実装を渡して成功系もテストできます。

```ts
// backend/src/app.test.ts（リポジトリ分離後の案）
const app = createApp(createInMemoryTransactionRepository());

it("登録したものが一覧に出る", async () => {
  await app.request("/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item: "ランチ", amount: -1000, date: "2025-10-01" }),
  });
  const res = await app.request("/transactions?type=expense");
  expect((await res.json()).totalCount).toBe(1);
});
```

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
├── app.test.ts                         ← メモリ実装で API テスト
└── repositories/
    └── pgTransactionRepository.test.ts ← テスト用 DB で結合テスト
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
- **Testcontainers**: テストのたびに Docker で使い捨ての PostgreSQL を起動して結合テストする方法（`../Docker/`）。
- **TDD（テスト駆動開発）**: テストを先に書いて設計を導く開発手法。

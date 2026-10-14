# ミドルウェアの仕組み（`app.use`、`"/*"`、実行順）

## 概要

ミドルウェアは、**ハンドラの前後に共通処理を差し込む関数** です。ログ出力、CORS ヘッダ付与、認証、エラー整形などを、各ハンドラに書かずに 1 か所で済ませられます。

Hono のミドルウェアの形:

```ts
async (c, next) => {
  // ① ハンドラより「前」の処理
  await next();       // 次のミドルウェア（最後はハンドラ）を実行
  // ② ハンドラより「後」の処理（c.res を加工できる）
}
```

`app.use(パス, ミドルウェア)` で登録します。

## このプロジェクトでの実装

`backend/src/index.ts:12-20`

```ts
app.use(
  "/*",
  cors({
    origin: [env.FRONTEND_URL],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
```

- `"/*"`: すべてのパスに適用
- `cors({...})`: 設定を受け取って **ミドルウェア関数を返す** ファクトリ関数（→ 09 章）
- ルート（29 行目以降）より **前** に登録しているので、すべてのルートで CORS ヘッダが付きます

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `app.use(path?, ...middlewares)` | ミドルウェア登録。パス省略時は全パス（`*`）に適用 |
| `next()` | 次の処理を呼ぶ関数。**`await` して呼ぶ** |
| オニオン（玉ねぎ）モデル | 外側のミドルウェアから順に「前処理」→ハンドラ→内側から順に「後処理」と戻ってくる実行モデル |
| `c.res` | 現在のレスポンス。`await next()` の後で参照・加工できる |
| ミドルウェアファクトリ | `cors(options)` のように、設定を受け取ってミドルウェアを返す関数 |
| `MiddlewareHandler` | ミドルウェアの型（`import type { MiddlewareHandler } from "hono"`） |

## 仕様・注意点

### 実行順（実験で確認）

ミドルウェア A → cors → ミドルウェア B → ハンドラ の順で登録して GET したところ、ログは次の順でした。

```
A-before > B-before > handler > B-after > A-after
```

- 前処理は **登録順**、後処理は **逆順**（オニオンモデル）。
- だから「全体を計測するロガー」や「エラーを整形するミドルウェア」は **最初に** 登録します。

### `"/*"` のマッチ範囲

- `"/*"` は `/transactions` だけでなく **`/`（ルート）や存在しないパスにもマッチ** します。実験では、どのルートにもマッチしない `/` へのリクエスト（404）にも CORS 関連ヘッダ（`access-control-allow-credentials` など）が付いていました。
- `app.use(cors(...))` のようにパスを省略しても全パスに適用されます。`"/api/*"` のように範囲を絞ることもできます。

### その他の注意

- **`await next()` を忘れない**。`next()` を `await` しないと後続の完了を待たずに進んでしまい、後処理で正しい `c.res` を扱えません。また、`next()` を呼ばず `Response` も返さないと「Context is not finalized」エラー（500）になります。
- **ミドルウェアから `Response` を返すと、後続は実行されない**。CORS のプリフライト（OPTIONS）では、cors ミドルウェアが `204` の `Response` を返して処理を打ち切ります（→ 09 章）。認証失敗時に `return c.json({...}, 401)` するのも同じ仕組みです。
- ミドルウェアは **登録したパス・順序で** 適用されるので、ルートより後に `app.use` すると、そのルートには効かないケースがあります。基本は「ミドルウェア → ルート」の順で書きます。

## 今後に活かせるポイント

自作ミドルウェアの最小例（処理時間をヘッダに付ける）:

```ts
app.use("/*", async (c, next) => {
  const start = Date.now();
  await next();
  c.header("X-Response-Time", `${Date.now() - start}ms`);
});
```

Hono には便利な組み込みミドルウェアが多数あります（インポートパスは `hono/<名前>`）。

| ミドルウェア | 用途 |
| --- | --- |
| `hono/logger` | リクエストログ |
| `hono/cors` | CORS |
| `hono/secure-headers` | セキュリティ系ヘッダ |
| `hono/body-limit` | ボディサイズ制限 |
| `hono/bearer-auth` / `hono/basic-auth` / `hono/jwt` | 認証 |
| `hono/request-id` | リクエスト ID 付与 |

## 改善するなら

開発時のデバッグのために `logger` を最初に追加すると、リクエストの流れが見えるようになります。

```ts
import { logger } from "hono/logger";

app.use(logger());           // 最初に登録（全体を包む）
app.use("/*", cors({ ... }));
```

## 次に学ぶこと

- `createMiddleware`（`hono/factory`）で型付きミドルウェアを作る
- ルート単位のミドルウェア: `app.get("/admin", authMiddleware, handler)`
- `hono/combine` の `some` / `every` / `except` によるミドルウェアの組み合わせ

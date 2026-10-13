# fetch API と response.ok

## 概要

`fetch` はブラウザ標準の HTTP クライアントです。初学者が必ずハマるのが次の性質です。

> **`fetch` が返す Promise は、HTTP ステータスが 4xx や 5xx でも reject されない。**

`fetch` が reject（例外）になるのは、主に次のような「そもそもレスポンスを受け取れなかった」場合です。

- ネットワークエラー（サーバーが起動していない、DNS 解決失敗、オフラインなど）
- **CORS で拒否された**（ブラウザがレスポンスを JavaScript に渡さない）
- `AbortController` で中断した

サーバーから 400 や 500 が返ってきた場合は「レスポンスを受け取れた」ので **成功（resolve）** 扱いです。そのため、ステータスは自分で確認する必要があります。その近道が `response.ok` です。

- `response.ok` … ステータスが **200〜299** なら `true`、それ以外は `false`。
- `response.status` … ステータスコードの数値（例: `400`）。

## このプロジェクトでの実装

`web-app/src/hooks/useAddTransactions.ts:13-30`

```ts
try {
  const response = await fetch(`${BASE_URL}/transactions`, { ... });
  if (!response.ok) {
    throw new Error("取引の登録に失敗しました。");
  }
  return true;
} catch (err) {
  setError(
    err instanceof Error ? err : new Error("不明なエラーが発生しました。"),
  );
  return false;
} finally {
  setIsLoading(false);
}
```

流れを整理すると:

1. 400 が返る → `fetch` は resolve → `response.ok === false` → 自分で `throw` → `catch` へ。
2. サーバー停止・CORS 拒否 → `fetch` 自体が reject（`TypeError`）→ `catch` へ。
3. 201 が返る → `response.ok === true` → `return true`。

`if (!response.ok)` がなければ、1 のケースでも「登録成功」と扱ってしまいます。この 1 行が重要です。

取得系も同じパターンです（`web-app/src/hooks/useIncomeTransactions.ts:14-27`, `web-app/src/hooks/useExpenseTransactions.ts:14-27`）。

## 重要語句

- **Promise の resolve / reject**: 非同期処理の成功 / 失敗。
- **`response.ok`**: ステータス 200〜299 かどうかの真偽値。
- **`response.status` / `response.statusText`**: ステータスコードとその説明文。
- **`TypeError: Failed to fetch`**: ネットワークエラーや CORS 拒否のときに Chrome で見られる代表的なエラー（メッセージはブラウザにより異なる）。

## 仕様・注意点

- **CORS エラーとネットワークエラーは JavaScript から区別できません。** どちらも `TypeError` になります。原因はブラウザの開発者ツールのコンソールやネットワークタブで確認します。
- `response.json()` も失敗しうる処理です。500 の `text/plain`（`Internal Server Error`）を `json()` すると `SyntaxError` になります。このプロジェクトでは `!response.ok` で先に throw しているため、エラー時に `json()` を呼ばず安全です。
- レスポンスのボディは **1 回しか読めません**（`json()` と `text()` を両方呼ぶと 2 回目は失敗）。
- `fetch` には既定のタイムアウトがありません。必要なら `AbortSignal.timeout(ミリ秒)` を `signal` に渡します。
- `fetch` のクッキー送信は既定で `credentials: "same-origin"` です。別オリジンの API にクッキーを送るには `credentials: "include"` が必要です（→ `21-cors-credentials-and-hono-config.md`）。

## 今後に活かせるポイント

- 「`fetch` → `response.ok` 確認 → `json()`」をワンセットで書く癖をつけましょう。
- axios など他のライブラリは 4xx/5xx で例外を投げる仕様のものもあります。ライブラリごとに挙動を確認すること。

## 改善するなら

### ステータスとサーバーのメッセージを保持するエラークラス

```ts
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { signal: AbortSignal.timeout(10_000), ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
```

※ `constructor(public status: number, ...)` という「パラメータプロパティ」の短縮記法は、`web-app/tsconfig.app.json:25` の `erasableSyntaxOnly: true` により型エラー（TS1294）になるため、フィールドを明示的に宣言して代入しています。

`status` を持たせておけば、画面側で「401 ならログイン画面へ」「400 なら入力欄にメッセージ」と分岐できます。

### useEffect 内の fetch の中断

画面遷移でコンポーネントが消えたあとに `setState` しないよう、`AbortController` で中断する方法もあります（React 側の話は study/React を参照）。

## 次に学ぶこと

- TanStack Query などのデータ取得ライブラリ（キャッシュ・再取得・リトライの自動化）
- `openapi-fetch`（OpenAPI から生成した型付きの fetch クライアント）

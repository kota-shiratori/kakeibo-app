# 日付検証の落とし穴: 正規表現だけでは不十分

## 概要

`/^\d{4}-\d{2}-\d{2}$/` は「数字の並び方」しか見ていません。そのため次のような **存在しない日付** も通過します。

- `2025-13-45`（13 月 45 日）
- `2025-02-30`（2 月 30 日）
- `2025-02-29`（うるう年でない年の 2 月 29 日）
- `0000-00-00`

日付の正しさは「形式（syntax）」と「意味（semantics＝実在するか）」の 2 段階で確認する必要があります。

## このプロジェクトでの実装

`backend/src/index.ts:74-81`

```ts
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  return c.json({ message: "日付はYYYY-MM-DD形式で入力してください。" }, 400);
}
```

起動中のサーバーに `{"item":"a","amount":100,"date":"2025-13-45"}` を POST したところ、**201 Created** で受け付けられました（curl で確認）。

仕様書側は `format: date` と `pattern` の両方を書いています。

`backend/openapi.yaml:113-118`

```yaml
date:
  type: string
  format: date
  pattern: "^\\d{4}-\\d{2}-\\d{2}$"
  description: 日付（YYYY-MM-DD形式）
  example: "2025-01-01"
```

- `pattern` は実装の正規表現と同じ（YAML のダブルクォート内なので `\\d` と書いて `\d` を表している）。
- `format: date` は RFC 3339 の `full-date`（実在する日付）を意味します。ただし後述のとおり、検証ツールが必ずチェックするとは限りません。

## 重要語句

- **形式検証（syntactic validation）**: 文字の並びが正しいか。
- **意味検証（semantic validation）**: 値として意味が通るか（実在する日付か）。
- **RFC 3339 full-date**: `YYYY-MM-DD` 形式の日付。OpenAPI / JSON Schema の `format: date` が参照する定義。
- **うるう年**: 4 で割り切れる年。ただし 100 で割り切れる年は平年、400 で割り切れる年はうるう年。

## 仕様・注意点

- **`new Date()` での検証は罠があります。** Node.js（V8）で実行すると:
  - `new Date("2025-13-45")` → `Invalid Date`（弾ける）
  - `new Date("2025-02-30")` → **3 月 2 日として解釈される**（弾けない）

  つまり「`isNaN(new Date(s).getTime())` なら不正」という判定では 2 月 30 日がすり抜けます。厳密に判定するなら「パースした年・月・日が元の文字列と一致するか」まで確認する必要があります。
- **`format` は JSON Schema 2020-12（OpenAPI 3.1 が採用）では既定で「注釈（annotation）」扱い** で、検証ツールによっては値をチェックしません。`pattern` は必ず検証されます。仕様書に両方書いておくのは、「形式は pattern で確実に、意味は format で表明」という意図として妥当です。
- `\d` は JavaScript の正規表現では（`u` フラグの有無にかかわらず）ASCII の 0〜9 のみにマッチします。全角数字は通りません。
- タイムゾーンにも注意。`new Date("2025-01-01")` は **UTC の 0 時** として解釈されますが、`new Date("2025-01-01T00:00")` はローカル時刻として解釈されます。日付だけを扱うなら、文字列のまま扱うのが安全です（このプロジェクトはその方針）。

## 今後に活かせるポイント

- 正規表現は「形式」の検証に使い、「意味」の検証は専用の関数やライブラリに任せる、と覚えておきましょう。
- 日付に関しては、さらに「未来日付を許すか」「何年前まで許すか」といった業務ルールも検討ポイントになります。

## 改善するなら

### 方法 1: Zod 4 の `z.iso.date()`

```ts
import { z } from "zod";
const DateString = z.iso.date();
DateString.safeParse("2025-01-01").success; // true
DateString.safeParse("2025-13-45").success; // false
DateString.safeParse("2025-02-30").success; // false
DateString.safeParse("2024-02-29").success; // true（うるう年）
```

上記はこのプロジェクトの `backend/node_modules` にある Zod 4.6.6 で実行して確認した結果です。

### 方法 2: 自前で厳密に判定する

```ts
function isValidDateString(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
```

`typeof s !== "string"` を先に確認することで、配列 `["2025-01-01"]` が正規表現を通ってしまう問題（→ `09-input-validation-rules.md`）も防げます。

## 次に学ぶこと

- `Temporal` API（`Temporal.PlainDate.from("2025-02-30", { overflow: "reject" })` のように日付を厳密に扱える新しい標準 API）
- 日時を扱う API での ISO 8601 / RFC 3339 と UTC 保存の考え方

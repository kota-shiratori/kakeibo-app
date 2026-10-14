# node-postgres の型変換

## 概要

PostgreSQL の値は、`pg` が受け取ったあと **JavaScript の値に変換** されます（実体は依存パッケージ `pg-types`）。変換ルールは DB の型ごとに決まっていて、「数値なのに文字列で届く」「日付が `Date` オブジェクトになる」といった、知らないとハマる挙動があります。

## このプロジェクトでの実装

`backend/src/index.ts:56-61`

```ts
const transactions = historyResult.rows.map((row) => ({
  id: parseInt(row.id),
  item: row.item,
  amount: parseFloat(row.amount),
  date: toYMD(new Date(row.date)),
}));
```

`backend/src/index.ts:22-27`

```ts
const toYMD = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
```

件数は `parseInt(countResult.rows[0].total)`（70 行目）。

## 仕様・注意点

### 実験で確認: 型ごとの JS の値

`backend/node_modules/pg` で `SELECT id, item, amount, date ...` と集計を実行した結果:

| DB の型 | 例 | JS で届く値 | `typeof` |
| --- | --- | --- | --- |
| `BIGINT`（`id`） | 4 | `'4'` | string |
| `VARCHAR` | カフェ | `'カフェ'` | string |
| `INTEGER`（`amount`） | -500 | `-500` | number |
| `DATE` | 2025-10-05 | `Date` オブジェクト | object |
| `COUNT(*)`（bigint） | 6 | `'6'` | string |
| `SUM(integer)`（bigint） | -5999 | `'-5999'` | string |
| `AVG(integer)`（numeric） | | `'-999.8333333333333333'` | string |
| `MAX(integer)`（integer） | 100 | `100` | number |
| 0 件の `SUM` | | `null` | object |

理由:

- `BIGINT`（int8）は JS の `number` で正確に表せる上限（2^53 - 1）を超えうるので、**精度を失わないよう文字列のまま** 返す（`pg-types` の `lib/textParsers.js` で int8 = OID 20 に `parseBigInteger` を登録しているのを確認）。
- `NUMERIC` も任意精度なので文字列。
- `COUNT` / `SUM(integer)` の結果は `BIGINT` になるため、これも文字列になる。

したがって:

- `parseInt(row.id)` と `parseInt(...total)` は **必要**。
- `parseFloat(row.amount)` は **不要**（`INTEGER` は最初から number。`parseFloat` に number を渡すと一度文字列化されて戻るだけ）。害はないが、型を誤解させるコードです。

### 実験で確認: `DATE` は「ローカルタイムの 0 時」の `Date` になる

`pg-types` は `DATE`（OID 1082）を `postgres-date` で解析し、`new Date(year, month, day)`（ローカル時刻）を作ります（`node_modules/postgres-date/index.js` で確認）。同じ行 `2025-10-05` を、Node のタイムゾーン（`TZ`）を変えて読み込みました。

| `TZ` | `toISOString()` | `getFullYear()/getMonth()+1/getDate()` |
| --- | --- | --- |
| Asia/Tokyo | `2025-10-04T15:00:00.000Z` | 2025-10-5 |
| UTC | `2025-10-05T00:00:00.000Z` | 2025-10-5 |
| America/Los_Angeles | `2025-10-05T07:00:00.000Z` | 2025-10-5 |

- `toYMD` は `getFullYear` / `getMonth` / `getDate`（**ローカル時刻のゲッター**）を使っているので、**どのタイムゾーンで動かしても正しい日付** になります。
- 一方、よくある `d.toISOString().slice(0, 10)` は UTC で表すため、JST 環境では **1 日前（`2025-10-04`）にずれる** ことも確認しました。
- `new Date(row.date)` は `row.date` がすでに `Date` なのでコピーを作っているだけ。なくても動きます。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `pg-types` | DB の型（OID）ごとに文字列 → JS の値の変換関数を持つパッケージ |
| OID | PostgreSQL 内部の型 ID。`int8` = 20、`date` = 1082 |
| `types.setTypeParser(oid, fn)` | 変換ルールを上書きする API |

## 今後に活かせるポイント

- DB から届いた値は、**TypeScript の型注釈を信じずに実際の `typeof` を確認** する（`row` は `any` なので型エラーが出ない）。
- 日付だけを扱うなら、`Date` に変換せず **文字列のまま受け取る** のがいちばん安全。

## 改善するなら

1. `DATE` を文字列のまま受け取る（`Date` を経由しないのでタイムゾーンの心配が消える）。

```ts
import pg from "pg";

// 1082 = date 型。'2025-10-05' の文字列をそのまま返す
pg.types.setTypeParser(1082, (value) => value);
```

または SQL 側で `to_char(date, 'YYYY-MM-DD') AS date` として文字列にする。

2. `BIGINT` を number で受けたい場合は `pg.types.setTypeParser(20, (v) => parseInt(v, 10))`。家計簿の件数・ID なら 2^53 を超えることはないので実用上は問題ない。ただし **プロセス全体に効く** 設定である点に注意。
3. 行の型を明示する（`pool.query<{ id: string; item: string; amount: number; date: Date }>(...)`）。`any` のままより誤りに気づきやすい。

## 次に学ぶこと

- Neon / Vercel 環境での接続（→ 08 章）
- タイムゾーン付き日時（`TIMESTAMPTZ`）の扱い（→ 03 章）

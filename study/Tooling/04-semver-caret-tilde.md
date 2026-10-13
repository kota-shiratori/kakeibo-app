# セマンティックバージョニングと ^ / ~ の違い

## 概要

npm のパッケージは **セマンティックバージョニング（SemVer）** で番号を付けます。

```
MAJOR . MINOR . PATCH
  4   .  13   .  13
```

| 部分 | 上がるとき | 期待される互換性 |
| --- | --- | --- |
| MAJOR | 互換性を壊す変更 | **壊れる可能性あり** |
| MINOR | 後方互換のある機能追加 | 基本的に安全 |
| PATCH | バグ修正 | 安全 |

`package.json` には「どの範囲のバージョンを許すか」を **範囲指定子** で書きます。

| 書き方 | 意味 | `1.2.3` の場合に許す範囲 |
| --- | --- | --- |
| `1.2.3` | 完全一致 | `1.2.3` のみ |
| `~1.2.3` | **PATCH だけ**上げてよい | `>=1.2.3 <1.3.0` |
| `^1.2.3` | **MINOR・PATCH**を上げてよい（MAJOR は固定） | `>=1.2.3 <2.0.0` |

`npm install <pkg>` はデフォルトで `^` 付きで記録します。

## このプロジェクトでの実装

ほとんどが `^` ですが、web-app の TypeScript だけ `~` です。

```json
// web-app/package.json:27
"typescript": "~6.0.2",
// backend/package.json:19
"typescript": "^7.0.2"
```

- web-app: `~6.0.2` → `6.0.x` のみ許可。実際にインストールされているのは **6.0.3**（`web-app/node_modules/typescript/package.json` で確認）。
- backend: `^7.0.2` → `7.x.x` を許可。インストール済みは **7.0.2**。

### なぜ TypeScript だけ `~` なのか

TypeScript は SemVer に厳密に従っておらず、**マイナーバージョン（例 5.8 → 5.9）でも型チェックが厳しくなり、昨日まで通っていたコードがエラーになる**ことがあります。そのため Vite のテンプレート（`npm create vite`）は TypeScript を `~` で固定しています。web-app はこのテンプレートの設定がそのまま残っています。

backend は Hono のテンプレート（またはその後の手動更新）で `^` になっており、方針が揃っていません。

### `0.x` 系の `^` は特別

```json
// backend/package.json:11
"@t3-oss/env-core": "^0.13.11",
```

MAJOR が `0` のときは「まだ開発中で何でも壊れうる」とみなされ、`^` の意味が狭くなります。

- `^0.13.11` → `>=0.13.11 <0.14.0`（実質 `~` と同じ）
- `^0.0.3` → `0.0.3` のみ

## 重要語句

- **SemVer**: `MAJOR.MINOR.PATCH` で互換性を表すルール。
- **キャレット `^`**: 一番左の 0 でない桁を固定し、それより右を上げてよい。
- **チルダ `~`**: MINOR まで固定し、PATCH だけ上げてよい（MINOR が指定されている場合）。
- **範囲指定**: package.json に書くのは「許容範囲」であり、「実際に入ったバージョン」は lock ファイルに書かれる。

## 仕様・注意点

- package.json の `^8.3.0` を見ても、**実際に入っているバージョンは分からない**。実際のバージョンは `package-lock.json` か `npm ls vite` で確認する（このプロジェクトでは `vite` 8.3.1、`oxlint` 1.86.0、`react` 19.3.0 が入っている）。
- `package-lock.json` があれば `npm install` は lock の版を再現するので、`^` でも勝手に上がることはない（`npm update` を実行したときや lock を消したときに範囲内で上がる）。詳細は [06](./06-package-lock-json.md)。
- SemVer は「約束」であって保証ではない。PATCH 更新でも壊れることは現実にある。

## 今後に活かせるポイント

- 依存を上げるときは `npm outdated` で「範囲内の最新（Wanted）」と「本当の最新（Latest）」を確認し、MAJOR を上げるときは CHANGELOG を読む。
- 型チェッカーやコンパイラなど「挙動が変わると影響が大きいツール」は `~` や完全固定にする、という使い分けができる。

## 改善するなら

- TypeScript のバージョン指定方針を backend / web-app で揃える。例: 両方 `~` にする。
  ```json
  // backend/package.json
  "typescript": "~7.0.2"
  ```
- ただし backend は TypeScript **7**（Go で書き直されたネイティブ版。`tsc --version` で `Version 7.0.2`）、web-app は **6**（従来の JavaScript 実装の最終系）とメジャーも異なる。混乱を避けたいなら、どちらかに揃えるのも一案（揃える前に両方で `tsc` が通るか確認する）。
- 依存の自動更新には Renovate / Dependabot を使うと、更新 PR が自動で作られ安全に追従できる。

## 次に学ぶこと

- `npm outdated` / `npm update` / `npx npm-check-updates`
- Renovate / Dependabot による依存の自動更新
- `overrides`（npm）/ `pnpm.overrides`：間接依存のバージョンを強制する方法

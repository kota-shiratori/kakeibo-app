// ローカル開発用のエントリ。Vercel では src/index.ts の app が直接使われる
import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./index.js";

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});

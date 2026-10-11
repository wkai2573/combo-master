import { d1Repo, type D1Like } from './d1';
import { handle } from './handler';

interface Env {
  DB: D1Like;
  /** 問卷的目的網址，設定在 wrangler.toml 的 [vars] */
  FEEDBACK_URL?: string;
}

// Cloudflare Workers 的進入點：邏輯都在 handler.ts，這裡只把 D1 接上去
export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, d1Repo(env.DB), { feedbackUrl: env.FEEDBACK_URL });
  },
};

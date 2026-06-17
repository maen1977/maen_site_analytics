// Cloudflare Worker Cron -> GitHub Actions workflow_dispatch
// لا تضع GitHub token داخل هذا الملف. ضعه Secret في Cloudflare باسم GITHUB_TOKEN.

async function dispatchGitHubWorkflow(env, source) {
  const owner = env.GITHUB_OWNER || 'maen1977';
  const repo = env.GITHUB_REPO || 'maen_site_analytics';
  const workflowId = env.GITHUB_WORKFLOW_ID || 'update-worldcup-2026.yml';
  const ref = env.GITHUB_REF || 'main';
  const token = env.GITHUB_TOKEN;

  if (!token) {
    return {
      ok: false,
      status: 500,
      error: 'Missing Cloudflare Worker secret: GITHUB_TOKEN'
    };
  }

  const forcedAt = new Date().toISOString();
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'maensat-worldcup-cloudflare-cron'
    },
    body: JSON.stringify({
      ref,
      inputs: {
        source,
        forced_at: forcedAt
      }
    })
  });

  const body = await response.text();
  return {
    ok: response.ok || response.status === 204,
    status: response.status,
    source,
    forced_at: forcedAt,
    workflow: workflowId,
    ref,
    body: body ? body.slice(0, 800) : ''
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(dispatchGitHubWorkflow(env, 'cloudflare-cron'));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        service: 'maensat-worldcup-cloudflare-cron',
        target: `${env.GITHUB_OWNER || 'maen1977'}/${env.GITHUB_REPO || 'maen_site_analytics'}`,
        workflow: env.GITHUB_WORKFLOW_ID || 'update-worldcup-2026.yml',
        ref: env.GITHUB_REF || 'main',
        now: new Date().toISOString()
      });
    }

    if (url.pathname === '/run') {
      if (env.MANUAL_RUN_TOKEN) {
        const expected = `Bearer ${env.MANUAL_RUN_TOKEN}`;
        if (request.headers.get('authorization') !== expected) {
          return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
        }
      }
      const result = await dispatchGitHubWorkflow(env, 'cloudflare-manual-run');
      return jsonResponse(result, result.ok ? 200 : 500);
    }

    return jsonResponse({ ok: false, error: 'Use /health, or /run with MANUAL_RUN_TOKEN if configured.' }, 404);
  }
};

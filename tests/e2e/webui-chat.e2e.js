import { spawn } from 'child_process';

const port = Number(process.env.TEST_PORT || 18882);
const base = `http://127.0.0.1:${port}`;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error('server did not start');
}

async function main() {
  const child = spawn('node', ['src/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, OPENCODEX_PORT: String(port) },
    stdio: 'ignore',
  });

  try {
    await waitForServer();

    const createRes = await fetch(`${base}/api/sessions`, { method: 'POST' });
    const createJson = await createRes.json();
    const sessionId = createJson.session?.id;
    if (!sessionId) throw new Error('session not created');

    const chatRes = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Reply with exactly: E2E_OK', sessionId }),
    });
    const chatJson = await chatRes.json();
    if (!chatJson.response) throw new Error('missing chat response');

    const getRes = await fetch(`${base}/api/sessions/${sessionId}`);
    const getJson = await getRes.json();
    const msgs = getJson.session?.messages || [];
    if (msgs.length < 2) throw new Error('session history not persisted');

    console.log('PASS webui chat e2e', { sessionId, messages: msgs.length });
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error('FAIL webui chat e2e', e.message);
  process.exit(1);
});

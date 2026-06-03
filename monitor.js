import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('monitor.config.json', 'utf8'));
const timeoutMs = Number(process.env.MONITOR_TIMEOUT_MS || 10000);

async function checkTarget(target) {
  const url = process.env[target.urlEnv];
  if (!url) {
    return { name: target.name, ok: false, skipped: true, reason: `Missing ${target.urlEnv}` };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startedAt = Date.now();
    const response = await fetch(url, { signal: controller.signal });
    return {
      name: target.name,
      url,
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return { name: target.name, url, ok: false, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all(config.targets.map(checkTarget));
const failed = results.filter((result) => !result.ok && !result.skipped);

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));

if (failed.length > 0) {
  process.exitCode = 1;
}

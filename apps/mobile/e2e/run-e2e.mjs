// Cross-platform E2E runner: boots the mock API server, waits for it to become
// healthy, runs the Maestro suite, then tears the server down. Works on macOS
// and Windows with no extra dependencies (uses Node built-ins + `tsx` for the
// TypeScript server, and the `maestro` CLI on PATH).
//
// Usage: pnpm -F @meal-planner/mobile e2e
//   PORT=4010                 mock server port (default 4010)
//   MAESTRO_FLOWS=e2e/maestro flows dir/file passed to `maestro test`

import { spawn } from 'node:child_process';
import { get } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = join(here, 'mock-server', 'server.ts');
const port = process.env.PORT ?? '4010';
const flows = process.env.MAESTRO_FLOWS ?? 'e2e/maestro';

function log(msg) {
  console.log(`[e2e] ${msg}`);
}

// Start the mock server through tsx (`node --import tsx server.ts`).
const server = spawn(process.execPath, ['--import', 'tsx', serverEntry], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port },
});

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!server.killed) server.kill();
  process.exit(code);
}

server.on('exit', (code) => {
  if (!shuttingDown) {
    log(`mock server exited early (code ${code ?? 'null'})`);
    process.exit(code ?? 1);
  }
});

function waitForHealth(attempt = 0) {
  const max = 50;
  get(`http://localhost:${port}/__e2e/health`, (res) => {
    res.resume();
    if (res.statusCode === 200) {
      log(`mock server healthy on :${port}`);
      runMaestro();
    } else {
      retry(attempt);
    }
  }).on('error', () => retry(attempt));

  function retry(n) {
    if (n >= max) {
      log('mock server did not become healthy in time');
      shutdown(1);
      return;
    }
    setTimeout(() => waitForHealth(n + 1), 200);
  }
}

function runMaestro() {
  log(`running: maestro test ${flows}`);
  // shell:true so the `maestro` / `maestro.cmd` shim resolves on Windows too.
  const maestro = spawn(`maestro test ${flows}`, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, MOCK_URL: `http://localhost:${port}` },
  });
  maestro.on('exit', (code) => {
    log(`maestro finished (code ${code ?? 'null'})`);
    shutdown(code ?? 0);
  });
  maestro.on('error', (err) => {
    log(`failed to launch maestro: ${err.message}`);
    shutdown(1);
  });
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

waitForHealth();

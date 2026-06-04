/**
 * Dev orchestrator — one command to bring up the whole local stack:
 *   1. cloudflared quick tunnel → public HTTPS URL for the web app
 *   2. turbo dev (Next.js web only — the grammY bot is dormant and excluded
 *      from the fan-out), with NEXT_PUBLIC_APP_URL set to the tunnel URL so the
 *      web app builds reachable public links/buttons
 *   3. Inngest Dev Server, pointed at the app's /api/inngest endpoint so
 *      background functions (plan.generate, shopping.generate, …) actually run
 *
 * Why the tunnel: the web app (and its mobile/push integrations) must be served
 * over a public HTTPS origin; localhost is unreachable from a phone. The quick
 * tunnel needs no Cloudflare account and produces a fresh
 * https://<random>.trycloudflare.com URL each run.
 *
 * Why Inngest is pointed at localhost (not the tunnel): the Dev Server runs on
 * your machine and reaches the Next.js app directly over localhost.
 *
 * Usage:  pnpm dev:tunnel
 * Requires the `cloudflared` binary on PATH:
 *   Windows:  winget install --id Cloudflare.cloudflared
 *   macOS:    brew install cloudflared
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'

const WEB_PORT = process.env.WEB_PORT ?? '3000'
const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i

// Resolve the cloudflared binary: explicit override → winget's default install
// location on Windows (often not on PATH) → bare command (PATH / brew / Linux).
function resolveCloudflared(): string {
  if (process.env.CLOUDFLARED_PATH) return process.env.CLOUDFLARED_PATH
  if (process.platform === 'win32') {
    const wingetPath = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe'
    if (existsSync(wingetPath)) return wingetPath
  }
  return 'cloudflared'
}

function startTunnel(): Promise<{ url: string; proc: ChildProcess }> {
  return new Promise((resolvePromise, reject) => {
    // Absolute path (or bare exe) spawned without a shell — no arg escaping
    // issues and no DEP0190 deprecation warning.
    const proc = spawn(
      resolveCloudflared(),
      ['tunnel', '--url', `http://localhost:${WEB_PORT}`],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )

    let resolved = false
    const scan = (buf: Buffer): void => {
      const text = buf.toString()
      process.stderr.write(text)
      const match = URL_RE.exec(text)
      if (match && !resolved) {
        resolved = true
        resolvePromise({ url: match[0], proc })
      }
    }

    proc.stdout?.on('data', scan)
    proc.stderr?.on('data', scan)
    proc.on('error', (err) => {
      reject(
        new Error(
          `Could not start cloudflared (is it installed and on PATH?). ${err.message}`,
        ),
      )
    })
    proc.on('exit', (code) => {
      if (!resolved) reject(new Error(`cloudflared exited early (code ${code})`))
    })
  })
}

async function main(): Promise<void> {
  console.log('[dev-tunnel] starting cloudflared quick tunnel…')
  const { url, proc: tunnel } = await startTunnel()
  console.log(`\n[dev-tunnel] public URL → ${url}\n`)

  // turbo dev in stream mode (not the fullscreen TUI) so its logs coexist with
  // the Inngest Dev Server output in the same terminal. pnpm/npx are .cmd shims
  // on Windows, so they need a shell; passing one command string (no args array)
  // avoids the DEP0190 deprecation warning.
  const dev = spawn('pnpm exec turbo dev --filter=!@meal-planner/bot --ui=stream', {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NEXT_PUBLIC_APP_URL: url },
  })

  // Inngest Dev Server discovers and runs the app's functions. It retries the
  // -u endpoint, so it's fine to start before Next.js has finished booting.
  const inngest = spawn(
    `npx inngest-cli@latest dev -u http://localhost:${WEB_PORT}/api/inngest`,
    { stdio: 'inherit', shell: true },
  )

  const children: ChildProcess[] = [tunnel, dev, inngest]
  let shuttingDown = false
  const shutdown = (): void => {
    if (shuttingDown) return
    shuttingDown = true
    for (const child of children) child.kill()
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // If any process dies, tear the rest down so the terminal isn't left with
  // half a stack running.
  for (const child of children) {
    child.on('exit', (code) => {
      shutdown()
      process.exit(code ?? 0)
    })
  }
}

main().catch((err: unknown) => {
  console.error('[dev-tunnel]', err instanceof Error ? err.message : err)
  process.exit(1)
})

/**
 * Waits for the TypeScript compilation to produce the main entry file,
 * then launches Electron in development mode.
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ENTRY = path.join(__dirname, '..', 'dist', 'main', 'main', 'index.js')
const MAX_WAIT = 30000
const POLL_INTERVAL = 500

function waitForFile(filePath, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (fs.existsSync(filePath)) {
        resolve()
      } else if (Date.now() - start > timeout) {
        reject(new Error(`Timeout waiting for ${filePath}`))
      } else {
        setTimeout(check, POLL_INTERVAL)
      }
    }
    check()
  })
}

async function main() {
  console.log('[dev:electron] Waiting for main process compilation...')
  await waitForFile(ENTRY, MAX_WAIT)
  console.log('[dev:electron] Starting Electron...')

  const electron = require('electron')
  const child = spawn(electron, [ENTRY], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  })

  child.on('close', (code) => {
    process.exit(code)
  })
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})

const RESULTS_DIR = require('path').join(process.cwd(), 'analysis-results')
const fs = require('fs')

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
}

async function processJob(url) {
  console.log(`[Worker] Processing: ${url}`)

  try {
    const res = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }

    const data = await res.json()
    const report = data.report

    const filename = `${report.owner}-${report.repoName}-${Date.now()}.json`
    fs.writeFileSync(
      require('path').join(RESULTS_DIR, filename),
      JSON.stringify(report, null, 2)
    )

    console.log(`[Worker] Saved: ${filename}`)
  } catch (error) {
    console.error(`[Worker] Failed for ${url}:`, error.message)
  }
}

async function main() {
  const urls = process.argv.slice(2)

  if (urls.length === 0) {
    console.log('Usage: npm run worker -- <github-url1> <github-url2> ...')
    console.log('Example: npm run worker -- https://github.com/facebook/react')
    process.exit(1)
  }

  console.log(`[Worker] Starting analysis for ${urls.length} repository(ies)`)

  for (const url of urls) {
    await processJob(url)
  }

  console.log('[Worker] All analyses complete')
  process.exit(0)
}

main()

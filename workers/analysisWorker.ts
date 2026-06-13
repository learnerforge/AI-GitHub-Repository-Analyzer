import { fetchRepoInfo } from '../src/services/github'
import { analyzeRepository } from '../src/services/analyzer'
import * as fs from 'fs'
import * as path from 'path'

const RESULTS_DIR = path.join(process.cwd(), 'analysis-results')

interface AnalysisJob {
  url: string
  timestamp: number
}

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
}

async function processJob(job: AnalysisJob): Promise<void> {
  console.log(`[Worker] Processing: ${job.url}`)

  try {
    const repoInfo = await fetchRepoInfo(job.url)
    console.log(`[Worker] Fetched repo: ${repoInfo.owner}/${repoInfo.name}`)

    const report = await analyzeRepository(repoInfo)
    console.log(`[Worker] Analysis complete: ${report.id}`)

    const filename = `${report.owner}-${report.repoName}-${Date.now()}.json`
    fs.writeFileSync(
      path.join(RESULTS_DIR, filename),
      JSON.stringify(report, null, 2)
    )

    console.log(`[Worker] Report saved: ${filename}`)
  } catch (error: any) {
    console.error(`[Worker] Failed for ${job.url}:`, error.message)
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
    await processJob({ url, timestamp: Date.now() })
  }

  console.log('[Worker] All analyses complete')
  process.exit(0)
}

main()

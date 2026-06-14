import * as fs from 'fs'
import * as path from 'path'
import { EDGE_CASE_METAS, generateSyntheticReports, getStateKey } from './syntheticData'

const CHECKPOINT_DIR = path.join(process.cwd(), 'model-checkpoints')

interface QTable {
  qTable: Record<string, Record<string, number>>
  trainingMeta?: {
    bestValLoss: number
    stateCount: number
    avgQ: number
  }
}

function extractUnquantizedState(report: any): any {
  const sectionCoverage = report.docsQuality?.sectionCoverage || []
  return {
    repoStars: report.health?.stars || 0,
    repoForks: report.health?.forks || 0,
    fileCount: report.complexity?.fileCount || 0,
    languageCount: (report.techStack?.languages || []).length,
    readmeLength: report.docsQuality?.readmeLength || 0,
    contributorCount: report.health?.contributorCount || 0,
    hasTests: report.health?.hasTests || false,
    hasCI: report.health?.hasCI || false,
    readmeScore: report.docsQuality?.readmeScore || 0,
    docsSectionCount: sectionCoverage.filter((s: any) => s.present).length,
    hasApiDocs: report.docsQuality?.hasApiDocs || false,
    hasLicense: report.docsQuality?.hasLicense || false,
    lastCommitDays: report.health?.lastCommitDays ?? 30,
    hasDockerfile: report.health?.hasDockerfile || false,
    hasContributing: report.docsQuality?.hasContributing || false,
    headingCount: report.docsQuality?.headingCount ?? 0,
    codeBlockCount: report.docsQuality?.codeBlockCount ?? 0,
    imageCount: report.docsQuality?.imageCount ?? 0,
    badgeCount: report.docsQuality?.badgeCount ?? 0,
    emojiCount: report.docsQuality?.emojiCount ?? 0,
    tableCount: report.docsQuality?.tableCount ?? 0,
    checklistCount: report.docsQuality?.checklistCount ?? 0,
    linkCount: report.docsQuality?.linkCount ?? 0,
    todoCount: report.docsQuality?.todoCount ?? 0,
    fixmeCount: report.docsQuality?.fixmeCount ?? 0,
    hackCount: report.docsQuality?.hackCount ?? 0,
    tempCount: report.docsQuality?.tempCount ?? 0,
  }
}

function getBestAction(qValues: Record<string, Record<string, number>>, stateKey: string): { action: string; qValue: number } | null {
  const actions = qValues[stateKey]
  if (!actions || Object.keys(actions).length === 0) return null
  const sorted = Object.entries(actions).sort(([, a], [, b]) => b - a)
  return { action: sorted[0][0], qValue: sorted[0][1] }
}

function loadQTable(): QTable | null {
  const latestPath = path.join(CHECKPOINT_DIR, 'qtable-latest.json')
  const compactPath = path.join(CHECKPOINT_DIR, 'qtable-compact.json')

  let raw: string | null = null
  if (fs.existsSync(latestPath)) raw = fs.readFileSync(latestPath, 'utf-8')
  else if (fs.existsSync(compactPath)) raw = fs.readFileSync(compactPath, 'utf-8')

  if (!raw) return null
  return JSON.parse(raw) as QTable
}

function passesCheck(
  bestAction: string | null,
  ideal: { paramName: string; delta: number } | null
): { pass: boolean; detail: string } {
  if (ideal === null) {
    return { pass: true, detail: 'No ideal adjustment expected (dataset edge case)' }
  }
  if (!bestAction) {
    return { pass: false, detail: `No action found in Q-table for this state` }
  }

  const [paramName, deltaStr] = bestAction.split(':')
  const delta = parseFloat(deltaStr)

  const matchesParam = paramName === ideal.paramName
  const sameDirection = (delta > 0 && ideal.delta > 0) || (delta < 0 && ideal.delta < 0) || (delta === 0 && ideal.delta === 0)

  if (matchesParam && sameDirection) {
    return { pass: true, detail: `Q-table recommends ${bestAction} (expected ${ideal.paramName}:${ideal.delta > 0 ? '+' : ''}${ideal.delta})` }
  }

  if (matchesParam) {
    return { pass: false, detail: `Same param ${paramName} but opposite direction: Q=${bestAction}, expected=${ideal.delta > 0 ? '+' : ''}${ideal.delta}` }
  }

  return { pass: false, detail: `Q-table recommends ${bestAction}, expected ${ideal.paramName}:${ideal.delta > 0 ? '+' : ''}${ideal.delta}` }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║     Edge Case Evaluation                         ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log()

  // 1. Load Q-table
  console.log('[1/3] Loading Q-table...')
  const model = loadQTable()
  if (!model) {
    console.log('  No Q-table found. Run compact training first.')
    process.exit(1)
  }
  const qValues = model.qTable
  console.log(`  States in Q-table: ${Object.keys(qValues).length}`)
  if (model.trainingMeta) {
    console.log(`  Training best val loss: ${model.trainingMeta.bestValLoss}`)
  }
  console.log()

  // 2. Load edge cases
  console.log('[2/3] Loading edge case definitions...')
  const reports = generateSyntheticReports()
  console.log(`  Edge cases: ${reports.length}`)
  console.log()

  // 3. Evaluate each edge case
  console.log('[3/3] Evaluating...')
  console.log()

  let passed = 0
  let failed = 0
  const results: { name: string; pass: boolean; detail: string; bestAction: string | null; stateKey: string }[] = []

  for (let i = 0; i < reports.length; i++) {
    const { report, file } = reports[i]
    const meta = EDGE_CASE_METAS.find(m => m.file === file)
    const state = extractUnquantizedState(report)
    const stateKey = getStateKey(state)
    const best = getBestAction(qValues, stateKey)
    const bestActionStr = best ? `${best.action} (Q=${best.qValue.toFixed(4)})` : 'none'

    const check = passesCheck(best?.action || null, meta?.idealWeightAdjustment || null)

    const pass = check.pass
    if (pass) passed++
    else failed++

    const icon = pass ? '✓' : '✗'
    console.log(`  ${icon} ${meta?.name || file}`)
    console.log(`      State key: ${stateKey}`)
    console.log(`      Best action: ${bestActionStr}`)
    console.log(`      Expected: ${meta?.idealWeightAdjustment ? `${meta.idealWeightAdjustment.paramName}:${meta.idealWeightAdjustment.delta > 0 ? '+' : ''}${meta.idealWeightAdjustment.delta}` : '(none — dataset edge case)'}`)
    if (!pass) console.log(`      Issue: ${check.detail}`)
    console.log()

    results.push({ name: meta?.name || file, pass, detail: check.detail, bestAction: bestActionStr, stateKey })
  }

  // Summary
  const total = passed + failed
  const pct = total > 0 ? Math.round(passed / total * 100) : 0
  console.log('╔══════════════════════════════════════════════════╗')
  console.log(`║  Summary: ${passed}/${total} passed (${pct}%)              ║`)
  console.log('╚══════════════════════════════════════════════════╝')

  if (failed > 0) {
    console.log()
    console.log('Failed edge cases:')
    for (const r of results.filter(r => !r.pass)) {
      console.log(`  ✗ ${r.name}`)
      console.log(`      ${r.detail}`)
    }
  }

  // Save evaluation report
  const reportPath = path.join(CHECKPOINT_DIR, 'edge-evaluation.json')
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    modelStates: Object.keys(qValues).length,
    results,
    summary: { passed, failed, total, passRate: pct },
  }, null, 2))
  console.log()
  console.log(`Evaluation report saved: ${reportPath}`)
}

main().catch(console.error)

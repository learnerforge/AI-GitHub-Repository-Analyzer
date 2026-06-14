import * as fs from 'fs'
import * as path from 'path'
import { computeQualityScores, ScorerParams, getDefaultParams } from '../src/models/qualityScorer'
import { RepoInfo } from '../src/types'
import { generateSyntheticExperiences } from './syntheticData'

const RESULTS_DIR = path.join(process.cwd(), 'analysis-results')
const DATA_DIR = path.join(process.cwd(), 'training-data')
const CHECKPOINT_DIR = path.join(process.cwd(), 'model-checkpoints')
const LOG_DIR = path.join(process.cwd(), 'training-logs')

const WEIGHT_DELTAS = [0.05, -0.05, 0.1, -0.1]

interface State {
  repoStars: number; repoForks: number; fileCount: number
  languageCount: number; readmeLength: number; contributorCount: number
  hasTests: boolean; hasCI: boolean
  readmeScore: number; docsSectionCount: number
  hasApiDocs: boolean; hasLicense: boolean
  lastCommitDays: number; hasDockerfile: boolean; hasContributing: boolean
  headingCount: number; codeBlockCount: number; imageCount: number
  badgeCount: number; emojiCount: number; tableCount: number
  checklistCount: number; linkCount: number; todoCount: number
  fixmeCount: number; hackCount: number; tempCount: number
}

interface Experience {
  state: State
  action: { paramName: string; delta: number }
  reward: number
  nextState: State
  timestamp: number
  weight?: number
}

function quantize(v: number, unit: number): number {
  return Math.round(v / unit)
}

function getStateKey(s: State): string {
  return [
    quantize(s.repoStars, 1000),
    quantize(s.repoForks, 100),
    quantize(s.fileCount, 100),
    s.languageCount,
    quantize(s.readmeLength, 1000),
    quantize(s.contributorCount, 5),
    s.hasTests ? 1 : 0,
    s.hasCI ? 1 : 0,
    quantize(s.readmeScore, 20),
    s.docsSectionCount,
    s.hasApiDocs ? 1 : 0,
    s.hasLicense ? 1 : 0,
    quantize(s.lastCommitDays, 90),
    s.hasDockerfile ? 1 : 0,
    s.hasContributing ? 1 : 0,
    s.headingCount === 0 ? 0 : s.headingCount <= 3 ? 1 : s.headingCount <= 10 ? 2 : 3,
    s.codeBlockCount === 0 ? 0 : s.codeBlockCount <= 3 ? 1 : s.codeBlockCount <= 10 ? 2 : 3,
    s.imageCount === 0 ? 0 : s.imageCount <= 3 ? 1 : 2,
    s.badgeCount === 0 ? 0 : s.badgeCount <= 3 ? 1 : 2,
    s.emojiCount === 0 ? 0 : s.emojiCount <= 5 ? 1 : 2,
    s.tableCount === 0 ? 0 : s.tableCount <= 3 ? 1 : 2,
    s.checklistCount === 0 ? 0 : s.checklistCount <= 3 ? 1 : 2,
    s.linkCount === 0 ? 0 : s.linkCount <= 5 ? 1 : s.linkCount <= 20 ? 2 : 3,
    s.todoCount === 0 ? 0 : s.todoCount <= 5 ? 1 : 2,
    s.fixmeCount === 0 ? 0 : s.fixmeCount <= 3 ? 1 : 2,
    s.hackCount === 0 ? 0 : 1,
    s.tempCount === 0 ? 0 : 1,
  ].join(':')
}

function getActionKey(a: { paramName: string; delta: number }): string {
  return `${a.paramName}:${a.delta > 0 ? '+' : ''}${a.delta}`
}

function extractState(report: any): State {
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
    docsSectionCount: (report.docsQuality?.sectionCoverage || []).filter((s: any) => s.present).length,
    hasApiDocs: report.docsQuality?.hasApiDocs || false,
    hasLicense: report.docsQuality?.hasLicense || false,
    lastCommitDays: report.health?.lastCommitDays ?? 30,
    hasDockerfile: report.health?.hasDockerfile || (report.fileTree ? checkFileTreeForDocker(report.fileTree) : false),
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

function checkFileTreeForDocker(tree: any[]): boolean {
  for (const node of tree) {
    if (node.type === 'blob' && ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'].includes(node.name)) return true
    if (node.children && checkFileTreeForDocker(node.children)) return true
  }
  return false
}

function reconstructRepoInfo(report: any, fileName: string): RepoInfo | null {
  try {
    const langMap: Record<string, number> = {}
    for (const lang of (report.techStack?.languages || [])) {
      langMap[lang.name] = lang.bytes || 1000
    }
    return {
      id: report.id || '', url: report.repoUrl || '',
      owner: report.owner || '', name: report.repoName || fileName,
      description: '', defaultBranch: 'main',
      stars: report.health?.stars || 0,
      forks: report.health?.forks || 0,
      openIssues: report.health?.openIssues || 0,
      watchers: 0, topics: [], license: null,
      createdAt: '', updatedAt: '', pushedAt: '', size: 0,
      languages: langMap, contributors: [],
      readmeContent: '',
      fileTree: report.fileTree || [],
      dependencyFiles: report.complexity?.dependencyFiles || {},
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Data Quality
// ---------------------------------------------------------------------------
function validateReport(report: any, fileName: string): string[] {
  const issues: string[] = []
  if (!report.health || typeof report.health.stars !== 'number') issues.push('health.stars missing')
  if (!report.complexity || typeof report.complexity.fileCount !== 'number') issues.push('complexity.fileCount missing')
  if (!report.docsQuality || typeof report.docsQuality.readmeLength !== 'number') issues.push('docsQuality.readmeLength missing')
  if (report.health && report.health.stars < 0) issues.push('negative stars')
  if (report.complexity && report.complexity.fileCount > 100000) issues.push('suspiciously high fileCount')
  if (report.complexity && report.complexity.fileCount <= 0) issues.push('zero fileCount')
  return issues
}

function validateExperience(exp: Experience): string[] {
  const issues: string[] = []
  for (const k of ['repoStars', 'repoForks', 'fileCount', 'languageCount', 'readmeLength', 'contributorCount', 'readmeScore'] as const) {
    if (exp.state[k] < 0) issues.push(`state.${k} negative`)
    if (exp.state.fileCount <= 0) issues.push('state.fileCount zero or negative')
    if (exp.state.languageCount < 1) issues.push('state.languageCount < 1')
  }
  if (exp.state.docsSectionCount < 0 || exp.state.docsSectionCount > 10) issues.push('state.docsSectionCount out of range')
  if (exp.reward < -1 || exp.reward > 1) issues.push('reward out of [-1, 1]')
  if (isNaN(exp.reward)) issues.push('reward is NaN')
  if (!Number.isFinite(exp.reward)) issues.push('reward is infinite')
  const validParams = ['codeQualityWeight', 'docsWeight', 'maintainabilityWeight', 'communityWeight', 'securityWeight']
  if (!validParams.includes(exp.action.paramName)) issues.push('unknown paramName')
  return issues
}

function computeReward(score: number, report: any, action: { paramName: string; delta: number }): number {
  const state = extractState(report)
  const base = (score - 50) / 50
  let bonus = 0
  if (action.paramName === 'communityWeight' && state.repoStars > 1000) bonus += 0.2
  if (action.paramName === 'docsWeight' && state.readmeScore > 60) bonus += 0.25
  if (action.paramName === 'docsWeight' && state.docsSectionCount >= 6) bonus += 0.15
  if (action.paramName === 'codeQualityWeight' && state.hasTests) bonus += 0.2
  if (action.paramName === 'securityWeight' && (state.hasCI || state.hasTests)) bonus += 0.15
  if (action.paramName === 'maintainabilityWeight' && state.fileCount < 100) bonus += 0.15
  if (action.delta > 0) bonus += 0.05
  else bonus -= 0.05
  return Math.max(-1, Math.min(1, base + bonus))
}

function computeQualityScore(report: any, params: ScorerParams): number {
  const repo = reconstructRepoInfo(report, '')
  if (!repo) return 50
  return computeQualityScores(repo, report.complexity, report.docsQuality, report.health, params).overall
}

// ---------------------------------------------------------------------------
// Dataset Splits & Loaders
// ---------------------------------------------------------------------------
function loadReports(): { report: any; file: string; issues: string[] }[] {
  if (!fs.existsSync(RESULTS_DIR)) return []

  const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'))
  const loaded: { report: any; file: string; issues: string[] }[] = []
  const seenUrls = new Set<string>()

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8')
      const report = JSON.parse(raw)
      const issues = validateReport(report, file)

      const repoUrl = (report.repoUrl || '').replace(/\.git$/, '').toLowerCase()
      if (repoUrl && seenUrls.has(repoUrl)) {
        issues.push('near-duplicate: same repo URL seen in another file')
      }
      if (repoUrl) seenUrls.add(repoUrl)

      loaded.push({ report, file, issues })
    } catch (e: any) {
      loaded.push({ report: null, file, issues: [`parse error: ${e.message}`] })
    }
  }
  return loaded
}

function computeClassWeight(report: any): number {
  const langs: string[] = (report.techStack?.languages || []).map((l: any) => l.name)
  const isRust = langs.includes('Rust')
  const isGo = langs.includes('Go')
  const isPython = langs.includes('Python')
  const isJS = langs.includes('JavaScript') || langs.includes('TypeScript')
  const langCount = langs.length

  // Under-represented tech gets higher weight (Python/Ruby/PHP/Java = rare in our dataset)
  if (langs.includes('Ruby') || langs.includes('PHP') || langs.includes('Java') || langs.includes('C#')) return 2.0
  if (langs.includes('Kotlin') || langs.includes('Swift') || langs.includes('Scala')) return 2.0
  if (langs.includes('C') || langs.includes('C++')) return 1.5
  if (langs.includes('Go')) return 1.5
  if (langs.includes('Python')) return 1.3
  // Monorepos and large projects often underrepresented
  if (langCount >= 4) return 1.5
  // Over-represented Rust CLIs get base weight
  if (isRust && langCount <= 3) return 0.7
  return 1.0
}

function generateExperiences(
  reports: { report: any; file: string; issues: string[] }[]
): { experiences: Experience[]; rejected: number; reasons: Record<string, number>; stateKeys: Set<string> } {
  const experiences: Experience[] = []
  let rejected = 0
  const reasons: Record<string, number> = {}
  const seenStateKeys = new Set<string>()
  const defaultParams = getDefaultParams()
  const paramNames = [
    'codeQualityWeight', 'docsWeight', 'maintainabilityWeight',
    'communityWeight', 'securityWeight',
  ] as const

  for (const { report, file } of reports) {
    if (!report) { rejected++; reasons['corrupt_report'] = (reasons['corrupt_report'] || 0) + 1; continue }

    const state = extractState(report)
    const stateKey = getStateKey(state)
    if (seenStateKeys.has(stateKey)) { rejected++; reasons['duplicate_state'] = (reasons['duplicate_state'] || 0) + 1; continue }
    seenStateKeys.add(stateKey)

    const baselineScore = computeQualityScore(report, defaultParams)

    for (const paramName of paramNames) {
      for (const delta of WEIGHT_DELTAS) {
        const trialParams: ScorerParams = { ...defaultParams }
        let newVal = (trialParams[paramName as keyof ScorerParams] as number) + delta
        newVal = Math.max(0, Math.min(1, newVal))
        ;(trialParams as any)[paramName] = newVal

        const trialScore = computeQualityScore(report, trialParams)
        const scoreDelta = trialScore - baselineScore
        if (Math.abs(scoreDelta) < 0.5) continue

        const reward = computeReward(trialScore, report, { paramName, delta })
        const nextState: State = { ...state }
        if (paramName === 'communityWeight') {
          nextState.repoStars = Math.max(0, state.repoStars + Math.round(delta * 1000))
          nextState.repoForks = Math.max(0, state.repoForks + Math.round(delta * 100))
        }

        const baseWeight = computeClassWeight(report)
        const confidence = report.analysisMethod?.confidence ?? 100
        const dataQualityWeight = 0.3 + 0.7 * (confidence / 100)
        const exp: Experience = { state, action: { paramName, delta }, reward: Math.round(reward * 1000) / 1000, nextState, timestamp: Date.now(), weight: baseWeight * dataQualityWeight }
        const expIssues = validateExperience(exp)
        if (expIssues.length > 0) {
          rejected++
          expIssues.forEach(iss => { reasons[iss] = (reasons[iss] || 0) + 1 })
          continue
        }
        experiences.push(exp)
      }
    }
  }
  return { experiences, rejected, reasons, stateKeys: seenStateKeys }
}

function splitDataset(experiences: Experience[], valRatio: number = 0.2): { train: Experience[]; val: Experience[] } {
  const stateKeys = [...new Set(experiences.map(e => getStateKey(e.state)))]
  const shuffled = [...experiences]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  if (stateKeys.length < 10) {
    // Leave-one-state-out cross-validation: hold out 20% of states
    const valStates = new Set(stateKeys.sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.floor(stateKeys.length * valRatio))))
    const train = shuffled.filter(e => !valStates.has(getStateKey(e.state)))
    const val = shuffled.filter(e => valStates.has(getStateKey(e.state)))
    if (val.length === 0) return { train: shuffled, val: [] }
    return { train, val }
  }

  const splitIdx = Math.floor(shuffled.length * (1 - valRatio))
  return { train: shuffled.slice(0, splitIdx), val: shuffled.slice(splitIdx) }
}

// ---------------------------------------------------------------------------
// Training with proper loss handling
// ---------------------------------------------------------------------------
interface TrainingRun {
  trainLoss: number[]
  valLoss: number[]
  epochs: number
  stoppedEarly: boolean
  stopReason: string
  bestValLoss: number
  bestEpoch: number
  converged: boolean
  overfittingGap: number
  finalLr: number
}

function train(
  trainSet: Experience[],
  valSet: Experience[],
  maxEpochs: number = 80,
  patience: number = 20,
  minDelta: number = 0.0001
): { qValues: Record<string, Record<string, number>>; run: TrainingRun } {
  const qValues: Record<string, Record<string, number>> = {}
  const trainLoss: number[] = []
  const valLoss: number[] = []
  let bestValLoss = Infinity
  let bestEpoch = 0
  let patienceCounter = 0
  let stoppedEarly = false
  let stopReason = 'completed'
  const initialLr = Math.min(0.08, 0.5 / Math.sqrt(Object.keys(qValues).length || 1))
  let lr = initialLr
  const df = 0.85
  const l2Lambda = 0.001
  const hasVal = valSet.length > 0

  for (let epoch = 0; epoch < maxEpochs; epoch++) {
    // Cosine LR decay
    const decayFactor = 0.5 * (1 + Math.cos((epoch / maxEpochs) * Math.PI))
    const currentLr = lr * Math.max(0.01, decayFactor)

    // Shuffle training set each epoch
    for (let i = trainSet.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [trainSet[i], trainSet[j]] = [trainSet[j], trainSet[i]]
    }

    // Train
    let totalTLoss = 0
    for (const exp of trainSet) {
      const sk = getStateKey(exp.state)
      const ak = getActionKey(exp.action)
      const nsk = getStateKey(exp.nextState)
      if (!qValues[sk]) qValues[sk] = {}
      const currentQ = qValues[sk][ak] || 0
      const maxNextQ = Object.values(qValues[nsk] || {}).reduce((max, v) => Math.max(max, v), 0)
      const targetQ = exp.reward + df * maxNextQ
      const tdError = targetQ - currentQ
      const l2Penalty = l2Lambda * currentQ
      const weight = exp.weight ?? 1.0
      qValues[sk][ak] = currentQ + currentLr * weight * (tdError - l2Penalty)
      totalTLoss += Math.abs(tdError) * weight
    }
    const avgTLoss = totalTLoss / trainSet.length
    trainLoss.push(avgTLoss)

    // Validation
    let avgVLoss = 0
    if (hasVal) {
      let totalVLoss = 0
      for (const exp of valSet) {
        const sk = getStateKey(exp.state)
        const ak = getActionKey(exp.action)
        const nsk = getStateKey(exp.nextState)
        const currentQ = qValues[sk]?.[ak] || 0
        const maxNextQ = Object.values(qValues[nsk] || {}).reduce((max, v) => Math.max(max, v), 0)
        const targetQ = exp.reward + df * maxNextQ
        totalVLoss += Math.abs(targetQ - currentQ)
      }
      avgVLoss = totalVLoss / valSet.length
    }
    valLoss.push(avgVLoss)

    // Loss monitoring
    if (hasVal && epoch > 2) {
      if (avgVLoss > valLoss[epoch - 1] * 3 && valLoss[epoch - 1] > 0.01) {
        stoppedEarly = true; stopReason = `divergence (val spike: ${valLoss[epoch - 1].toFixed(4)} -> ${avgVLoss.toFixed(4)})`; break
      }
    }

    // Convergence detection on training loss
    if (epoch >= 15) {
      const recent = trainLoss.slice(-10)
      const improvement = recent[0] - recent[recent.length - 1]
      if (improvement < minDelta) {
        stoppedEarly = true; stopReason = `converged (train loss plateaued at ${avgTLoss.toFixed(4)})`; break
      }
    }

    // Validation-based early stopping
    if (hasVal) {
      if (avgVLoss < bestValLoss - 0.001) { bestValLoss = avgVLoss; bestEpoch = epoch; patienceCounter = 0 }
      else { patienceCounter++; if (patienceCounter >= patience) { stoppedEarly = true; stopReason = `early stopping (val best ${bestValLoss.toFixed(4)} @ epoch ${bestEpoch + 1})`; break } }
    } else {
      if (epoch > 0 && avgTLoss < bestValLoss) { bestValLoss = avgTLoss; bestEpoch = epoch }
    }

    const logInterval = hasVal ? 10 : 5
    if (epoch % logInterval === 0 || epoch === maxEpochs - 1) {
      const msg = hasVal
        ? `  Epoch ${epoch + 1}/${maxEpochs} — lr: ${currentLr.toFixed(4)} — train: ${avgTLoss.toFixed(4)}, val: ${avgVLoss.toFixed(4)}`
        : `  Epoch ${epoch + 1}/${maxEpochs} — lr: ${currentLr.toFixed(4)} — loss: ${avgTLoss.toFixed(4)}`
      console.log(msg)
    }
  }

  const finalTrain = trainLoss[trainLoss.length - 1]
  const finalVal = valLoss[valLoss.length - 1]
  const gap = hasVal ? finalVal - finalTrain : 0

  return {
    qValues,
    run: {
      trainLoss,
      valLoss,
      epochs: trainLoss.length,
      stoppedEarly,
      stopReason,
      bestValLoss: hasVal ? bestValLoss : trainLoss[trainLoss.length - 1],
      bestEpoch,
      converged: stopReason.startsWith('converged'),
      overfittingGap: Math.round(gap * 10000) / 10000,
      finalLr: lr * Math.max(0.01, 0.5 * (1 + Math.cos(((trainLoss.length - 1) / maxEpochs) * Math.PI))),
    }
  }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------
function evaluate(qValues: Record<string, Record<string, number>>, experiences: Experience[]) {
  const stateCount = Object.keys(qValues).length
  let actionCount = 0
  let totalQ = 0
  let minQ = Infinity
  let maxQ = -Infinity
  for (const actions of Object.values(qValues)) {
    actionCount += Object.keys(actions).length
    for (const qv of Object.values(actions)) {
      totalQ += qv
      if (qv < minQ) minQ = qv
      if (qv > maxQ) maxQ = qv
    }
  }
  const avgQ = actionCount > 0 ? totalQ / actionCount : 0

  // State coverage analysis
  const repoStars: number[] = []
  const fileCounts: number[] = []
  for (const sk of Object.keys(qValues)) {
    const parts = sk.split(':')
    repoStars.push(parseInt(parts[0]) * 1000)
    fileCounts.push(parseInt(parts[2]) * 100)
  }

  // Best actions per state
  let topActions: Record<string, number> = {}
  for (const actions of Object.values(qValues)) {
    const sorted = Object.entries(actions).sort(([, a], [, b]) => b - a)
    if (sorted.length > 0) {
      topActions[sorted[0][0]] = (topActions[sorted[0][0]] || 0) + 1
    }
  }
  const rankedActions = Object.entries(topActions).sort(([, a], [, b]) => b - a)

  return {
    stateCount,
    actionCount,
    avgQ: Math.round(avgQ * 10000) / 10000,
    minQ: Math.round(minQ * 10000) / 10000,
    maxQ: Math.round(maxQ * 10000) / 10000,
    qValueStd: Math.round(Math.sqrt(Object.values(qValues).reduce((sum, acts) => {
      return sum + Object.values(acts).reduce((s, v) => s + (v - avgQ) ** 2, 0)
    }, 0) / actionCount) * 10000) / 10000,
    topActions: rankedActions.slice(0, 10),
    stateCoverage: {
      starRange: `${Math.min(...repoStars)}-${Math.max(...repoStars)}`,
      fileRange: `${Math.min(...fileCounts)}-${Math.max(...fileCounts)}`,
      count: stateCount,
    },
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function computeDatasetDiversity(reports: { report: any; file: string; issues: string[] }[]): Record<string, any> {
  const langCounts: Record<string, number> = {}
  const ages: number[] = []
  let uniqueOwners = new Set<string>()

  for (const { report } of reports) {
    if (!report) continue
    for (const lang of (report.techStack?.languages || [])) {
      langCounts[lang.name] = (langCounts[lang.name] || 0) + 1
    }
    if (report.generatedAt) ages.push((Date.now() - new Date(report.generatedAt).getTime()) / 86400000)
    if (report.owner) uniqueOwners.add(report.owner)
  }

  const sortedLangs = Object.entries(langCounts).sort(([, a], [, b]) => b - a)
  const entropy = sortedLangs.reduce((sum, [, count]) => {
    const p = count / reports.length
    return sum - p * Math.log2(p + 1e-10)
  }, 0)

  return {
    totalReports: reports.length,
    uniqueOwners: uniqueOwners.size,
    languageCount: sortedLangs.length,
    languageEntropy: Math.round(entropy * 1000) / 1000,
    topLanguages: sortedLangs.slice(0, 8).map(([name, count]) => ({ name, count, pct: Math.round(count / reports.length * 100) })),
    maxAgeDays: ages.length > 0 ? Math.round(Math.max(...ages)) : 0,
    medianAgeDays: ages.length > 0 ? Math.round(ages.sort((a, b) => a - b)[Math.floor(ages.length / 2)]) : 0,
    stateCount: 0,
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║     Compact RL Training Pipeline                  ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log()

  // 1. Load reports with validation
  console.log('[1/6] Loading reports...')
  const loaded = loadReports()
  const valid = loaded.filter(l => l.issues.length === 0)
  const corrupt = loaded.filter(l => l.issues.length > 0)
  console.log(`  Total files: ${loaded.length}`)
  console.log(`  Valid: ${valid.length}`)
  console.log(`  Corrupt: ${corrupt.length}`)
  if (corrupt.length > 0) {
    for (const c of corrupt) {
      console.log(`    - ${c.file}: ${c.issues.join(', ')}`)
    }
  }
  if (valid.length === 0) { console.log('  No valid reports. Exiting.'); process.exit(0) }

  // 2. Generate experiences with quality filtering
  console.log('[2/6] Generating experiences...')
  const { experiences, rejected, reasons, stateKeys } = generateExperiences(valid)
  console.log(`  Real experiences: ${experiences.length}`)
  console.log(`  Rejected: ${rejected}`)
  if (Object.keys(reasons).length > 0) {
    console.log('  Rejection reasons:')
    for (const [reason, count] of Object.entries(reasons).sort(([, a], [, b]) => b - a)) {
      console.log(`    ${reason}: ${count}`)
    }
  }

  // Add synthetic edge-case experiences
  console.log('  Generating synthetic edge-case experiences...')
  const { experiences: synthExperiences, added, skipped } = generateSyntheticExperiences(stateKeys)
  if (synthExperiences.length > 0) {
    experiences.push(...synthExperiences)
    console.log(`  Synthetic added: ${added}, skipped (dup): ${skipped}`)
  }
  console.log(`  Total experiences: ${experiences.length}`)

  if (experiences.length === 0) { console.log('  No experiences. Exiting.'); process.exit(0) }

  // 3. Train/Validation split
  console.log('[3/6] Splitting dataset...')
  const uniqueStates = [...new Set(experiences.map(e => getStateKey(e.state)))]
  const { train: trainSet, val: valSet } = splitDataset(experiences, 0.2)
  console.log(`  States: ${uniqueStates.length}`)
  console.log(`  Train: ${trainSet.length} (${Math.round(trainSet.length / experiences.length * 100)}%)`)
  console.log(`  Validation: ${valSet.length} (${Math.round(valSet.length / experiences.length * 100)}%)`)

  // 4. Train with loss monitoring
  console.log('[4/6] Training...')
  const { qValues, run } = train(trainSet, valSet, 80, 20)

  console.log()
  console.log(`  Stopped: ${run.stoppedEarly ? 'yes' : 'no (max epochs)'}`)
  console.log(`  Reason: ${run.stopReason}`)
  console.log(`  Epochs completed: ${run.epochs}`)
  console.log(`  Final training loss: ${run.trainLoss[run.trainLoss.length - 1].toFixed(4)}`)
  console.log(`  Final val loss: ${run.valLoss[run.valLoss.length - 1].toFixed(4)}`)
  console.log(`  Best val loss: ${run.bestValLoss.toFixed(4)} at epoch ${run.bestEpoch + 1}`)
  console.log(`  Final LR: ${run.finalLr.toFixed(4)}`)

  // Overfitting detection
  const finalTrainLoss = run.trainLoss[run.trainLoss.length - 1]
  const finalValLoss = run.valLoss[run.valLoss.length - 1]
  const gap = finalValLoss - finalTrainLoss
  if (gap > 0.3) { console.log(`  Overfitting: val-train gap = ${gap.toFixed(4)}`) }
  else if (gap > 0.15) { console.log(`  Mild overfitting: val-train gap = ${gap.toFixed(4)}`) }
  else { console.log(`  No overfitting: val-train gap = ${gap.toFixed(4)}`) }

  // 5. Evaluate
  console.log('[5/6] Evaluating...')
  const evalResult = evaluate(qValues, experiences)
  console.log(`  States: ${evalResult.stateCount}`)
  console.log(`  Actions: ${evalResult.actionCount}`)
  console.log(`  Q-value range: ${evalResult.minQ} to ${evalResult.maxQ} (avg: ${evalResult.avgQ}, std: ${evalResult.qValueStd})`)
  console.log(`  State coverage: ${evalResult.stateCoverage.starRange} stars, ${evalResult.stateCoverage.fileRange} files`)
  console.log(`  Top actions:`)
  for (const [action, count] of evalResult.topActions) {
    console.log(`    ${action}: ${count} states`)
  }

  // 6. Save model
  console.log('[6/6] Saving model...')
  if (!fs.existsSync(CHECKPOINT_DIR)) fs.mkdirSync(CHECKPOINT_DIR, { recursive: true })
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

  fs.writeFileSync(path.join(DATA_DIR, 'compact-training.json'), JSON.stringify(experiences, null, 2))

  const persisted = {
    qTable: qValues,
    experienceBuffer: [],
    trainingSteps: run.trainLoss.length * trainSet.length,
    version: 3,
    trainingMeta: {
      epochs: run.trainLoss.length,
      stoppedEarly: run.stoppedEarly,
      stopReason: run.stopReason,
      bestValLoss: run.bestValLoss,
      finalTrainLoss,
      finalValLoss,
      stateCount: evalResult.stateCount,
      avgQ: evalResult.avgQ,
      topActions: evalResult.topActions,
    },
    exportedAt: new Date().toISOString(),
  }
  fs.writeFileSync(path.join(CHECKPOINT_DIR, 'qtable-compact.json'), JSON.stringify(persisted, null, 2))
  fs.writeFileSync(path.join(CHECKPOINT_DIR, 'qtable-latest.json'), JSON.stringify(persisted, null, 2))

  const modelSize = JSON.stringify(persisted).length
  console.log(`  Model: ${modelSize < 100000 ? (modelSize / 1000).toFixed(1) + ' KB' : (modelSize / 1000000).toFixed(2) + ' MB'}`)

  const logEntry = {
    timestamp: new Date().toISOString(),
    data: { reports: valid.length, experiences: experiences.length, states: uniqueStates.length, trainSize: trainSet.length, valSize: valSet.length },
    diversity: computeDatasetDiversity(valid),
    training: {
      epochs: run.trainLoss.length,
      stoppedEarly: run.stoppedEarly,
      stopReason: run.stopReason,
      trainLossCurve: run.trainLoss,
      valLossCurve: run.valLoss,
      bestValLoss: run.bestValLoss,
      bestEpoch: run.bestEpoch,
      finalTrainLoss,
      overfittingGap: run.overfittingGap,
      converged: run.converged,
    },
    evaluation: evalResult,
    modelSize,
  }
  const logFile = path.join(LOG_DIR, `train-${Date.now()}.json`)
  fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2))
  console.log(`  Training log: ${logFile}`)

  console.log()
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  Training complete.                              ║')
  console.log(`║  ${run.stoppedEarly ? 'Early stop' : 'Max epochs'}: ${run.stopReason}`)
  console.log(`║  Best val loss: ${run.bestValLoss.toFixed(4)}`)
  console.log(`║  States: ${evalResult.stateCount}, Actions: ${evalResult.actionCount}`)
  console.log(`║  Avg Q: ${evalResult.avgQ}`)
  console.log('╚══════════════════════════════════════════════════╝')
}

main().catch(console.error)

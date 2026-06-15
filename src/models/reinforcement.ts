import { PARAM_DEFS, DEFAULT_PARAMS } from './qualityScorer'
import { saveQTable, saveExperienceBuffer, loadLatestQTable } from './persistence'

const LEARNING_RATE = 0.1
const DISCOUNT_FACTOR = 0.9
const EPSILON = 0.2
const AUTO_TRAIN_THRESHOLD = 50
const PERSIST_INTERVAL = 10
const MAX_BUFFER_SIZE = 2000
const MIN_TRAIN_BATCH = 32

const ALL_PARAMS_KEYS: string[] = PARAM_DEFS.map(p => p.name)

const PARAM_META: Record<string, { range: [number, number]; deltas: number[] }> = {}
for (const p of PARAM_DEFS) {
  PARAM_META[p.name] = { range: [p.min, p.max], deltas: p.deltas }
}

const POSSIBLE_ACTIONS: { paramName: string; delta: number }[] = []
for (const p of PARAM_DEFS) {
  for (const d of p.deltas) {
    POSSIBLE_ACTIONS.push({ paramName: p.name, delta: d })
  }
}

export interface State {
  repoStars: number
  repoForks: number
  fileCount: number
  languageCount: number
  readmeLength: number
  contributorCount: number
  hasTests: boolean
  hasCI: boolean
  readmeScore: number
  docsSectionCount: number
  hasApiDocs: boolean
  hasLicense: boolean
  lastCommitDays: number
  hasDockerfile: boolean
  hasContributing: boolean
  headingCount: number
  codeBlockCount: number
  imageCount: number
  badgeCount: number
  emojiCount: number
  tableCount: number
  checklistCount: number
  linkCount: number
  todoCount: number
  fixmeCount: number
  hackCount: number
  tempCount: number
}

export function computeReadmeMetrics(readme: string): Record<string, number> {
  if (!readme) {
    return {
      headingCount: 0, codeBlockCount: 0, imageCount: 0, badgeCount: 0,
      emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 0,
      todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0,
    }
  }
  const headingCount = (readme.match(/^## /gm) || []).length
  const codeBlockCount = ((readme.match(/```/g) || []).length) / 2
  const imageCount = (readme.match(/!\[.*?\]\(.*?\)/g) || []).length + (readme.match(/<img\s/gi) || []).length
  const badgeCount = (readme.match(/https?:\/\/img\.shields\.io\//g) || []).length + (readme.match(/https?:\/\/badge\./g) || []).length
  const emojiMatch = readme.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{FE00}-\u{FE0F}]/gu)
  const emojiCount = emojiMatch ? emojiMatch.length : 0
  const tableRows = readme.match(/^\|.+\|[\s]*$/gm) || []
  const tableCount = tableRows.length > 1 ? Math.max(1, Math.floor(tableRows.length / 5)) : 0
  const checklistCount = (readme.match(/-\s\[[ x]\]/gi) || []).length
  const linkCount = (readme.match(/\[.*?\]\(.*?\)/g) || []).length
  const lower = readme.toLowerCase()
  const todoCount = (lower.match(/todo|@todo/g) || []).length
  const fixmeCount = (lower.match(/fixme|@fix/g) || []).length
  const hackCount = (lower.match(/hack|@hack/g) || []).length
  const tempCount = (lower.match(/temp(orary)?|@temp/g) || []).length
  return {
    headingCount, codeBlockCount, imageCount, badgeCount, emojiCount,
    tableCount, checklistCount, linkCount, todoCount, fixmeCount, hackCount, tempCount,
  }
}

function quantizeState(state: Record<string, any>): string {
  const bins: Record<string, number> = {}
  bins.repoStars = state.repoStars < 10 ? 0 : state.repoStars < 100 ? 1 : state.repoStars < 1000 ? 2 : 3
  bins.repoForks = state.repoForks < 5 ? 0 : state.repoForks < 50 ? 1 : state.repoForks < 500 ? 2 : 3
  bins.fileCount = state.fileCount < 20 ? 0 : state.fileCount < 100 ? 1 : state.fileCount < 500 ? 2 : 3
  bins.languageCount = state.languageCount <= 2 ? 0 : state.languageCount <= 4 ? 1 : 2
  bins.readmeLength = state.readmeLength < 100 ? 0 : state.readmeLength < 500 ? 1 : state.readmeLength < 2000 ? 2 : 3
  bins.contributorCount = state.contributorCount <= 1 ? 0 : state.contributorCount <= 5 ? 1 : state.contributorCount <= 20 ? 2 : 3
  bins.hasTests = state.hasTests ? 1 : 0
  bins.hasCI = state.hasCI ? 1 : 0
  bins.readmeScore = state.readmeScore < 20 ? 0 : state.readmeScore < 40 ? 1 : state.readmeScore < 60 ? 2 : state.readmeScore < 80 ? 3 : 4
  bins.docsSectionCount = state.docsSectionCount === 0 ? 0 : state.docsSectionCount <= 3 ? 1 : state.docsSectionCount <= 6 ? 2 : 3
  bins.hasApiDocs = state.hasApiDocs ? 1 : 0
  bins.hasLicense = state.hasLicense ? 1 : 0
  bins.lastCommitDays = state.lastCommitDays < 30 ? 0 : state.lastCommitDays < 90 ? 1 : state.lastCommitDays < 365 ? 2 : 3
  bins.hasDockerfile = state.hasDockerfile ? 1 : 0
  bins.hasContributing = state.hasContributing ? 1 : 0
  bins.headingCount = state.headingCount === 0 ? 0 : state.headingCount <= 3 ? 1 : state.headingCount <= 10 ? 2 : 3
  bins.codeBlockCount = state.codeBlockCount === 0 ? 0 : state.codeBlockCount <= 3 ? 1 : state.codeBlockCount <= 10 ? 2 : 3
  bins.imageCount = state.imageCount === 0 ? 0 : state.imageCount <= 3 ? 1 : 2
  bins.badgeCount = state.badgeCount === 0 ? 0 : state.badgeCount <= 3 ? 1 : 2
  bins.emojiCount = state.emojiCount === 0 ? 0 : state.emojiCount <= 5 ? 1 : 2
  bins.tableCount = state.tableCount === 0 ? 0 : state.tableCount <= 3 ? 1 : 2
  bins.checklistCount = state.checklistCount === 0 ? 0 : state.checklistCount <= 3 ? 1 : 2
  bins.linkCount = state.linkCount === 0 ? 0 : state.linkCount <= 5 ? 1 : state.linkCount <= 20 ? 2 : 3
  bins.todoCount = state.todoCount === 0 ? 0 : state.todoCount <= 5 ? 1 : 2
  bins.fixmeCount = state.fixmeCount === 0 ? 0 : state.fixmeCount <= 3 ? 1 : 2
  bins.hackCount = state.hackCount === 0 ? 0 : 1
  bins.tempCount = state.tempCount === 0 ? 0 : 1
  return Object.values(bins).join(':')
}

function actionKey(action: { paramName: string; delta: number }): string {
  return `${action.paramName}:${action.delta >= 0 ? '+' : ''}${action.delta}`
}

function clampParam(name: string, value: number): number {
  const meta = PARAM_META[name]
  if (meta) {
    const [lo, hi] = meta.range
    return Math.max(lo, Math.min(hi, value))
  }
  return value
}

export function applyRuleBonuses(params: Record<string, number>, state: Record<string, any>, bonuses?: Record<string, number>): Record<string, number> {
  const b = {
    b_complexity: bonuses?.b_complexity ?? params.b_complexity ?? 10,
    b_readme: bonuses?.b_readme ?? params.b_readme ?? 10,
    b_activity: bonuses?.b_activity ?? params.b_activity ?? 5,
  }
  if (state.hasCI) b.b_complexity += 3
  if (state.hasTests) b.b_complexity += 2
  if ((state.fileCount || 0) > 500) b.b_complexity -= 3
  if ((state.readmeScore || 0) > 70) b.b_readme += 5
  if ((state.docsSectionCount || 0) >= 6) b.b_readme += 5
  if (state.hasApiDocs) b.b_readme += 3
  const lcd = state.lastCommitDays ?? 999
  if (lcd < 30) {
    b.b_activity += 5
  } else if (lcd < 90) {
    b.b_activity += 3
  }
  if ((state.contributorCount || 0) > 10) b.b_activity += 3
  const result = { ...params }
  result.b_complexity = clampParam('b_complexity', b.b_complexity)
  result.b_readme = clampParam('b_readme', b.b_readme)
  result.b_activity = clampParam('b_activity', b.b_activity)
  return result
}

export class ReinforcementLearner {
  qTable: Record<string, Record<string, number>> = {}
  experienceBuffer: any[] = []
  maxBufferSize = MAX_BUFFER_SIZE
  minBufferSize = MIN_TRAIN_BATCH
  trainingSteps = 0
  currentParams: Record<string, number> = { ...DEFAULT_PARAMS }
  persistCounter = 0
  totalRewards: number[] = []
  episodeRewards: number[] = []

  constructor(loadPersisted = true) {
    if (loadPersisted) {
      this.loadFromDisk()
    }
  }

  getStateKey(state: Record<string, any>): string {
    return quantizeState(state)
  }

  getQValue(stateKey: string, aKey: string): number {
    return this.qTable[stateKey]?.[aKey] ?? 0.0
  }

  setQValue(stateKey: string, aKey: string, value: number): void {
    if (!this.qTable[stateKey]) {
      this.qTable[stateKey] = {}
    }
    this.qTable[stateKey][aKey] = value
  }

  selectAction(state: Record<string, any>, epsilon = EPSILON): { paramName: string; delta: number } {
    const stateKey = this.getStateKey(state)
    if (Math.random() < epsilon) {
      return POSSIBLE_ACTIONS[Math.floor(Math.random() * POSSIBLE_ACTIONS.length)]
    }
    let bestAction = POSSIBLE_ACTIONS[0]
    let bestValue = -Infinity
    for (const action of POSSIBLE_ACTIONS) {
      const value = this.getQValue(stateKey, actionKey(action))
      if (value > bestValue) {
        bestValue = value
        bestAction = action
      }
    }
    return bestAction
  }

  applyAction(params: Record<string, number>, action: { paramName: string; delta: number }): Record<string, number> {
    const newParams = { ...params }
    const current = newParams[action.paramName] ?? 0
    newParams[action.paramName] = clampParam(action.paramName, current + action.delta)
    return newParams
  }

  storeExperience(state: Record<string, any>, action: { paramName: string; delta: number }, reward: number, nextState: Record<string, any>): void {
    this.experienceBuffer.push({
      state, action, reward,
      nextState, timestamp: Date.now(),
    })
    this.totalRewards.push(reward)
    this.episodeRewards.push(reward)
    if (this.experienceBuffer.length > this.maxBufferSize) {
      this.experienceBuffer = this.experienceBuffer.slice(-this.maxBufferSize)
    }
    if (this.totalRewards.length > 1000) {
      this.totalRewards = this.totalRewards.slice(-1000)
    }
    this.autoTrain()
    this.autoPersist()
  }

  computeReward(validationScore: number, errorRate = 0.0): number {
    const base = validationScore / 100.0
    const penalty = errorRate * 0.5
    return Math.max(-1.0, Math.min(1.0, base - penalty))
  }

  computeUserReward(rating: number): number {
    return Math.max(-1.0, Math.min(1.0, (rating - 3) / 2.0))
  }

  ingestUserFeedback(rating: number, state: Record<string, any>, action: { paramName: string; delta: number }, nextState?: Record<string, any>): void {
    const reward = this.computeUserReward(rating)
    this.storeExperience(state, action, reward, nextState || state)
  }

  train(batchSize = 64): { loss: number; episodes: number } {
    if (this.experienceBuffer.length < this.minBufferSize) {
      return { loss: 0.0, episodes: 0 }
    }
    const bs = Math.min(batchSize, this.experienceBuffer.length)
    const batch: any[] = []
    const shuffled = [...this.experienceBuffer]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    for (let i = 0; i < bs; i++) {
      batch.push(shuffled[i])
    }
    let totalLoss = 0.0
    for (const exp of batch) {
      const stateKey = this.getStateKey(exp.state)
      const aKey = actionKey(exp.action)
      const nextStateKey = this.getStateKey(exp.nextState)
      let maxNext = 0.0
      for (const a of POSSIBLE_ACTIONS) {
        const qv = this.getQValue(nextStateKey, actionKey(a))
        if (qv > maxNext) maxNext = qv
      }
      const currentQ = this.getQValue(stateKey, aKey)
      const tdTarget = exp.reward + DISCOUNT_FACTOR * maxNext
      const newQ = currentQ + LEARNING_RATE * (tdTarget - currentQ)
      this.setQValue(stateKey, aKey, newQ)
      totalLoss += (tdTarget - currentQ) ** 2
    }
    this.trainingSteps++
    return { loss: totalLoss / bs, episodes: batch.length }
  }

  trainMultiple(epochs: number, batchSize: number): { loss: number; episodes: number } {
    let totalLoss = 0.0
    let totalEpisodes = 0
    for (let i = 0; i < epochs; i++) {
      const result = this.train(batchSize)
      totalLoss += result.loss
      totalEpisodes += result.episodes
    }
    return { loss: totalLoss / (epochs || 1), episodes: totalEpisodes }
  }

  getOptimalParams(state: Record<string, any>): Record<string, number> {
    const stateKey = this.getStateKey(state)
    let bestAction = POSSIBLE_ACTIONS[0]
    let bestValue = -Infinity
    for (const action of POSSIBLE_ACTIONS) {
      const value = this.getQValue(stateKey, actionKey(action))
      if (value > bestValue) {
        bestValue = value
        bestAction = action
      }
    }
    return this.applyAction({ ...this.currentParams }, bestAction)
  }

  mergeWithDefaults(weightParams: Record<string, number>, state: Record<string, any>, bonuses?: Record<string, number>): Record<string, number> {
    return applyRuleBonuses(weightParams, state, bonuses)
  }

  getCurrentParams(): Record<string, number> {
    return { ...this.currentParams }
  }

  setCurrentParams(params: Record<string, number>): void {
    const out: Record<string, number> = {}
    for (const k of ALL_PARAMS_KEYS) {
      out[k] = clampParam(k, params[k] ?? this.currentParams[k] ?? DEFAULT_PARAMS[k] ?? 0)
    }
    this.currentParams = out
  }

  persist(label = 'latest'): void {
    const flatQ: Record<string, Record<string, number>> = {}
    for (const [sk, actions] of Object.entries(this.qTable)) {
      flatQ[sk] = { ...actions }
    }
    saveQTable(flatQ, this.trainingSteps, label)
    saveExperienceBuffer(this.experienceBuffer.slice(-100))
  }

  getStats(): Record<string, any> {
    const stateCount = Object.keys(this.qTable).length
    let actionCount = 0
    const qValues: number[] = []
    for (const actions of Object.values(this.qTable)) {
      actionCount += Object.keys(actions).length
      for (const v of Object.values(actions)) {
        qValues.push(v)
      }
    }
    return {
      states: stateCount,
      totalQValues: actionCount,
      minQ: qValues.length > 0 ? Math.min(...qValues) : 0,
      maxQ: qValues.length > 0 ? Math.max(...qValues) : 0,
      avgQ: qValues.length > 0 ? qValues.reduce((a, b) => a + b, 0) / qValues.length : 0,
      experiences: this.experienceBuffer.length,
      trainingSteps: this.trainingSteps,
    }
  }

  loadFromDisk(): void {
    try {
      const data = loadLatestQTable()
      if (data && data.qTable) {
        this.qTable = data.qTable
        this.trainingSteps = data.trainingSteps || 0
      }
    } catch {
    }
  }

  private autoTrain(): void {
    if (this.experienceBuffer.length >= AUTO_TRAIN_THRESHOLD) {
      this.train(Math.max(32, Math.min(128, Math.floor(this.experienceBuffer.length / 4))))
    }
  }

  private autoPersist(): void {
    this.persistCounter++
    if (this.persistCounter >= PERSIST_INTERVAL) {
      this.persistCounter = 0
      this.persist()
    }
  }
}

export const reinforcementLearner = new ReinforcementLearner()

import { ScorerParams, getDefaultParams } from './qualityScorer'
import { saveQTable, saveExperienceBuffer, loadLatestQTable, loadAllExperiences } from './persistence'

export interface ReadmeMetrics {
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

export function computeReadmeMetrics(readme: string): ReadmeMetrics {
  if (!readme) return { headingCount: 0, codeBlockCount: 0, imageCount: 0, badgeCount: 0, emojiCount: 0, tableCount: 0, checklistCount: 0, linkCount: 0, todoCount: 0, fixmeCount: 0, hackCount: 0, tempCount: 0 }

  const headingCount = readme.match(/^## /gm)?.length ?? 0
  const codeBlockCount = (readme.match(/```/g)?.length ?? 0) / 2
  const imageCount = (readme.match(/!\[.*?\]\(.*?\)/g)?.length ?? 0) + (readme.match(/<img\s/gi)?.length ?? 0)
  const badgeCount = (readme.match(/https?:\/\/img\.shields\.io\//g)?.length ?? 0) + (readme.match(/https?:\/\/badge\./g)?.length ?? 0)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{FE00}-\u{FE0F}]/gu
  const emojiCount = (readme.match(emojiRegex)?.length ?? 0)
  const tableCount = (readme.match(/^\|.+\|[\s]*$/gm)?.length ?? 0) > 1 ? Math.max(1, Math.floor((readme.match(/^\|.+\|[\s]*$/gm)?.length ?? 0) / 5)) : 0
  const checklistCount = (readme.match(/-\s\[[ x]\]/gi)?.length ?? 0)
  const linkCount = (readme.match(/\[.*?\]\(.*?\)/g)?.length ?? 0)
  const lower = readme.toLowerCase()
  const todoCount = (lower.match(/todo|@todo/g)?.length ?? 0)
  const fixmeCount = (lower.match(/fixme|@fix/g)?.length ?? 0)
  const hackCount = (lower.match(/hack|@hack/g)?.length ?? 0)
  const tempCount = (lower.match(/temp(orary)?|@temp/g)?.length ?? 0)

  return { headingCount, codeBlockCount, imageCount, badgeCount, emojiCount, tableCount, checklistCount, linkCount, todoCount, fixmeCount, hackCount, tempCount }
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

interface Action {
  paramName: keyof WeightParams
  delta: number
}

interface Experience {
  state: State
  action: Action
  reward: number
  nextState: State
  timestamp: number
}

const WEIGHT_PARAMS: (keyof WeightParams)[] = [
  'codeQualityWeight',
  'docsWeight',
  'maintainabilityWeight',
  'communityWeight',
  'securityWeight',
]

export interface WeightParams {
  codeQualityWeight: number
  docsWeight: number
  maintainabilityWeight: number
  communityWeight: number
  securityWeight: number
}

export interface RuleBonuses {
  complexityBonus: number
  readmeBonus: number
  activityBonus: number
}

export interface AdjustedScorerParams extends ScorerParams {
  activityBonus: number
}

function quantizeState(state: State): string {
  const bins = {
    repoStars: state.repoStars < 10 ? 0 : state.repoStars < 100 ? 1 : state.repoStars < 1000 ? 2 : 3,
    repoForks: state.repoForks < 5 ? 0 : state.repoForks < 50 ? 1 : state.repoForks < 500 ? 2 : 3,
    fileCount: state.fileCount < 20 ? 0 : state.fileCount < 100 ? 1 : state.fileCount < 500 ? 2 : 3,
    languageCount: state.languageCount <= 2 ? 0 : state.languageCount <= 4 ? 1 : 2,
    readmeLength: state.readmeLength < 100 ? 0 : state.readmeLength < 500 ? 1 : state.readmeLength < 2000 ? 2 : 3,
    contributorCount: state.contributorCount <= 1 ? 0 : state.contributorCount <= 5 ? 1 : state.contributorCount <= 20 ? 2 : 3,
    hasTests: state.hasTests ? 1 : 0,
    hasCI: state.hasCI ? 1 : 0,
    readmeScore: state.readmeScore < 20 ? 0 : state.readmeScore < 40 ? 1 : state.readmeScore < 60 ? 2 : state.readmeScore < 80 ? 3 : 4,
    docsSectionCount: state.docsSectionCount === 0 ? 0 : state.docsSectionCount <= 3 ? 1 : state.docsSectionCount <= 6 ? 2 : 3,
    hasApiDocs: state.hasApiDocs ? 1 : 0,
    hasLicense: state.hasLicense ? 1 : 0,
    lastCommitDays: state.lastCommitDays < 30 ? 0 : state.lastCommitDays < 90 ? 1 : state.lastCommitDays < 365 ? 2 : 3,
    hasDockerfile: state.hasDockerfile ? 1 : 0,
    hasContributing: state.hasContributing ? 1 : 0,
    headingCount: state.headingCount === 0 ? 0 : state.headingCount <= 3 ? 1 : state.headingCount <= 10 ? 2 : 3,
    codeBlockCount: state.codeBlockCount === 0 ? 0 : state.codeBlockCount <= 3 ? 1 : state.codeBlockCount <= 10 ? 2 : 3,
    imageCount: state.imageCount === 0 ? 0 : state.imageCount <= 3 ? 1 : 2,
    badgeCount: state.badgeCount === 0 ? 0 : state.badgeCount <= 3 ? 1 : 2,
    emojiCount: state.emojiCount === 0 ? 0 : state.emojiCount <= 5 ? 1 : 2,
    tableCount: state.tableCount === 0 ? 0 : state.tableCount <= 3 ? 1 : 2,
    checklistCount: state.checklistCount === 0 ? 0 : state.checklistCount <= 3 ? 1 : 2,
    linkCount: state.linkCount === 0 ? 0 : state.linkCount <= 5 ? 1 : state.linkCount <= 20 ? 2 : 3,
    todoCount: state.todoCount === 0 ? 0 : state.todoCount <= 5 ? 1 : 2,
    fixmeCount: state.fixmeCount === 0 ? 0 : state.fixmeCount <= 3 ? 1 : 2,
    hackCount: state.hackCount === 0 ? 0 : 1,
    tempCount: state.tempCount === 0 ? 0 : 1,
  }
  return Object.values(bins).join(':')
}

const POSSIBLE_ACTIONS: Action[] = [
  { paramName: 'codeQualityWeight', delta: 0.05 },
  { paramName: 'codeQualityWeight', delta: -0.05 },
  { paramName: 'docsWeight', delta: 0.05 },
  { paramName: 'docsWeight', delta: -0.05 },
  { paramName: 'maintainabilityWeight', delta: 0.05 },
  { paramName: 'maintainabilityWeight', delta: -0.05 },
  { paramName: 'communityWeight', delta: 0.05 },
  { paramName: 'communityWeight', delta: -0.05 },
  { paramName: 'securityWeight', delta: 0.05 },
  { paramName: 'securityWeight', delta: -0.05 },
]

const LEARNING_RATE = 0.1
const DISCOUNT_FACTOR = 0.9
const EPSILON = 0.2

const AUTO_TRAIN_THRESHOLD = 50
const PERSIST_INTERVAL = 10
const MAX_BUFFER_SIZE = 2000
const MIN_TRAIN_BATCH = 32

export function applyRuleBonuses(
  params: ScorerParams,
  state: State,
  bonuses?: Partial<RuleBonuses>
): AdjustedScorerParams {
  const b = {
    complexityBonus: bonuses?.complexityBonus ?? 10,
    readmeBonus: bonuses?.readmeBonus ?? 10,
    activityBonus: bonuses?.activityBonus ?? 5,
  }

  if (state.hasCI) b.complexityBonus += 3
  if (state.hasTests) b.complexityBonus += 2
  if (state.fileCount > 500) b.complexityBonus -= 3

  if (state.readmeScore > 70) b.readmeBonus += 5
  if (state.docsSectionCount >= 6) b.readmeBonus += 5
  if (state.hasApiDocs) b.readmeBonus += 3

  if (state.lastCommitDays < 30) b.activityBonus += 5
  else if (state.lastCommitDays < 90) b.activityBonus += 3
  else b.activityBonus += 0
  if (state.contributorCount > 10) b.activityBonus += 3

  return {
    ...params,
    complexityBonus: Math.max(0, Math.min(50, b.complexityBonus)),
    readmeBonus: Math.max(0, Math.min(50, b.readmeBonus)),
    activityBonus: Math.max(0, Math.min(50, b.activityBonus)),
  }
}

export class ReinforcementLearner {
  private qTable: Map<string, Map<string, number>> = new Map()
  private experienceBuffer: Experience[] = []
  private maxBufferSize = MAX_BUFFER_SIZE
  private minBufferSize = MIN_TRAIN_BATCH
  private trainingSteps = 0
  private currentParams: WeightParams = {
    codeQualityWeight: 0.25,
    docsWeight: 0.20,
    maintainabilityWeight: 0.20,
    communityWeight: 0.20,
    securityWeight: 0.15,
  }
  private persistCounter = 0
  private totalRewards: number[] = []
  private episodeRewards: number[] = []
  private lastPersistTime = Date.now()

  constructor(loadPersisted: boolean = true) {
    if (loadPersisted) {
      this.loadFromDisk()
    }
  }

  getStateKey(state: State): string {
    return quantizeState(state)
  }

  private getActionKey(action: Action): string {
    return `${action.paramName}:${action.delta > 0 ? '+' : ''}${action.delta}`
  }

  getQValue(stateKey: string, actionKey: string): number {
    const stateActions = this.qTable.get(stateKey)
    if (!stateActions) return 0
    return stateActions.get(actionKey) || 0
  }

  setQValue(stateKey: string, actionKey: string, value: number): void {
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map())
    }
    this.qTable.get(stateKey)!.set(actionKey, value)
  }

  selectAction(state: State, epsilon: number = EPSILON): Action {
    const stateKey = this.getStateKey(state)

    if (Math.random() < epsilon) {
      return POSSIBLE_ACTIONS[Math.floor(Math.random() * POSSIBLE_ACTIONS.length)]
    }

    let bestAction = POSSIBLE_ACTIONS[0]
    let bestValue = -Infinity

    for (const action of POSSIBLE_ACTIONS) {
      const actionKey = this.getActionKey(action)
      const value = this.getQValue(stateKey, actionKey)
      if (value > bestValue) {
        bestValue = value
        bestAction = action
      }
    }

    return bestAction
  }

  applyAction(params: WeightParams, action: Action): WeightParams {
    const newParams = { ...params }
    const current = newParams[action.paramName] as number
    newParams[action.paramName] = Math.max(0, Math.min(1, current + action.delta)) as any
    return newParams
  }

  storeExperience(
    state: State,
    action: Action,
    reward: number,
    nextState: State
  ): void {
    this.experienceBuffer.push({ state, action, reward, nextState, timestamp: Date.now() })
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

  computeReward(
    validationScore: number,
    componentHealth: { errorRate: number }
  ): number {
    const baseReward = validationScore / 100
    const errorPenalty = componentHealth.errorRate * 0.5
    return Math.max(-1, Math.min(1, baseReward - errorPenalty))
  }

  computeUserReward(rating: number): number {
    return Math.max(-1, Math.min(1, (rating - 3) / 2))
  }

  ingestUserFeedback(
    rating: number,
    state: State,
    action: Action,
    nextState?: State
  ): void {
    const reward = this.computeUserReward(rating)
    this.storeExperience(state, action, reward, nextState || state)
  }

  train(batchSize: number = 64): { loss: number; episodes: number } {
    if (this.experienceBuffer.length < this.minBufferSize) {
      return { loss: 0, episodes: 0 }
    }

    const batchSize_ = Math.min(batchSize, this.experienceBuffer.length)
    const batch: Experience[] = []
    const indices = new Set<number>()

    let attempts = 0
    while (batch.length < batchSize_ && attempts < this.experienceBuffer.length * 2) {
      const idx = Math.floor(Math.random() * this.experienceBuffer.length)
      if (!indices.has(idx)) {
        indices.add(idx)
        batch.push(this.experienceBuffer[idx])
      }
      attempts++
    }

    let totalLoss = 0

    for (const exp of batch) {
      const stateKey = this.getStateKey(exp.state)
      const actionKey = this.getActionKey(exp.action)
      const nextStateKey = this.getStateKey(exp.nextState)

      let maxNextQ = -Infinity
      for (const nextAction of POSSIBLE_ACTIONS) {
        const nextActionKey = this.getActionKey(nextAction)
        const nextQ = this.getQValue(nextStateKey, nextActionKey)
        if (nextQ > maxNextQ) maxNextQ = nextQ
      }
      if (maxNextQ === -Infinity) maxNextQ = 0

      const currentQ = this.getQValue(stateKey, actionKey)
      const targetQ = exp.reward + DISCOUNT_FACTOR * maxNextQ
      const newQ = currentQ + LEARNING_RATE * (targetQ - currentQ)

      this.setQValue(stateKey, actionKey, newQ)
      totalLoss += Math.abs(targetQ - currentQ)
      this.trainingSteps++
    }

    return {
      loss: totalLoss / Math.max(1, batch.length),
      episodes: batch.length,
    }
  }

  trainMultiple(iterations: number = 5, batchSize: number = 64): {
    totalLoss: number
    averageLoss: number
    totalEpisodes: number
  } {
    let totalLoss = 0
    let totalEpisodes = 0

    for (let i = 0; i < iterations; i++) {
      const result = this.train(batchSize)
      totalLoss += result.loss
      totalEpisodes += result.episodes
    }

    return {
      totalLoss,
      averageLoss: iterations > 0 ? totalLoss / iterations : 0,
      totalEpisodes,
    }
  }

  getOptimalParams(state: State): WeightParams {
    let bestParams = this.getDefaultWeights()
    let bestReward = -Infinity

    for (let step = 0; step < 5; step++) {
      let params = this.getDefaultWeights()
      let totalReward = 0
      const currentState = { ...state }

      for (let i = 0; i < 3; i++) {
        const action = this.selectAction(currentState, 0.1)
        params = this.applyAction(params, action)
        totalReward += this.getQValue(this.getStateKey(currentState), this.getActionKey(action))
      }

      if (totalReward > bestReward) {
        bestReward = totalReward
        bestParams = params
      }
    }

    this.currentParams = bestParams
    return bestParams
  }

  getCurrentParams(): WeightParams {
    return this.currentParams
  }

  getDefaultWeights(): WeightParams {
    return {
      codeQualityWeight: 0.25,
      docsWeight: 0.20,
      maintainabilityWeight: 0.20,
      communityWeight: 0.20,
      securityWeight: 0.15,
    }
  }

  mergeWithDefaults(
    weights: WeightParams,
    state: State,
    bonuses?: Partial<RuleBonuses>
  ): AdjustedScorerParams {
    const params: ScorerParams = {
      codeQualityWeight: weights.codeQualityWeight,
      docsWeight: weights.docsWeight,
      maintainabilityWeight: weights.maintainabilityWeight,
      communityWeight: weights.communityWeight,
      securityWeight: weights.securityWeight,
      complexityBonus: 10,
      readmeBonus: 10,
    }
    return applyRuleBonuses(params, state, bonuses)
  }

  getStats(): {
    trainingSteps: number
    bufferSize: number
    stateCount: number
    averageRecentReward: number
    persistCount: number
    uptime: number
  } {
    const recentRewards = this.episodeRewards.slice(-20)
    const avgReward = recentRewards.length > 0
      ? recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length
      : 0

    return {
      trainingSteps: this.trainingSteps,
      bufferSize: this.experienceBuffer.length,
      stateCount: this.qTable.size,
      averageRecentReward: Math.round(avgReward * 1000) / 1000,
      persistCount: this.persistCounter,
      uptime: Date.now() - this.lastPersistTime,
    }
  }

  exportQTable(): Record<string, Record<string, number>> {
    const export_: Record<string, Record<string, number>> = {}
    for (const [stateKey, actions] of this.qTable.entries()) {
      export_[stateKey] = Object.fromEntries(actions)
    }
    return export_
  }

  importQTable(data: Record<string, Record<string, number>>): void {
    if (!data || typeof data !== 'object') return
    for (const [stateKey, actions] of Object.entries(data)) {
      if (!actions || typeof actions !== 'object') continue
      const actionMap = new Map(Object.entries(actions))
      this.qTable.set(stateKey, actionMap)
    }
  }

  persist(): string {
    const qTable = this.exportQTable()
    const path = saveQTable(qTable, this.trainingSteps, 'latest')
    this.lastPersistTime = Date.now()
    return path
  }

  persistExperiences(): string {
    if (this.experienceBuffer.length === 0) return ''
    return saveExperienceBuffer(this.experienceBuffer.slice(-100))
  }

  loadFromDisk(): boolean {
    const data = loadLatestQTable()
    if (data) {
      this.importQTable(data.qTable)
      this.trainingSteps = data.trainingSteps
      return true
    }

    const historicalExperiences = loadAllExperiences()
    if (historicalExperiences.length > 0) {
      for (const exp of historicalExperiences) {
        const state = exp.state as State
        const action = exp.action as Action
        const nextState = exp.nextState as State
        this.storeExperience(state, action, exp.reward, nextState)
      }
      this.trainMultiple(10, 64)
    }

    return false
  }

  getRecentRewardTrend(): { improving: boolean; slope: number } {
    if (this.episodeRewards.length < 10) {
      return { improving: false, slope: 0 }
    }

    const recent = this.episodeRewards.slice(-50)
    const n = recent.length
    if (n < 2) return { improving: false, slope: 0 }

    const indices = Array.from({ length: n }, (_, i) => i)
    const meanX = (n - 1) / 2
    const meanY = recent.reduce((a, b) => a + b, 0) / n

    let numerator = 0
    let denominator = 0
    for (let i = 0; i < n; i++) {
      numerator += (i - meanX) * (recent[i] - meanY)
      denominator += (i - meanX) * (i - meanX)
    }

    const slope = denominator !== 0 ? numerator / denominator : 0
    return { improving: slope > 0, slope: Math.round(slope * 10000) / 10000 }
  }

  private autoTrain(): void {
    if (this.experienceBuffer.length >= AUTO_TRAIN_THRESHOLD) {
      const batchSize = Math.min(64, this.experienceBuffer.length)
      this.train(batchSize)
    }
  }

  private autoPersist(): void {
    this.persistCounter++
    if (this.persistCounter % PERSIST_INTERVAL === 0) {
      this.persist()
    }
  }
}

export const reinforcementLearner = new ReinforcementLearner(true)

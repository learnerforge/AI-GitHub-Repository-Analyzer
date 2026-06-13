import { ScorerParams, getDefaultParams } from './qualityScorer'
import { saveQTable, saveExperienceBuffer, loadLatestQTable, loadAllExperiences } from './persistence'

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
}

interface Action {
  paramName: keyof ScorerParams
  delta: number
}

interface Experience {
  state: State
  action: Action
  reward: number
  nextState: State
  timestamp: number
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
  { paramName: 'complexityBonus', delta: 5 },
  { paramName: 'complexityBonus', delta: -5 },
  { paramName: 'readmeBonus', delta: 5 },
  { paramName: 'readmeBonus', delta: -5 },
]

const LEARNING_RATE = 0.1
const DISCOUNT_FACTOR = 0.9
const EPSILON = 0.2

const AUTO_TRAIN_THRESHOLD = 50
const PERSIST_INTERVAL = 10
const MAX_BUFFER_SIZE = 2000
const MIN_TRAIN_BATCH = 32

export class ReinforcementLearner {
  private qTable: Map<string, Map<string, number>> = new Map()
  private experienceBuffer: Experience[] = []
  private maxBufferSize = MAX_BUFFER_SIZE
  private minBufferSize = MIN_TRAIN_BATCH
  private trainingSteps = 0
  private currentParams: ScorerParams = getDefaultParams()
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

  applyAction(params: ScorerParams, action: Action): ScorerParams {
    const newParams = { ...params }
    const current = (newParams as any)[action.paramName] as number
    const isBonus = action.paramName === 'complexityBonus' || action.paramName === 'readmeBonus'
    ;(newParams as any)[action.paramName] = isBonus
      ? Math.max(0, Math.min(50, current + action.delta))
      : Math.max(0, Math.min(1, current + action.delta))
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
      this.experienceBuffer = this.experienceBuffer.slice(
        -this.maxBufferSize
      )
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

  getOptimalParams(state: State): ScorerParams {
    let bestParams = getDefaultParams()
    let bestReward = -Infinity

    for (let step = 0; step < 5; step++) {
      let params = getDefaultParams()
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

  getCurrentParams(): ScorerParams {
    return this.currentParams
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
        this.storeExperience(
          state,
          action,
          exp.reward,
          nextState
        )
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

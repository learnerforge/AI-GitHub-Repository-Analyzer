import { ScorerParams, getDefaultParams } from './qualityScorer'

export interface State {
  repoStars: number
  repoForks: number
  fileCount: number
  languageCount: number
  readmeLength: number
  contributorCount: number
  hasTests: boolean
  hasCI: boolean
}

export interface Action {
  paramName: keyof ScorerParams
  delta: number
}

export interface Experience {
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

export class ReinforcementLearner {
  private qTable: Map<string, Map<string, number>> = new Map()
  private experienceBuffer: Experience[] = []
  private maxBufferSize = 1000
  private minBufferSize = 32
  private trainingSteps = 0
  private currentParams: ScorerParams = getDefaultParams()

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
    ;(newParams as any)[action.paramName] = Math.max(0, Math.min(1, current + action.delta))
    return newParams
  }

  storeExperience(
    state: State,
    action: Action,
    reward: number,
    nextState: State
  ): void {
    this.experienceBuffer.push({ state, action, reward, nextState, timestamp: Date.now() })
    if (this.experienceBuffer.length > this.maxBufferSize) {
      this.experienceBuffer.shift()
    }
  }

  computeReward(
    validationScore: number,
    componentHealth: { errorRate: number }
  ): number {
    const baseReward = validationScore / 100
    const errorPenalty = componentHealth.errorRate * 0.5
    return Math.max(-1, Math.min(1, baseReward - errorPenalty))
  }

  train(batchSize: number = 32): { loss: number; episodes: number } {
    if (this.experienceBuffer.length < this.minBufferSize) {
      return { loss: 0, episodes: 0 }
    }

    const batchSize_ = Math.min(batchSize, this.experienceBuffer.length)
    const batch: Experience[] = []
    const indices = new Set<number>()

    while (batch.length < batchSize_) {
      const idx = Math.floor(Math.random() * this.experienceBuffer.length)
      if (!indices.has(idx)) {
        indices.add(idx)
        batch.push(this.experienceBuffer[idx])
      }
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
      loss: totalLoss / batchSize_,
      episodes: batchSize_,
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
  } {
    return {
      trainingSteps: this.trainingSteps,
      bufferSize: this.experienceBuffer.length,
      stateCount: this.qTable.size,
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
    for (const [stateKey, actions] of Object.entries(data)) {
      const actionMap = new Map(Object.entries(actions))
      this.qTable.set(stateKey, actionMap)
    }
  }
}

export const reinforcementLearner = new ReinforcementLearner()

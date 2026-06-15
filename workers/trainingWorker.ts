import * as fs from 'fs'
import * as path from 'path'

const TRAINING_DATA_DIR = path.join(process.cwd(), 'data', 'training')
const MODEL_EXPORT_DIR = path.join(process.cwd(), 'data', 'checkpoints')

interface TrainingExample {
  state: {
    repoStars: number
    repoForks: number
    fileCount: number
    languageCount: number
    readmeLength: number
    contributorCount: number
    hasTests: boolean
    hasCI: boolean
  }
  action: {
    paramName: string
    delta: number
  }
  reward: number
  nextState?: {
    repoStars: number
    repoForks: number
    fileCount: number
    languageCount: number
    readmeLength: number
    contributorCount: number
    hasTests: boolean
    hasCI: boolean
  }
  timestamp: number
}

async function loadTrainingData(): Promise<TrainingExample[]> {
  if (!fs.existsSync(TRAINING_DATA_DIR)) {
    console.log('[Training] No training data directory found')
    return []
  }

  const files = fs.readdirSync(TRAINING_DATA_DIR).filter(f => f.endsWith('.json'))
  const examples: TrainingExample[] = []

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(TRAINING_DATA_DIR, file), 'utf-8'))
      if (Array.isArray(data)) {
        examples.push(...data)
      }
    } catch (err) {
      console.error(`[Training] Error loading ${file}:`, err)
    }
  }

  return examples
}

async function trainModel(): Promise<void> {
  console.log('[Training] Starting model training...')
  console.log('[Training] =========================')

  if (!fs.existsSync(MODEL_EXPORT_DIR)) {
    fs.mkdirSync(MODEL_EXPORT_DIR, { recursive: true })
  }

  const examples = await loadTrainingData()
  console.log(`[Training] Loaded ${examples.length} training examples`)

  if (examples.length === 0) {
    console.log('[Training] No training data available. Run analyses first to generate data.')
    console.log('[Training] Training data is collected automatically when the application runs.')
    return
  }

  const stateSpace = new Set<string>()
  const actionSpace = new Set<string>()
  const qValues: Record<string, Record<string, number>> = {}

  const lr = 0.15
  const df = 0.85

  for (let epoch = 0; epoch < 10; epoch++) {
    for (const ex of examples) {
      const stateKey = Object.values(ex.state).join(':')
      const actionKey = `${ex.action.paramName}:${ex.action.delta > 0 ? '+' : ''}${ex.action.delta}`
      const nextStateKey = ex.nextState ? Object.values(ex.nextState).join(':') : stateKey

      stateSpace.add(stateKey)
      actionSpace.add(actionKey)

      if (!qValues[stateKey]) qValues[stateKey] = {}

      const current = qValues[stateKey][actionKey] || 0
      const maxNextQ = Object.values(qValues[nextStateKey] || {}).reduce((max, v) => Math.max(max, v), 0)
      qValues[stateKey][actionKey] = current + lr * (ex.reward + df * maxNextQ - current)
    }
  }

  console.log(`[Training] States discovered: ${stateSpace.size}`)
  console.log(`[Training] Actions available: ${actionSpace.size}`)

  const persisted = {
    qTable: qValues,
    experienceBuffer: [],
    trainingSteps: stateSpace.size,
    version: 1,
    exportedAt: new Date().toISOString(),
  }

  const checkpointPath = path.join(MODEL_EXPORT_DIR, `qtable-${Date.now()}.json`)
  fs.writeFileSync(checkpointPath, JSON.stringify(persisted, null, 2))
  console.log(`[Training] Q-table checkpoint saved to: ${checkpointPath}`)

  const latestPath = path.join(MODEL_EXPORT_DIR, 'qtable-latest.json')
  fs.writeFileSync(latestPath, JSON.stringify(persisted, null, 2))
  console.log(`[Training] Latest Q-table updated: ${latestPath}`)

  const avgQ = Object.values(qValues).reduce((sum, actions) => {
    const actionValues = Object.values(actions)
    return sum + (actionValues.length > 0 ? actionValues.reduce((a, b) => a + b, 0) / actionValues.length : 0)
  }, 0) / Math.max(1, Object.keys(qValues).length)

  console.log(`[Training] =========================`)
  console.log(`[Training] Training complete!`)
  console.log(`[Training] Average Q-value: ${avgQ.toFixed(4)}`)
  console.log(`[Training] Model checkpoint: ${checkpointPath}`)
}

async function generateSyntheticData(count: number = 50): Promise<void> {
  console.log(`[Training] Generating ${count} synthetic training examples...`)

  const paramNames = [
    'codeQualityWeight', 'docsWeight', 'maintainabilityWeight',
    'communityWeight', 'securityWeight', 'complexityBonus', 'readmeBonus',
  ]
  const deltas = [0.05, -0.05, 0.1, -0.1, 5, -5, 10, -10]

  const examples: TrainingExample[] = []

  for (let i = 0; i < count; i++) {
    const state = {
      repoStars: Math.floor(Math.random() * 5000),
      repoForks: Math.floor(Math.random() * 500),
      fileCount: Math.floor(Math.random() * 500) + 1,
      languageCount: Math.floor(Math.random() * 8) + 1,
      readmeLength: Math.floor(Math.random() * 5000) + 50,
      contributorCount: Math.floor(Math.random() * 50),
      hasTests: Math.random() > 0.5,
      hasCI: Math.random() > 0.5,
    }
    const action = {
      paramName: paramNames[Math.floor(Math.random() * paramNames.length)],
      delta: deltas[Math.floor(Math.random() * deltas.length)],
    }
    let r = (Math.random() - 0.5) * 0.4
    if (action.delta > 0) r += 0.1
    else r -= 0.1
    if (action.paramName === 'communityWeight' && state.repoStars > 1000) r += 0.2
    if (action.paramName === 'docsWeight' && state.readmeLength > 1000) r += 0.2
    if (action.paramName === 'codeQualityWeight' && state.hasTests) r += 0.2
    if (action.paramName === 'securityWeight' && (state.hasTests || state.hasCI)) r += 0.15
    if (action.paramName === 'maintainabilityWeight' && state.fileCount < 100) r += 0.15
    const reward = Math.max(-1, Math.min(1, r))

    const nextState = { ...state }
    if (action.paramName === 'communityWeight') {
      nextState.repoStars = Math.max(0, state.repoStars + Math.round(action.delta * 1000))
      nextState.repoForks = Math.max(0, state.repoForks + Math.round(action.delta * 100))
    }

    const example: TrainingExample = {
      state,
      action,
      reward,
      nextState,
      timestamp: Date.now(),
    }

    examples.push(example)
  }

  if (!fs.existsSync(TRAINING_DATA_DIR)) {
    fs.mkdirSync(TRAINING_DATA_DIR, { recursive: true })
  }

  fs.writeFileSync(
    path.join(TRAINING_DATA_DIR, `synthetic-${Date.now()}.json`),
    JSON.stringify(examples, null, 2)
  )

  console.log(`[Training] Generated ${count} synthetic examples`)
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'train'

  switch (command) {
    case 'train':
      await trainModel()
      break

    case 'generate':
      const count = parseInt(args[1], 10) || 50
      await generateSyntheticData(count)
      break

    case 'train-with-synthetic':
      await generateSyntheticData(parseInt(args[1], 10) || 100)
      await trainModel()
      break

    default:
      console.log('Usage:')
      console.log('  npm run train -- train                  Train from collected data')
      console.log('  npm run train -- generate [N]           Generate N synthetic examples')
      console.log('  npm run train -- train-with-synthetic   Generate + train in one step')
      process.exit(1)
  }

  process.exit(0)
}

main()

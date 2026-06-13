import * as fs from 'fs'
import * as path from 'path'

const CHECKPOINT_DIR = path.join(process.cwd(), 'model-checkpoints')
const DATA_DIR = path.join(process.cwd(), 'training-data')

interface PersistedData {
  qTable: Record<string, Record<string, number>>
  experienceBuffer: {
    state: Record<string, number | boolean>
    action: { paramName: string; delta: number }
    reward: number
    nextState: Record<string, number | boolean>
    timestamp: number
  }[]
  trainingSteps: number
  version: number
  exportedAt: string
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function saveQTable(
  qTable: Record<string, Record<string, number>>,
  trainingSteps: number,
  label: string = 'latest'
): string {
  ensureDir(CHECKPOINT_DIR)

  const data: PersistedData = {
    qTable,
    experienceBuffer: [],
    trainingSteps,
    version: 1,
    exportedAt: new Date().toISOString(),
  }

  const filename = `qtable-${label}.json`
  const filepath = path.join(CHECKPOINT_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))

  const datedFilename = `qtable-${label}-${Date.now()}.json`
  fs.writeFileSync(
    path.join(CHECKPOINT_DIR, datedFilename),
    JSON.stringify(data, null, 2)
  )

  return filepath
}

export function loadLatestQTable(): PersistedData | null {
  ensureDir(CHECKPOINT_DIR)

  const files = fs.readdirSync(CHECKPOINT_DIR)
    .filter(f => f.startsWith('qtable-') && f.endsWith('.json'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(CHECKPOINT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)

  if (files.length === 0) return null

  const latest = files[0].name
  try {
    const raw = fs.readFileSync(path.join(CHECKPOINT_DIR, latest), 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed.qTable) return parsed as PersistedData
    return { qTable: parsed, experienceBuffer: [], trainingSteps: 0, version: 1, exportedAt: '' }
  } catch {
    return null
  }
}

export function listCheckpoints(): { label: string; timestamp: string; size: number }[] {
  ensureDir(CHECKPOINT_DIR)

  return fs.readdirSync(CHECKPOINT_DIR)
    .filter(f => f.startsWith('qtable-') && f.endsWith('.json'))
    .map(f => {
      const fp = path.join(CHECKPOINT_DIR, f)
      const stat = fs.statSync(fp)
      return {
        label: f.replace(/^qtable-/, '').replace(/\.json$/, ''),
        timestamp: stat.mtime.toISOString(),
        size: stat.size,
      }
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export function saveExperienceBuffer(
  experiences: any[],
  append: boolean = true
): string {
  ensureDir(DATA_DIR)

  const filename = `experiences-${Date.now()}.json`
  const filepath = path.join(DATA_DIR, filename)

  const data = experiences.map(exp => ({
    state: {
      repoStars: exp.state.repoStars,
      repoForks: exp.state.repoForks,
      fileCount: exp.state.fileCount,
      languageCount: exp.state.languageCount,
      readmeLength: exp.state.readmeLength,
      contributorCount: exp.state.contributorCount,
      hasTests: exp.state.hasTests,
      hasCI: exp.state.hasCI,
    },
    action: exp.action,
    reward: exp.reward,
    nextState: {
      repoStars: exp.nextState.repoStars,
      repoForks: exp.nextState.repoForks,
      fileCount: exp.nextState.fileCount,
      languageCount: exp.nextState.languageCount,
      readmeLength: exp.nextState.readmeLength,
      contributorCount: exp.nextState.contributorCount,
      hasTests: exp.nextState.hasTests,
      hasCI: exp.nextState.hasCI,
    },
    timestamp: exp.timestamp,
  }))

  if (append && fs.existsSync(filepath)) {
    const existing = JSON.parse(fs.readFileSync(filepath, 'utf-8'))
    data.push(...existing)
  }

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
  return filepath
}

export function loadAllExperiences(): any[] {
  ensureDir(DATA_DIR)

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('experiences-') && f.endsWith('.json'))

  const all: any[] = []
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')
      const data = JSON.parse(raw)
      if (Array.isArray(data)) all.push(...data)
    } catch {
    }
  }

  return all
}

export function getTrainingDataSize(): { files: number; experiences: number } {
  ensureDir(DATA_DIR)

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('experiences-') && f.endsWith('.json'))

  let totalExperiences = 0
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')
      const data = JSON.parse(raw)
      if (Array.isArray(data)) totalExperiences += data.length
    } catch {
    }
  }

  return { files: files.length, experiences: totalExperiences }
}

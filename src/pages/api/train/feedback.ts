import type { NextApiRequest, NextApiResponse } from 'next'
import * as fs from 'fs'
import * as path from 'path'

const FEEDBACK_DIR = path.join(process.cwd(), 'data', 'feedback')

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { repoUrl, rating, category } = req.body

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be a number between 1 and 5' })
  }

  ensureDir(FEEDBACK_DIR)

  const entry = {
    repoUrl: repoUrl || '',
    rating,
    category: category || 'unknown',
    timestamp: new Date().toISOString(),
  }

  const filepath = path.join(FEEDBACK_DIR, `feedback-${Date.now()}.json`)
  fs.writeFileSync(filepath, JSON.stringify(entry, null, 2))

  return res.status(200).json({ ok: true })
}

import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchRepoInfo } from '@/services/github'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Repository ID is required' })
  }

  const [owner, name] = id.split(':')
  if (!owner || !name) {
    return res.status(400).json({ error: 'Invalid repository ID format. Use owner:name' })
  }

  try {
    const repoInfo = await fetchRepoInfo(`https://github.com/${owner}/${name}`)
    return res.status(200).json({ repo: repoInfo })
  } catch (error: any) {
    const message = error.response?.data?.message || error.message || 'Failed to fetch repository'
    return res.status(500).json({ error: message })
  }
}

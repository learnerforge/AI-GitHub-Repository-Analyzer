import { AIAnalysisInput, AIAnalysisResult } from '@/types'
import { AIProvider } from './ai'

export class GroqProvider implements AIProvider {
  private client: any
  private model: string

  constructor() {
    const OpenAI = require('openai').default
    this.client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  }

  async analyze(input: AIAnalysisInput): Promise<AIAnalysisResult> {
    const prompt = this.buildPrompt(input)

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert codebase analyst. Analyze the GitHub repository data and return ONLY raw JSON matching this schema (no markdown, no code fences):
{
  "summary": "concise 2-3 paragraph summary",
  "techStack": { "languages": [{"name": "string", "percentage": number, "bytes": number}], "frameworks": ["string"], "databases": ["string"], "tools": ["string"], "infrastructure": ["string"] },
  "architecture": "description of project architecture and structure",
  "codeSmells": [{"severity": "critical|warning|info", "category": "string", "title": "string", "description": "string"}],
  "suggestions": ["string"],
  "onboardingGuide": "step-by-step guide for new contributors",
  "qualityScores": { "overall": 0-100, "codeQuality": 0-100, "documentation": 0-100, "maintainability": 0-100, "communityHealth": 0-100, "security": 0-100 }
}`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    })

    const text = response.choices[0]?.message?.content
    if (!text) throw new Error('No response from AI')

    const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim()
    return JSON.parse(cleaned) as AIAnalysisResult
  }

  private buildPrompt(input: AIAnalysisInput): string {
    return `Analyze this GitHub repository:

Repository Description: ${input.description || 'N/A'}
Topics: ${input.topics.join(', ') || 'N/A'}

## README Content (truncated):
${(input.readme || '').slice(0, 1500)}

## Languages:
${JSON.stringify(input.languages, null, 2)}

## Top-level files:
${JSON.stringify((input.fileTree || []).slice(0, 15).map((n: any) => ({ name: n.name, type: n.type, size: n.size })), null, 2)}

## Dependency Files Found:
${Object.keys(input.dependencyFiles).join(', ') || 'None detected'}

Return ONLY raw JSON (no markdown, no code fences, no extra text).`
  }
}

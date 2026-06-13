import { AIAnalysisInput, AIAnalysisResult } from '@/types'
import { LocalAIProvider } from '@/models'

export interface AIProvider {
  analyze(input: AIAnalysisInput): Promise<AIAnalysisResult>
}

export class OpenAIProvider implements AIProvider {
  private openai: any
  private model: string

  constructor() {
    const OpenAI = require('openai').default
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  }

  async analyze(input: AIAnalysisInput): Promise<AIAnalysisResult> {
    const prompt = this.buildPrompt(input)

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert codebase analyst. Analyze the provided GitHub repository data and return a JSON object with these exact fields:
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
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 3000,
    })

    const text = response.choices[0]?.message?.content
    if (!text) throw new Error('No response from AI')

    return JSON.parse(text) as AIAnalysisResult
  }

  private buildPrompt(input: AIAnalysisInput): string {
    return `Analyze this GitHub repository:

Repository Description: ${input.description || 'N/A'}
Topics: ${input.topics.join(', ') || 'N/A'}

## README Content:
${(input.readme || '').slice(0, 4000)}

## Languages (bytes per language):
${JSON.stringify(input.languages, null, 2)}

## File Tree:
${JSON.stringify(input.fileTree.slice(0, 100), null, 2)}

## Dependency Files Found:
${Object.keys(input.dependencyFiles).join(', ') || 'None detected'}

Provide a comprehensive analysis including tech stack detection, architecture overview, code quality assessment, documentation quality, and actionable suggestions.`
  }
}

export function createAIProvider(): AIProvider {
  const hasOpenAIKey = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here')

  if (hasOpenAIKey) {
    console.log('[AI] OpenAI API key detected — using OpenAI provider')
    return new OpenAIProvider()
  }

  console.log('[AI] No OpenAI API key — using local AI model (self-contained)')
  console.log('[AI] Local model features: TextRank summarization, rule-based tech detection,')
  console.log('[AI]   heuristic scoring, self-healing validation, RL-based parameter optimization')
  return new LocalAIProvider()
}

import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIAnalysisInput, AIAnalysisResult } from '@/types'
import { AIProvider } from './ai'

export class GeminiProvider implements AIProvider {
  private model: any
  private modelName: string

  constructor() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    this.model = genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 3000,
      },
    })
  }

  async analyze(input: AIAnalysisInput): Promise<AIAnalysisResult> {
    const prompt = this.buildPrompt(input)

    const result = await this.model.generateContent(prompt)
    const text = result.response.text()
    if (!text) throw new Error('No response from Gemini')

    return JSON.parse(text) as AIAnalysisResult
  }

  private buildPrompt(input: AIAnalysisInput): string {
    return `You are an expert codebase analyst. Analyze the provided GitHub repository data and return a JSON object with these exact fields:
{
  "summary": "concise 2-3 paragraph summary",
  "techStack": { "languages": [{"name": "string", "percentage": number, "bytes": number}], "frameworks": ["string"], "databases": ["string"], "tools": ["string"], "infrastructure": ["string"] },
  "architecture": "description of project architecture and structure",
  "codeSmells": [{"severity": "critical|warning|info", "category": "string", "title": "string", "description": "string"}],
  "suggestions": ["string"],
  "onboardingGuide": "step-by-step guide for new contributors",
  "qualityScores": { "overall": 0-100, "codeQuality": 0-100, "documentation": 0-100, "maintainability": 0-100, "communityHealth": 0-100, "security": 0-100 }
}

Analyze this GitHub repository:

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

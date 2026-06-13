interface TechnologyPattern {
  name: string
  category: 'language' | 'framework' | 'database' | 'tool' | 'infrastructure'
  patterns: string[]
  confidence: number
}

interface ArchitecturePattern {
  name: string
  indicators: string[]
  description: string
}

interface OnboardingTemplate {
  scenario: string
  sections: string[]
}

const techDatabase: TechnologyPattern[] = [
  { name: 'JavaScript', category: 'language', patterns: ['\\.js$', '\\.jsx$', 'package\\.json'], confidence: 95 },
  { name: 'TypeScript', category: 'language', patterns: ['\\.ts$', '\\.tsx$', 'tsconfig\\.json'], confidence: 95 },
  { name: 'Python', category: 'language', patterns: ['\\.py$', 'requirements\\.txt', 'setup\\.py', 'Pipfile'], confidence: 95 },
  { name: 'Java', category: 'language', patterns: ['\\.java$', 'pom\\.xml', 'build\\.gradle'], confidence: 90 },
  { name: 'Rust', category: 'language', patterns: ['\\.rs$', 'Cargo\\.toml'], confidence: 90 },
  { name: 'Go', category: 'language', patterns: ['\\.go$', 'go\\.mod'], confidence: 90 },
  { name: 'C++', category: 'language', patterns: ['\\.cpp$', '\\.hpp$', '\\.cc$', 'CMakeLists\\.txt'], confidence: 85 },
  { name: 'C', category: 'language', patterns: ['\\.c$', '\\.h$'], confidence: 85 },
  { name: 'Ruby', category: 'language', patterns: ['\\.rb$', 'Gemfile'], confidence: 85 },
  { name: 'PHP', category: 'language', patterns: ['\\.php$', 'composer\\.json'], confidence: 85 },
  { name: 'Swift', category: 'language', patterns: ['\\.swift$', 'Package\\.swift'], confidence: 85 },
  { name: 'Kotlin', category: 'language', patterns: ['\\.kt$', '\\.kts$'], confidence: 85 },
  { name: 'C#', category: 'language', patterns: ['\\.cs$', '\\.csproj$'], confidence: 85 },
  { name: 'Scala', category: 'language', patterns: ['\\.scala$', 'build\\.sbt'], confidence: 80 },
  { name: 'Dart', category: 'language', patterns: ['\\.dart$', 'pubspec\\.yaml'], confidence: 80 },
  { name: 'R', category: 'language', patterns: ['\\.r$', '\\.R$'], confidence: 80 },
  { name: 'Shell', category: 'language', patterns: ['\\.sh$', '\\.bash$'], confidence: 80 },
  { name: 'HTML', category: 'language', patterns: ['\\.html$', '\\.htm$'], confidence: 75 },
  { name: 'CSS', category: 'language', patterns: ['\\.css$', '\\.scss$', '\\.less$'], confidence: 75 },
  { name: 'SQL', category: 'language', patterns: ['\\.sql$'], confidence: 70 },

  { name: 'React', category: 'framework', patterns: ['react', 'react-dom', 'create-react-app', 'next\\.config'], confidence: 90 },
  { name: 'Next.js', category: 'framework', patterns: ['next', 'next\\.config\\.(js|ts)', 'create-next-app'], confidence: 90 },
  { name: 'Vue.js', category: 'framework', patterns: ['vue', '@vue/', 'vue\\.config\\.js'], confidence: 90 },
  { name: 'Angular', category: 'framework', patterns: ['@angular/', 'angular\\.json'], confidence: 90 },
  { name: 'Express.js', category: 'framework', patterns: ['express'], confidence: 85 },
  { name: 'Django', category: 'framework', patterns: ['django', 'settings\\.py', 'urls\\.py'], confidence: 85 },
  { name: 'Flask', category: 'framework', patterns: ['flask'], confidence: 85 },
  { name: 'Spring Boot', category: 'framework', patterns: ['spring-boot', 'application\\.properties', 'application\\.yml'], confidence: 85 },
  { name: 'Ruby on Rails', category: 'framework', patterns: ['rails', 'Gemfile', 'app/controllers', 'app/models'], confidence: 85 },
  { name: 'Laravel', category: 'framework', patterns: ['laravel', 'artisan'], confidence: 85 },
  { name: 'ASP.NET', category: 'framework', patterns: ['aspnet', '\\.cshtml$', 'Startup\\.cs'], confidence: 80 },
  { name: 'FastAPI', category: 'framework', patterns: ['fastapi'], confidence: 85 },
  { name: 'NestJS', category: 'framework', patterns: ['@nestjs/'], confidence: 85 },
  { name: 'Svelte', category: 'framework', patterns: ['svelte', 'sveltekit'], confidence: 85 },
  { name: 'Tailwind CSS', category: 'framework', patterns: ['tailwindcss', 'tailwind\\.config'], confidence: 85 },
  { name: 'Bootstrap', category: 'framework', patterns: ['bootstrap'], confidence: 80 },
  { name: 'Material UI', category: 'framework', patterns: ['@mui/', 'material-ui'], confidence: 80 },
  { name: 'PyTorch', category: 'framework', patterns: ['torch', 'pytorch'], confidence: 85 },
  { name: 'TensorFlow', category: 'framework', patterns: ['tensorflow', 'tf\\.'], confidence: 85 },
  { name: 'Jest', category: 'framework', patterns: ['jest', '\\-\\-coverage'], confidence: 80 },
  { name: 'Playwright', category: 'framework', patterns: ['playwright'], confidence: 80 },

  { name: 'PostgreSQL', category: 'database', patterns: ['postgres', 'pg\\b', 'psycopg2', 'pgvector'], confidence: 90 },
  { name: 'MongoDB', category: 'database', patterns: ['mongodb', 'mongoose', 'mongose'], confidence: 90 },
  { name: 'MySQL', category: 'database', patterns: ['mysql', 'mariadb'], confidence: 85 },
  { name: 'Redis', category: 'database', patterns: ['redis', 'ioredis'], confidence: 85 },
  { name: 'SQLite', category: 'database', patterns: ['sqlite', 'sqlite3', 'better-sqlite3'], confidence: 85 },
  { name: 'Elasticsearch', category: 'database', patterns: ['elasticsearch', '@elastic/'], confidence: 80 },
  { name: 'DynamoDB', category: 'database', patterns: ['dynamodb', 'dynamoose'], confidence: 80 },
  { name: 'Firebase', category: 'database', patterns: ['firebase', 'firestore'], confidence: 80 },
  { name: 'Prisma', category: 'database', patterns: ['prisma', '@prisma/'], confidence: 85 },
  { name: 'Drizzle', category: 'database', patterns: ['drizzle-orm'], confidence: 80 },

  { name: 'Docker', category: 'tool', patterns: ['Dockerfile', 'docker-compose\\.yml', '\\.dockerignore'], confidence: 95 },
  { name: 'GitHub Actions', category: 'tool', patterns: ['\\.github/workflows/'], confidence: 95 },
  { name: 'ESLint', category: 'tool', patterns: ['\\.eslintrc', 'eslint\\.config'], confidence: 85 },
  { name: 'Prettier', category: 'tool', patterns: ['\\.prettierrc', 'prettier\\.config'], confidence: 80 },
  { name: 'Webpack', category: 'tool', patterns: ['webpack\\.config', 'webpack'], confidence: 80 },
  { name: 'Vite', category: 'tool', patterns: ['vite\\.config', 'vite'], confidence: 85 },
  { name: 'Babel', category: 'tool', patterns: ['babel\\.config', '\\.babelrc', '@babel/'], confidence: 80 },
  { name: 'Jest', category: 'tool', patterns: ['jest\\.config'], confidence: 80 },
  { name: 'Mocha', category: 'tool', patterns: ['mocha'], confidence: 75 },
  { name: 'Cypress', category: 'tool', patterns: ['cypress'], confidence: 80 },
  { name: 'Git', category: 'tool', patterns: ['\\.git$', '\\.gitignore', '\\.gitmodules'], confidence: 95 },
  { name: 'npm', category: 'tool', patterns: ['package-lock\\.json', 'node_modules/'], confidence: 90 },
  { name: 'Yarn', category: 'tool', patterns: ['yarn\\.lock', '\\.yarnrc'], confidence: 85 },
  { name: 'pnpm', category: 'tool', patterns: ['pnpm-lock\\.yaml'], confidence: 85 },
  { name: 'Make', category: 'tool', patterns: ['Makefile'], confidence: 80 },

  { name: 'AWS', category: 'infrastructure', patterns: ['aws-', '@aws-sdk/', 'boto3', 'aws/'], confidence: 85 },
  { name: 'Google Cloud', category: 'infrastructure', patterns: ['@google-cloud/', 'gcloud', 'google-'], confidence: 80 },
  { name: 'Azure', category: 'infrastructure', patterns: ['azure-', '@azure/'], confidence: 80 },
  { name: 'Cloudflare', category: 'infrastructure', patterns: ['cloudflare', 'cf-workers'], confidence: 75 },
  { name: 'Nginx', category: 'infrastructure', patterns: ['nginx\\.conf', 'nginx/'], confidence: 80 },
  { name: 'Kubernetes', category: 'infrastructure', patterns: ['k8s', 'kubernetes', '\\.yaml$', 'deployment\\.'], confidence: 80 },
  { name: 'Terraform', category: 'infrastructure', patterns: ['\\.tf$', 'terraform'], confidence: 80 },
  { name: 'Vercel', category: 'infrastructure', patterns: ['vercel\\.json', 'vercel'], confidence: 75 },
]

const architecturePatterns: ArchitecturePattern[] = [
  {
    name: 'Monolithic',
    indicators: ['src/', 'app/', 'lib/', 'single package', 'no micro'],
    description: 'Single codebase deployed as one unit, typically organized in a flat structure.'
  },
  {
    name: 'Microservices',
    indicators: ['services/', 'micro', 'api-gateway', 'service-', 'docker-compose'],
    description: 'Multiple independent services communicating via APIs, each deployable separately.'
  },
  {
    name: 'Monorepo',
    indicators: ['packages/', 'apps/', 'pnpm-workspace', 'lerna', 'turborepo', 'nx\\.json', 'workspaces'],
    description: 'Multiple projects in a single repository with shared tooling and dependencies.'
  },
  {
    name: 'MVC (Model-View-Controller)',
    indicators: ['controllers/', 'models/', 'views/', 'routes/'],
    description: 'Separation into models (data), views (UI), and controllers (logic) layers.'
  },
  {
    name: 'Clean Architecture / Hexagonal',
    indicators: ['domain/', 'application/', 'infrastructure/', 'adapters/', 'ports/'],
    description: 'Onion-like layers with domain at center, infrastructure at edges.'
  },
  {
    name: 'JAMstack',
    indicators: ['netlify', 'gatsby', 'next\\.config', 'static', 'headless'],
    description: 'JavaScript, APIs, and pre-rendered Markup architecture for static sites.'
  },
  {
    name: 'Serverless',
    indicators: ['functions/', 'lambdas/', 'serverless\\.yml', 'fauna', 'supabase'],
    description: 'Event-driven architecture using cloud functions and managed services.'
  },
  {
    name: 'Event-Driven',
    indicators: ['events/', 'event', 'kafka', 'rabbitmq', 'pub/sub', 'message'],
    description: 'Components communicate through asynchronous events and message brokers.'
  },
  {
    name: 'Layered / N-Tier',
    indicators: ['presentation/', 'business/', 'data/', 'repository/', 'service/'],
    description: 'Traditional layered architecture with presentation, business logic, and data access.'
  },
  {
    name: 'Feature-Based',
    indicators: ['features/', 'modules/', 'components/'],
    description: 'Code organized by business features rather than technical layers.'
  },
]

const techKeywords: Record<string, string[]> = {
  react: ['react', 'jsx', 'component', 'hook', 'usestate', 'useeffect', 'redux'],
  angular: ['component', 'service', 'module', 'directive', 'injectable', '@angular'],
  vue: ['vue', 'component', 'template', 'v-bind', 'v-model', 'v-if', 'computed'],
  node: ['require', 'module.exports', 'process.env', 'express', 'http.create'],
  python: ['def ', 'import ', 'class ', 'if __name__', 'print('],
  django: ['urlpatterns', 'views.py', 'models.py', 'admin.py', 'migrations/'],
  rust: ['fn ', 'let mut', 'impl ', 'trait ', 'enum ', 'pub '],
  go: ['func ', 'package main', 'import (', 'defer ', 'goroutine'],
}

const onboardingTemplates: Record<string, OnboardingTemplate> = {
  standard: {
    scenario: 'default',
    sections: [
      '## Getting Started\n\nClone the repository:\n```bash\ngit clone {{REPO_URL}}\ncd {{REPO_NAME}}\n```',
      '## Prerequisites\n\nEnsure you have the following installed:\n- {{LANGUAGES_DISPLAY}}\n- Package manager for your platform',
      '## Installation\n\nInstall dependencies:\n```bash\n{{INSTALL_COMMAND}}\n```',
      '## Configuration\n\n1. Copy the example environment file:\n```bash\ncp .env.example .env\n```\n2. Fill in required configuration values',
      '## Running the Project\n\nStart the development server:\n```bash\n{{DEV_COMMAND}}\n```',
      '## Project Structure\n\nThe project follows a {{ARCHITECTURE}} architecture:\n{{STRUCTURE_HIGHLIGHTS}}',
      '## Available Scripts\n\n- `{{DEV_COMMAND}}` - Start development server\n- `{{BUILD_COMMAND}}` - Build for production\n- `{{TEST_COMMAND}}` - Run tests',
      '## How to Contribute\n\n1. Fork the repository\n2. Create a feature branch (`git checkout -b feature/amazing-feature`)\n3. Commit your changes (`git commit -m \'Add amazing feature\'`)\n4. Push to the branch (`git push origin feature/amazing-feature`)\n5. Open a Pull Request',
      '## Code Style\n\nThis project uses {{LINTER}} for code linting. Please ensure your code passes linting before submitting PRs.',
      '## Need Help?\n\n- Check existing issues for known problems\n- Review the API documentation if available\n- Open a new issue for questions or bugs',
    ],
  },
}

export function getTechDatabase(): TechnologyPattern[] {
  return techDatabase
}

export function getArchitecturePatterns(): ArchitecturePattern[] {
  return architecturePatterns
}

export function getTechKeywords(): Record<string, string[]> {
  return techKeywords
}

export function getOnboardingTemplate(scenario: string = 'default'): OnboardingTemplate {
  return onboardingTemplates[scenario] || onboardingTemplates.standard
}

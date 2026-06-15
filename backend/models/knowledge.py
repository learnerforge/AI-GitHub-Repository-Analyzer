from __future__ import annotations

TECH_DATABASE: list[dict] = [
    {'name': 'JavaScript', 'category': 'language', 'patterns': ['\\.js$', '\\.jsx$', 'package\\.json'], 'confidence': 95},
    {'name': 'TypeScript', 'category': 'language', 'patterns': ['\\.ts$', '\\.tsx$', 'tsconfig\\.json'], 'confidence': 95},
    {'name': 'Python', 'category': 'language', 'patterns': ['\\.py$', 'requirements\\.txt', 'setup\\.py', 'Pipfile'], 'confidence': 95},
    {'name': 'Java', 'category': 'language', 'patterns': ['\\.java$', 'pom\\.xml', 'build\\.gradle'], 'confidence': 90},
    {'name': 'Rust', 'category': 'language', 'patterns': ['\\.rs$', 'Cargo\\.toml'], 'confidence': 90},
    {'name': 'Go', 'category': 'language', 'patterns': ['\\.go$', 'go\\.mod'], 'confidence': 90},
    {'name': 'C++', 'category': 'language', 'patterns': ['\\.cpp$', '\\.hpp$', '\\.cc$', 'CMakeLists\\.txt'], 'confidence': 85},
    {'name': 'C', 'category': 'language', 'patterns': ['\\.c$', '\\.h$'], 'confidence': 85},
    {'name': 'Ruby', 'category': 'language', 'patterns': ['\\.rb$', 'Gemfile'], 'confidence': 85},
    {'name': 'PHP', 'category': 'language', 'patterns': ['\\.php$', 'composer\\.json'], 'confidence': 85},
    {'name': 'Swift', 'category': 'language', 'patterns': ['\\.swift$', 'Package\\.swift'], 'confidence': 85},
    {'name': 'Kotlin', 'category': 'language', 'patterns': ['\\.kt$', '\\.kts$'], 'confidence': 85},
    {'name': 'C#', 'category': 'language', 'patterns': ['\\.cs$', '\\.csproj$'], 'confidence': 85},
    {'name': 'Scala', 'category': 'language', 'patterns': ['\\.scala$', 'build\\.sbt'], 'confidence': 80},
    {'name': 'Dart', 'category': 'language', 'patterns': ['\\.dart$', 'pubspec\\.yaml'], 'confidence': 80},
    {'name': 'R', 'category': 'language', 'patterns': ['\\.r$', '\\.R$'], 'confidence': 80},
    {'name': 'Shell', 'category': 'language', 'patterns': ['\\.sh$', '\\.bash$'], 'confidence': 80},
    {'name': 'HTML', 'category': 'language', 'patterns': ['\\.html$', '\\.htm$'], 'confidence': 75},
    {'name': 'CSS', 'category': 'language', 'patterns': ['\\.css$', '\\.scss$', '\\.less$'], 'confidence': 75},
    {'name': 'SQL', 'category': 'language', 'patterns': ['\\.sql$'], 'confidence': 70},
    {'name': 'React', 'category': 'framework', 'patterns': ['react', 'react-dom', 'create-react-app', 'next\\.config'], 'confidence': 90},
    {'name': 'Next.js', 'category': 'framework', 'patterns': ['next', 'next\\.config\\.(js|ts)', 'create-next-app'], 'confidence': 90},
    {'name': 'Vue.js', 'category': 'framework', 'patterns': ['vue', '@vue/', 'vue\\.config\\.js'], 'confidence': 90},
    {'name': 'Angular', 'category': 'framework', 'patterns': ['@angular/', 'angular\\.json'], 'confidence': 90},
    {'name': 'Express.js', 'category': 'framework', 'patterns': ['express'], 'confidence': 85},
    {'name': 'Django', 'category': 'framework', 'patterns': ['django', 'settings\\.py', 'urls\\.py'], 'confidence': 85},
    {'name': 'Flask', 'category': 'framework', 'patterns': ['flask'], 'confidence': 85},
    {'name': 'Spring Boot', 'category': 'framework', 'patterns': ['spring-boot', 'application\\.properties'], 'confidence': 85},
    {'name': 'Ruby on Rails', 'category': 'framework', 'patterns': ['rails', 'Gemfile', 'app/controllers', 'app/models'], 'confidence': 85},
    {'name': 'Laravel', 'category': 'framework', 'patterns': ['laravel', 'artisan'], 'confidence': 85},
    {'name': 'ASP.NET', 'category': 'framework', 'patterns': ['aspnet', '\\.cshtml$', 'Startup\\.cs'], 'confidence': 80},
    {'name': 'FastAPI', 'category': 'framework', 'patterns': ['fastapi'], 'confidence': 85},
    {'name': 'NestJS', 'category': 'framework', 'patterns': ['@nestjs/'], 'confidence': 85},
    {'name': 'Svelte', 'category': 'framework', 'patterns': ['svelte', 'sveltekit'], 'confidence': 85},
    {'name': 'Tailwind CSS', 'category': 'framework', 'patterns': ['tailwindcss', 'tailwind\\.config'], 'confidence': 85},
    {'name': 'Bootstrap', 'category': 'framework', 'patterns': ['bootstrap'], 'confidence': 80},
    {'name': 'Material UI', 'category': 'framework', 'patterns': ['@mui/', 'material-ui'], 'confidence': 80},
    {'name': 'PyTorch', 'category': 'framework', 'patterns': ['torch', 'pytorch'], 'confidence': 85},
    {'name': 'TensorFlow', 'category': 'framework', 'patterns': ['tensorflow', 'tf\\.'], 'confidence': 85},
    {'name': 'Jest', 'category': 'framework', 'patterns': ['jest', '--coverage'], 'confidence': 80},
    {'name': 'Playwright', 'category': 'framework', 'patterns': ['playwright'], 'confidence': 80},
    {'name': 'PostgreSQL', 'category': 'database', 'patterns': ['postgres', 'pg\\b', 'psycopg2', 'pgvector'], 'confidence': 90},
    {'name': 'MongoDB', 'category': 'database', 'patterns': ['mongodb', 'mongoose'], 'confidence': 90},
    {'name': 'MySQL', 'category': 'database', 'patterns': ['mysql', 'mariadb'], 'confidence': 85},
    {'name': 'Redis', 'category': 'database', 'patterns': ['redis', 'ioredis'], 'confidence': 85},
    {'name': 'SQLite', 'category': 'database', 'patterns': ['sqlite', 'sqlite3', 'better-sqlite3'], 'confidence': 85},
    {'name': 'Elasticsearch', 'category': 'database', 'patterns': ['elasticsearch', '@elastic/'], 'confidence': 80},
    {'name': 'DynamoDB', 'category': 'database', 'patterns': ['dynamodb', 'dynamoose'], 'confidence': 80},
    {'name': 'Firebase', 'category': 'database', 'patterns': ['firebase', 'firestore'], 'confidence': 80},
    {'name': 'Prisma', 'category': 'database', 'patterns': ['prisma', '@prisma/'], 'confidence': 85},
    {'name': 'Drizzle', 'category': 'database', 'patterns': ['drizzle-orm'], 'confidence': 80},
    {'name': 'Docker', 'category': 'tool', 'patterns': ['Dockerfile', 'docker-compose\\.yml', '\\.dockerignore'], 'confidence': 95},
    {'name': 'GitHub Actions', 'category': 'tool', 'patterns': ['\\.github/workflows/'], 'confidence': 95},
    {'name': 'ESLint', 'category': 'tool', 'patterns': ['\\.eslintrc', 'eslint\\.config'], 'confidence': 85},
    {'name': 'Prettier', 'category': 'tool', 'patterns': ['\\.prettierrc', 'prettier\\.config'], 'confidence': 80},
    {'name': 'Webpack', 'category': 'tool', 'patterns': ['webpack\\.config', 'webpack'], 'confidence': 80},
    {'name': 'Vite', 'category': 'tool', 'patterns': ['vite\\.config', 'vite'], 'confidence': 85},
    {'name': 'Babel', 'category': 'tool', 'patterns': ['babel\\.config', '\\.babelrc', '@babel/'], 'confidence': 80},
    {'name': 'Git', 'category': 'tool', 'patterns': ['\\.gitignore', '\\.gitattributes', '\\.gitmodules'], 'confidence': 95},
    {'name': 'Make', 'category': 'tool', 'patterns': ['Makefile', 'makefile'], 'confidence': 85},
    {'name': 'AWS', 'category': 'infrastructure', 'patterns': ['aws', 'amazon', 's3', 'lambda', 'ec2', 'cloudformation'], 'confidence': 85},
    {'name': 'Azure', 'category': 'infrastructure', 'patterns': ['azure', 'azurerm'], 'confidence': 85},
    {'name': 'GCP', 'category': 'infrastructure', 'patterns': ['gcp', 'google-cloud', 'gcloud'], 'confidence': 80},
    {'name': 'Kubernetes', 'category': 'infrastructure', 'patterns': ['kubernetes', 'k8s', 'kube', '\\.yaml'], 'confidence': 85},
    {'name': 'Nginx', 'category': 'infrastructure', 'patterns': ['nginx'], 'confidence': 75},
    {'name': 'Cloudflare', 'category': 'infrastructure', 'patterns': ['cloudflare'], 'confidence': 75},
    {'name': 'Terraform', 'category': 'infrastructure', 'patterns': ['terraform', '\\.tf$'], 'confidence': 80},
]

ARCHITECTURE_PATTERNS: list[dict] = [
    {'name': 'Monorepo', 'indicators': ['packages/', 'apps/', 'modules/'], 'description': 'Single codebase deployed as one unit, typically organized in a flat structure.'},
    {'name': 'Microservices', 'indicators': ['services/', 'api-gateway', 'service-registry'], 'description': 'Multiple independent services communicating via APIs, each deployable separately.'},
    {'name': 'MVC', 'indicators': ['controllers/', 'models/', 'views/'], 'description': 'Model-View-Controller pattern separating data, UI, and business logic.'},
    {'name': 'Clean Architecture', 'indicators': ['domain/', 'application/', 'infrastructure/', 'presentation/'], 'description': 'Layered architecture with dependencies pointing inward toward the domain.'},
    {'name': 'Serverless', 'indicators': ['functions/', 'lambdas/', 'serverless'], 'description': 'Event-driven architecture using cloud functions and managed services.'},
    {'name': 'Hexagonal', 'indicators': ['ports/', 'adapters/', 'core/', 'driven/', 'driving/'], 'description': 'Ports and adapters architecture with isolated core business logic.'},
    {'name': 'Event-Driven', 'indicators': ['events/', 'event-bus', 'kafka', 'rabbitmq', 'pub/sub'], 'description': 'Components communicate through asynchronous events and message brokers.'},
    {'name': 'Plugin Architecture', 'indicators': ['plugins/', 'extensions/', 'addons/'], 'description': 'Core system with pluggable extension points for additional functionality.'},
]


def get_tech_database() -> list[dict]:
    return TECH_DATABASE


def get_tech_keywords() -> list[str]:
    return [
        'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'node.js', 'deno',
        'typescript', 'javascript', 'python', 'rust', 'go', 'golang', 'java', 'kotlin',
        'swift', 'ruby', 'php', 'c++', 'c#', 'dart', 'flutter', 'tensorflow',
        'pytorch', 'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'firebase',
        'graphql', 'rest', 'api', 'grpc', 'websocket', 'redis', 'postgresql',
        'mongodb', 'mysql', 'sqlite', 'elasticsearch', 'kafka', 'rabbitmq',
        'tailwind', 'bootstrap', 'sass', 'less', 'webpack', 'vite', 'esbuild',
        'jest', 'mocha', 'cypress', 'playwright', 'pandas', 'numpy', 'scikit-learn',
        'opencv', 'llm', 'gpt', 'openai', 'langchain', 'hugging face', 'transformers',
        'fastapi', 'django', 'flask', 'spring', 'laravel', 'rails', 'asp.net',
    ]


def get_architecture_patterns() -> list[dict]:
    return ARCHITECTURE_PATTERNS


def get_onboarding_template() -> list[dict]:
    return [
        {'scenario': 'default', 'sections': ['name', 'description', 'setup', 'usage']},
    ]

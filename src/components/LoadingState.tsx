import React from 'react'
import { Loader2, GitBranch, BarChart3, FileSearch, Brain } from 'lucide-react'

interface LoadingStateProps {
  message?: string
}

const steps = [
  { icon: <GitBranch className="w-5 h-5" />, label: 'Fetching repository data...' },
  { icon: <FileSearch className="w-5 h-5" />, label: 'Analyzing file structure...' },
  { icon: <Brain className="w-5 h-5" />, label: 'Running AI analysis...' },
  { icon: <BarChart3 className="w-5 h-5" />, label: 'Generating report...' },
]

export default function LoadingState({ message }: LoadingStateProps) {
  const [currentStep, setCurrentStep] = React.useState(0)

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold animate-pulse">AI</span>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {message || 'Analyzing Repository'}
      </h3>
      <p className="text-sm text-gray-500 mb-8">
        This may take a minute depending on repository size
      </p>

      <div className="space-y-3 w-72">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-500 ${
              i === currentStep
                ? 'bg-primary-50 text-primary-700'
                : i < currentStep
                ? 'bg-green-50 text-green-700'
                : 'text-gray-400'
            }`}
          >
            <span className={`transition-colors duration-300 ${
              i === currentStep ? 'text-primary-600' :
              i < currentStep ? 'text-green-500' :
              'text-gray-300'
            }`}>
              {step.icon}
            </span>
            <span className="text-sm font-medium">{step.label}</span>
            {i < currentStep && (
              <span className="ml-auto text-green-500 text-xs">Done</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

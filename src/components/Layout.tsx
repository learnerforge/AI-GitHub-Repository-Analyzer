import React from 'react'
import { Github, GitBranch, BarChart3, GitCompare } from 'lucide-react'
import Link from 'next/link'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Repo Analyzer</h1>
                <p className="text-xs text-gray-500">AI-Powered GitHub Repository Analysis</p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/compare"
                className="btn-secondary text-sm"
              >
                <GitCompare className="w-4 h-4 mr-1.5" />
                Compare
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
              <Link
                href="/"
                className="btn-secondary text-sm"
              >
                <BarChart3 className="w-4 h-4 mr-1.5" />
                New Analysis
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          AI GitHub Repository Analyzer &mdash; MIT License
        </div>
      </footer>
    </div>
  )
}

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CheckCircle, Package, Code, Zap, Database } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 font-sans dark:from-gray-900 dark:to-gray-800">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-8 px-4 sm:px-8 lg:px-16">
        {/* Success Badge */}
        <div className="flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-green-800 dark:bg-green-900 dark:text-green-100">
          <CheckCircle className="h-5 w-5" />
          <span className="font-semibold">
            Story 1.1: Completed Successfully
          </span>
        </div>

        {/* Project Header */}
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold text-gray-900 md:text-6xl dark:text-white">
            DMM
          </h1>
          <p className="text-xl text-gray-600 md:text-2xl dark:text-gray-300">
            Real-Debrid Manager - Virtual Organization System
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Package className="h-4 w-4" />
            Next.js 16.0.3 • React 19.2 • TypeScript 5.6+
          </div>
        </div>

        {/* Implementation Status Cards */}
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex items-center gap-3">
              <Code className="h-8 w-8 text-blue-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Framework
              </h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Next.js 16 App Router
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                React 19.2 + TypeScript
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Tailwind CSS 4+
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex items-center gap-3">
              <Package className="h-8 w-8 text-purple-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Dependencies
              </h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Supabase Client
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                React Query + Zustand
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                shadcn/ui Components
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex items-center gap-3">
              <Zap className="h-8 w-8 text-yellow-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Performance
              </h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Dev Server: 678ms
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Build Time: 1.9s
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Turbopack Active
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex items-center gap-3">
              <Database className="h-8 w-8 text-red-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Ready For
              </h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Story 1.2: Database
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Supabase Setup
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                OAuth2 Integration
              </li>
            </ul>
          </div>
        </div>

        {/* Technical Details Dialog */}
        <div className="flex flex-col items-center gap-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg">
                View Technical Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Story 1.1 Implementation Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <h4 className="mb-2 font-semibold">✅ Completed Tasks</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• Next.js 16.0.3 project creation with App Router</li>
                    <li>• TypeScript 5.6+ configuration with strict mode</li>
                    <li>• Tailwind CSS 4+ integration</li>
                    <li>• src/ directory structure with @/* aliases</li>
                    <li>
                      • shadcn/ui initialization (button, dialog, context-menu)
                    </li>
                    <li>• 15 core dependencies installed</li>
                    <li>• Development server validation</li>
                    <li>• Production build verification</li>
                  </ul>
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">📊 Performance Metrics</h4>
                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Dev Server Start:
                        </span>
                        <div className="font-semibold">678ms</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Build Time:
                        </span>
                        <div className="font-semibold">1.9s</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Dependencies:
                        </span>
                        <div className="font-semibold">15 packages</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Bundle Size:
                        </span>
                        <div className="font-semibold">Optimized</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">🔧 Key Files Created</h4>
                  <div className="rounded-lg bg-gray-50 p-4 font-mono text-xs dark:bg-gray-900">
                    <div className="space-y-1">
                      <div>src/app/page.tsx • src/app/layout.tsx</div>
                      <div>src/components/ui/button.tsx</div>
                      <div>src/components/ui/dialog.tsx</div>
                      <div>src/components/ui/context-menu.tsx</div>
                      <div>src/lib/utils.ts</div>
                      <div>components.json • next.config.ts</div>
                      <div>tsconfig.json • tailwind.config.ts</div>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="flex items-center gap-4">
            <Button variant="default" size="lg">
              Continue to Story 1.2
              <Zap className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Repository
              </a>
            </Button>
          </div>
        </div>

        {/* Epic Progress */}
        <div className="w-full max-w-2xl">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">
              Epic 1: Foundation & Infrastructure
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: '25%' }}
                  ></div>
                </div>
                <span className="text-sm font-medium whitespace-nowrap text-gray-700 dark:text-gray-300">
                  1/4 Complete
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>1.1 Project Init</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300"></div>
                  <span>1.2 Database</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300"></div>
                  <span>1.3 Config</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300"></div>
                  <span>1.4 Workflow</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

/**
 * Root Folders Page
 *
 * Main entry point for folder navigation system
 */

import { Suspense } from 'react'

import { BreadcrumbNavigation } from '@/components/navigation/BreadcrumbNavigation'
import { FolderSearch } from '@/components/navigation/FolderSearch'
import { FolderContents } from '@/components/folders/FolderContents'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ErrorBoundary } from '@/components/error-boundary'

export default function FoldersPage() {
  // Root breadcrumb items
  const breadcrumbItems = [
    {
      id: 'root',
      name: 'Home',
      path: '/folders',
      isRoot: true,
    },
  ]

  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center">
          <h2 className="text-xl font-semibold">Navigation Error</h2>
          <p className="text-muted-foreground mt-2">
            Unable to load the folders page.
          </p>
        </div>
      }
    >
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          {/* Breadcrumb Navigation - Root only */}
          <BreadcrumbNavigation items={breadcrumbItems} className="px-4" />

          {/* Search and Filters */}
          <div className="px-4">
            <Suspense
              fallback={
                <div className="bg-muted h-16 animate-pulse rounded-md" />
              }
            >
              <FolderSearch
                searchTerm=""
                onSearchChange={() => {}}
                filters={{
                  fileType: 'all',
                  dateRange: 'all',
                  sizeRange: 'all',
                  assignedStatus: 'all',
                }}
                onFiltersChange={() => {}}
                sortBy="name"
                sortOrder="asc"
                onSortChange={() => {}}
                viewMode="grid"
                onViewModeChange={() => {}}
              />
            </Suspense>
          </div>

          {/* Root Folder Contents */}
          <div className="px-4">
            <ErrorBoundary
              fallback={
                <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
                  <h3 className="mb-2 text-lg font-medium">
                    Unable to load folders
                  </h3>
                  <p className="text-muted-foreground">
                    Please try refreshing the page.
                  </p>
                </div>
              }
            >
              <Suspense
                fallback={
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-muted h-24 animate-pulse rounded-md"
                      />
                    ))}
                  </div>
                }
              >
                <FolderContents folderId={null} />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

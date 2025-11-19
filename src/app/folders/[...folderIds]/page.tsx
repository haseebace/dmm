/**
 * Dynamic Folder Navigation Page
 *
 * Handles deep folder navigation with unlimited depth
 */

import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { BreadcrumbNavigation } from '@/components/navigation/BreadcrumbNavigation'
import { FolderSearch } from '@/components/navigation/FolderSearch'
import { FolderContents } from '@/components/folders/FolderContents'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ErrorBoundary } from '@/components/error-boundary'

// Dynamically import components to optimize performance
const FolderGrid = dynamic(() => import('@/components/folders/FolderGrid'), {
  loading: () => <LoadingSpinner />,
  ssr: false,
})

interface FolderPageProps {
  params: {
    folderIds: string[]
  }
}

export default function FolderPage({ params }: FolderPageProps) {
  const { folderIds } = params
  const currentFolderId = folderIds[folderIds.length - 1] || null

  // Validate folder exists - this would normally check against the database
  // For now, assume any valid UUID format is valid
  const isValidFolder = !folderIds.some((id) => !id || id === 'undefined')

  if (!isValidFolder) {
    notFound()
  }

  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center">
          <h2 className="text-xl font-semibold">Navigation Error</h2>
          <p className="text-muted-foreground mt-2">
            Unable to navigate to the requested folder.
          </p>
        </div>
      }
    >
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          {/* Breadcrumb Navigation */}
          <BreadcrumbNavigation
            items={buildBreadcrumbPath(folderIds)}
            className="px-4"
          />

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

          {/* Folder Contents */}
          <div className="px-4">
            <ErrorBoundary
              fallback={
                <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
                  <h3 className="mb-2 text-lg font-medium">
                    Unable to load folder contents
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
                <FolderContents folderId={currentFolderId} />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

/**
 * Build breadcrumb path from folder IDs
 */
function buildBreadcrumbPath(folderIds: string[]) {
  const path = []

  // Root home
  path.push({
    id: 'root',
    name: 'Home',
    path: '/folders',
    isRoot: true,
  })

  // Add each folder in the hierarchy
  folderIds.forEach((folderId, index) => {
    path.push({
      id: folderId,
      name: `Folder ${index + 1}`, // This would be fetched from database
      path: `/folders/${folderIds.slice(0, index + 1).join('/')}`,
    })
  })

  return path
}

/**
 * Dynamic import for performance optimization
 */
const dynamic = (importFunc: () => Promise<any>, options?: any) => {
  return React.lazy(importFunc)
}

/**
 * Page metadata
 */
export async function generateMetadata({
  params,
}: FolderPageProps): Promise<Record<string, string>> {
  const { folderIds } = params
  const currentFolderId = folderIds[folderIds.length - 1] || null

  const title = currentFolderId ? `Folder - ${currentFolderId}` : 'Folders'

  const description = currentFolderId
    ? `Browse contents of folder ${currentFolderId}`
    : 'Browse your virtual folder structure'

  return {
    title,
    description,
  }
}

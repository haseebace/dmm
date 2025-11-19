/**
 * CreateFolderButton Component
 *
 * Button component for creating new folders with inline name editing.
 * Supports keyboard shortcuts and integrates with folder store.
 */

'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Plus, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFolderActions, useFolderLoading } from '@/stores/folderStore'
import { CreateFolderInput } from '@/types/folders'

interface CreateFolderButtonProps {
  userId: string
  parentId?: string
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  disabled?: boolean
  onCreateStart?: () => void
  onCreateComplete?: (folderId: string) => void
  onCreateCancel?: () => void
}

export const CreateFolderButton: React.FC<CreateFolderButtonProps> = ({
  userId,
  parentId,
  className = '',
  variant = 'outline',
  size = 'default',
  disabled = false,
  onCreateStart,
  onCreateComplete,
  onCreateCancel,
}) => {
  const [isCreating, setIsCreating] = useState(false)
  const [folderName, setFolderName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isLoading = useFolderLoading()
  const { createFolder, validateFolderName } = useFolderActions()

  // Focus input when creating starts
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isCreating])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+N or Cmd+N to create new folder
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault()
        startCreating()
      }

      // Escape to cancel creation
      if (isCreating && event.key === 'Escape') {
        cancelCreating()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isCreating])

  const startCreating = () => {
    if (disabled || isLoading) return

    setIsCreating(true)
    setFolderName('New Folder')
    onCreateStart?.()
  }

  const cancelCreating = () => {
    setIsCreating(false)
    setFolderName('')
    onCreateCancel?.()
  }

  const handleCreateFolder = async (name: string) => {
    if (!name.trim()) {
      setFolderName('New Folder')
      return
    }

    // Validate folder name
    const validation = validateFolderName(name.trim(), parentId)
    if (!validation.valid) {
      // Show error and keep input focused
      setFolderName(name.trim())
      return
    }

    const folderInput: CreateFolderInput = {
      name: name.trim(),
      parentId,
    }

    const result = await createFolder(userId, folderInput)

    if (result.success) {
      setIsCreating(false)
      setFolderName('')
      onCreateComplete?.(result.folder!.id)
    }
    // If creation fails, keep input open for user to fix issues
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleCreateFolder(folderName)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelCreating()
    }
  }

  const handleInputBlur = () => {
    // Small delay to allow button clicks to register
    setTimeout(() => {
      if (isCreating) {
        if (folderName.trim() && folderName !== 'New Folder') {
          handleCreateFolder(folderName)
        } else {
          cancelCreating()
        }
      }
    }, 200)
  }

  const handleButtonClick = () => {
    if (isCreating) {
      handleCreateFolder(folderName)
    } else {
      startCreating()
    }
  }

  if (isCreating) {
    return (
      <div className="flex w-full items-center gap-2">
        <div className="relative flex-1">
          <Folder className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            ref={inputRef}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={handleInputBlur}
            className="pl-9"
            placeholder="Folder name..."
            disabled={isLoading}
          />
        </div>
        <Button
          onClick={() => handleCreateFolder(folderName)}
          disabled={isLoading || !folderName.trim()}
          size="sm"
        >
          Create
        </Button>
        <Button
          onClick={cancelCreating}
          variant="outline"
          size="sm"
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button
      onClick={handleButtonClick}
      variant={variant}
      size={size}
      disabled={disabled || isLoading}
      className={`gap-2 ${className}`}
      aria-label="Create new folder (Ctrl+N)"
      title="Create new folder (Ctrl+N)"
    >
      <Plus className="h-4 w-4" />
      Create Folder
    </Button>
  )
}

export default CreateFolderButton

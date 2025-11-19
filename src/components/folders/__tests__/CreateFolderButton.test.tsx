/**
 * CreateFolderButton Component Tests
 *
 * Unit tests for the CreateFolderButton component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateFolderButton } from '../CreateFolderButton'
import { CreateFolderInput } from '@/types/folders'

// Mock folder store
vi.mock('@/stores/folderStore', () => ({
  useFolderActions: () => ({
    createFolder: vi.fn(),
    validateFolderName: vi.fn((name: string) => ({ valid: true })),
  }),
  useFolderLoading: () => false,
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('CreateFolderButton', () => {
  const defaultProps = {
    userId: 'user-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders create folder button', () => {
    render(<CreateFolderButton {...defaultProps} />)

    const button = screen.getByRole('button', { name: /create new folder/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label', 'Create new folder (Ctrl+N)')
  })

  it('shows create form when clicked', async () => {
    render(<CreateFolderButton {...defaultProps} />)

    const button = screen.getByRole('button', { name: /create folder/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByDisplayValue('New Folder')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })
  })

  it('supports keyboard shortcut Ctrl+N', () => {
    render(<CreateFolderButton {...defaultProps} />)

    fireEvent.keyDown(document, { key: 'n', ctrlKey: true })

    expect(screen.getByDisplayValue('New Folder')).toBeInTheDocument()
  })

  it('cancels creation on Escape key', async () => {
    render(<CreateFolderButton {...defaultProps} />)

    const button = screen.getByRole('button', { name: /create folder/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByDisplayValue('New Folder')).toBeInTheDocument()
    })

    const input = screen.getByDisplayValue('New Folder')
    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByDisplayValue('New Folder')).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /create folder/i })
      ).toBeInTheDocument()
    })
  })

  it('creates folder on Enter key', async () => {
    const mockCreateFolder = vi.fn().mockResolvedValue({ success: true })
    vi.mocked(
      require('@/stores/folderStore').useFolderActions().createFolder
    ).mockReturnValue(mockCreateFolder)

    render(<CreateFolderButton {...defaultProps} />)

    const button = screen.getByRole('button', { name: /create folder/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByDisplayValue('New Folder')).toBeInTheDocument()
    })

    const input = screen.getByDisplayValue('New Folder')
    fireEvent.change(input, { target: { value: 'My New Folder' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockCreateFolder).toHaveBeenCalledWith('user-1', {
        name: 'My New Folder',
      })
    })
  })

  it('validates folder name before creating', async () => {
    const mockValidateFolderName = vi.fn().mockReturnValue({
      valid: false,
      error: 'Invalid folder name',
    })
    vi.mocked(
      require('@/stores/folderStore').useFolderActions().validateFolderName
    ).mockReturnValue(mockValidateFolderName)

    render(<CreateFolderButton {...defaultProps} />)

    const button = screen.getByRole('button', { name: /create folder/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByDisplayValue('New Folder')).toBeInTheDocument()
    })

    const input = screen.getByDisplayValue('New Folder')
    fireEvent.change(input, { target: { value: 'Invalid<>Name' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockValidateFolderName).toHaveBeenCalledWith('Invalid<>Name')
    })

    // Should keep the input open for correction
    expect(screen.getByDisplayValue('Invalid<>Name')).toBeInTheDocument()
  })

  it('applies correct variant and size props', () => {
    const { rerender } = render(
      <CreateFolderButton {...defaultProps} variant="outline" size="lg" />
    )

    let button = screen.getByRole('button')
    expect(button).toHaveClass('outline')

    rerender(<CreateFolderButton {...defaultProps} variant="ghost" size="sm" />)

    button = screen.getByRole('button')
    expect(button).toHaveClass('ghost')
  })

  it('is disabled when loading prop is true', () => {
    vi.mocked(require('@/stores/folderStore').useFolderLoading).mockReturnValue(
      true
    )

    render(<CreateFolderButton {...defaultProps} />)

    const button = screen.getByRole('button', { name: /create folder/i })
    expect(button).toBeDisabled()
  })

  it('calls optional callbacks', async () => {
    const onCreateStart = vi.fn()
    const onCreateComplete = vi.fn()
    const onCreateCancel = vi.fn()

    const mockCreateFolder = vi.fn().mockResolvedValue({
      success: true,
      folder: { id: 'new-folder-id', name: 'Test Folder' },
    })
    vi.mocked(
      require('@/stores/folderStore').useFolderActions().createFolder
    ).mockReturnValue(mockCreateFolder)

    render(
      <CreateFolderButton
        {...defaultProps}
        onCreateStart={onCreateStart}
        onCreateComplete={onCreateComplete}
        onCreateCancel={onCreateCancel}
      />
    )

    const button = screen.getByRole('button', { name: /create folder/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(onCreateStart).toHaveBeenCalled()
    })

    const input = screen.getByDisplayValue('New Folder')
    fireEvent.change(input, { target: { value: 'Test Folder' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockCreateFolder).toHaveBeenCalled()
      expect(onCreateComplete).toHaveBeenCalledWith('new-folder-id')
    })
  })

  it('applies custom className', () => {
    render(<CreateFolderButton {...defaultProps} className="custom-class" />)

    const button = screen.getByRole('button', { name: /create folder/i })
    expect(button).toHaveClass('custom-class')
  })
})

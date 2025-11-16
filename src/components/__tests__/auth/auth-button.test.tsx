import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthButton } from '@/components/auth/auth-button'

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => (
    <div data-testid="loader" className={className} />
  ),
  ExternalLink: ({ className }: { className?: string }) => (
    <div data-testid="external-link" className={className} />
  ),
  Shield: ({ className }: { className?: string }) => (
    <div data-testid="shield" className={className} />
  ),
  ShieldOff: ({ className }: { className?: string }) => (
    <div data-testid="shield-off" className={className} />
  ),
  CheckCircle: ({ className }: { className?: string }) => (
    <div data-testid="check-circle" className={className} />
  ),
  AlertCircle: ({ className }: { className?: string }) => (
    <div data-testid="alert-circle" className={className} />
  ),
}))

describe('AuthButton', () => {
  const mockOnLogin = vi.fn()
  const mockOnLogout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Loading state', () => {
    it('should show loading spinner when isLoading is true', () => {
      render(
        <AuthButton
          isAuthenticated={false}
          isLoading={true}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      expect(screen.getByRole('button', { name: /connecting/i })).toBeDisabled()
      expect(screen.getByTestId('loader')).toBeInTheDocument()
    })

    it('should disable button when loading', () => {
      render(
        <AuthButton
          isAuthenticated={false}
          isLoading={true}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      const button = screen.getByRole('button', { name: /connecting/i })
      expect(button).toBeDisabled()
    })
  })

  describe('Authenticated state', () => {
    const mockUser = {
      username: 'testuser',
      premium: true,
    }

    it('should show connected state with premium account', () => {
      render(
        <AuthButton
          isAuthenticated={true}
          isLoading={false}
          user={mockUser}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      expect(screen.getByText('Connected to Real-Debrid')).toBeInTheDocument()
      expect(screen.getByText('testuser')).toBeInTheDocument()
      expect(screen.getByText('Premium Account')).toBeInTheDocument()
      expect(screen.getByTestId('shield')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /disconnect/i })
      ).toBeInTheDocument()
    })

    it('should show connected state with free account', () => {
      const freeUser = {
        username: 'freeduser',
        premium: false,
      }

      render(
        <AuthButton
          isAuthenticated={true}
          isLoading={false}
          user={freeUser}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      expect(screen.getByText('Free Account')).toBeInTheDocument()
      expect(screen.getByTestId('shield-off')).toBeInTheDocument()
    })

    it('should call onLogout when disconnect button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <AuthButton
          isAuthenticated={true}
          isLoading={false}
          user={mockUser}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      const disconnectButton = screen.getByRole('button', {
        name: /disconnect/i,
      })
      await user.click(disconnectButton)

      expect(mockOnLogout).toHaveBeenCalledTimes(1)
    })

    it('should expand details when show more is clicked', async () => {
      const user = userEvent.setup()

      render(
        <AuthButton
          isAuthenticated={true}
          isLoading={false}
          user={mockUser}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      const showMoreButton = screen.getByRole('button', { name: /show more/i })
      await user.click(showMoreButton)

      expect(screen.getByText('Status:')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Access:')).toBeInTheDocument()
      expect(screen.getByText('Full API Access')).toBeInTheDocument()
      expect(screen.getByText('Files:')).toBeInTheDocument()
      expect(screen.getByText('Sync Ready')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /show less/i })
      ).toBeInTheDocument()
    })
  })

  describe('Unauthenticated state', () => {
    it('should show connect to Real-Debrid card', () => {
      render(
        <AuthButton
          isAuthenticated={false}
          isLoading={false}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      expect(screen.getByText('Connect to Real-Debrid')).toBeInTheDocument()
      expect(screen.getByTestId('external-link')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /connect real-debrid account/i })
      ).toBeInTheDocument()
    })

    it('should show security features list', () => {
      render(
        <AuthButton
          isAuthenticated={false}
          isLoading={false}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      expect(
        screen.getByText('Secure OAuth2 authentication')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Access all your media files')
      ).toBeInTheDocument()
      expect(screen.getByText('Premium features support')).toBeInTheDocument()

      // Check for checkmark icons
      const checkmarks = screen.getAllByTestId('check-circle')
      expect(checkmarks).toHaveLength(3)
    })

    it('should show security warning', () => {
      render(
        <AuthButton
          isAuthenticated={false}
          isLoading={false}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      expect(screen.getByTestId('alert-circle')).toBeInTheDocument()
      expect(
        screen.getByText(/you'll be redirected to real-debrid/i)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/your credentials are never stored/i)
      ).toBeInTheDocument()
    })

    it('should call onLogin when connect button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <AuthButton
          isAuthenticated={false}
          isLoading={false}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      const connectButton = screen.getByRole('button', {
        name: /connect real-debrid account/i,
      })
      await user.click(connectButton)

      expect(mockOnLogin).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <AuthButton
          isAuthenticated={false}
          isLoading={false}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      // Check that the main connect button has accessible name
      const connectButton = screen.getByRole('button', {
        name: /connect real-debrid account/i,
      })
      expect(connectButton).toBeInTheDocument()

      // Check that icons have appropriate aria-hidden or are decorative
      const icons = screen.getAllByRole('img') // Lucide icons are often rendered as images
      expect(icons.length).toBeGreaterThan(0)
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()

      render(
        <AuthButton
          isAuthenticated={false}
          isLoading={false}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      const connectButton = screen.getByRole('button', {
        name: /connect real-debrid account/i,
      })

      // Test keyboard navigation
      await user.tab()
      expect(connectButton).toHaveFocus()

      await user.keyboard('{Enter}')
      expect(mockOnLogin).toHaveBeenCalled()
    })
  })

  describe('Responsive design', () => {
    it('should adapt to different container sizes', () => {
      const { container } = render(
        <div style={{ width: '300px' }}>
          <AuthButton
            isAuthenticated={false}
            isLoading={false}
            onLogin={mockOnLogin}
            onLogout={mockOnLogout}
          />
        </div>
      )

      const card = container.querySelector('.w-full')
      expect(card).toBeInTheDocument()
    })

    it('should maintain readability on small screens', () => {
      const { container } = render(
        <div style={{ width: '250px' }}>
          <AuthButton
            isAuthenticated={false}
            isLoading={false}
            onLogin={mockOnLogin}
            onLogout={mockOnLogout}
          />
        </div>
      )

      const warningText = screen.getByText(/you'll be redirected/i)
      expect(warningText).toBeInTheDocument()

      // Text should still be readable on small screens
      expect(warningText).toHaveClass('text-xs')
    })
  })

  describe('Edge cases', () => {
    it('should handle null user gracefully', () => {
      render(
        <AuthButton
          isAuthenticated={true}
          isLoading={false}
          user={null}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      // Should show connected state but with minimal user info
      expect(screen.getByText('Connected to Real-Debrid')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /disconnect/i })
      ).toBeInTheDocument()
    })

    it('should handle missing user properties gracefully', () => {
      const incompleteUser = {
        username: 'testuser',
        // Missing premium property
      } as { username: string; premium?: boolean }

      render(
        <AuthButton
          isAuthenticated={true}
          isLoading={false}
          user={incompleteUser}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
        />
      )

      expect(screen.getByText('testuser')).toBeInTheDocument()
      // Should not crash even with missing premium property
      expect(
        screen.getByRole('button', { name: /disconnect/i })
      ).toBeInTheDocument()
    })

    it('should handle custom className prop', () => {
      render(
        <AuthButton
          isAuthenticated={false}
          isLoading={false}
          onLogin={mockOnLogin}
          onLogout={mockOnLogout}
          className="custom-auth-class"
        />
      )

      const card = screen
        .getByText('Connect to Real-Debrid')
        .closest('.custom-auth-class')
      expect(card).toBeInTheDocument()
    })
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../ui/button'

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<Button onClick={handleClick}>Click me</Button>)

    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies correct styles for variants', () => {
    const { rerender } = render(<Button variant="default">Default</Button>)
    const defaultButton = screen.getByRole('button')

    expect(defaultButton).toHaveClass('bg-primary')

    rerender(<Button variant="secondary">Secondary</Button>)
    const secondaryButton = screen.getByRole('button')

    expect(secondaryButton).toHaveClass('bg-secondary')
  })

  it('is accessible with proper ARIA attributes', () => {
    render(<Button disabled>Disabled Button</Button>)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('data-slot', 'button')
  })
})

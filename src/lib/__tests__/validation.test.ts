import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Example validation function
const createEmailSchema = () => z.string().email('Invalid email address')

describe('Email Validation', () => {
  it('should validate valid email addresses', () => {
    const schema = createEmailSchema()

    expect(schema.parse('user@example.com')).toBe('user@example.com')
    expect(schema.parse('test.email+tag@domain.co.uk')).toBe(
      'test.email+tag@domain.co.uk'
    )
  })

  it('should reject invalid email addresses', () => {
    const schema = createEmailSchema()

    expect(() => schema.parse('invalid-email')).toThrow('Invalid email address')
    expect(() => schema.parse('user@')).toThrow('Invalid email address')
    expect(() => schema.parse('@domain.com')).toThrow('Invalid email address')
  })
})

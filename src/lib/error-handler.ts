export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR')
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR')
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR')
    this.name = 'NotFoundError'
  }
}

export class DatabaseError extends AppError {
  constructor(
    message: string,
    public originalError?: Error
  ) {
    super(message, 500, 'DATABASE_ERROR')
    this.name = 'DatabaseError'
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    message: string,
    public service?: string
  ) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR')
    this.name = 'ExternalServiceError'
  }
}

export class OAuth2Error extends AppError {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message, 400, 'OAUTH2_ERROR')
    this.name = 'OAuth2Error'
  }
}

export function handleApiError(error: unknown) {
  console.error('API Error:', error)

  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
    }
  }

  if (error instanceof z.ZodError) {
    return {
      error: 'Validation failed',
      details: error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    }
  }

  return {
    error: 'Internal server error',
    statusCode: 500,
    code: 'INTERNAL_ERROR',
  }
}

export function logError(error: Error, context?: string) {
  const timestamp = new Date().toISOString()
  const message = `[${timestamp}] ${context ? `[${context}] ` : ''}${error.message}`

  if (process.env.NODE_ENV === 'development') {
    console.error(message, error.stack)
  } else {
    // In production, you might want to send to a logging service
    console.error(message)
  }
}

// Import zod for ZodError handling
import { z } from 'zod'

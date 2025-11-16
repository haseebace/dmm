/**
 * Real-Debrid API Types
 *
 * TypeScript type definitions for Real-Debrid REST API v1.0
 * API Documentation: https://real-debrid.com/apidoc
 */

// Common types
export interface ApiResponse<T = unknown> {
  data: T
  status_code: number
  status_text: string
}

export interface ApiError {
  error_code: string
  error_message: string
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

// User Information
export interface User {
  id: string
  username: string
  email: string
  avatar: string
  points: number
  premium: number
  expiration: string | null
  locale: string
  country: string
  api_version: string
}

// File Hosting Status
export interface Host {
  id: string
  name: string
  logo: string
  supported: boolean
  status: string
  extensions: string[]
}

// Torrent Information
export interface Torrent {
  id: string
  filename: string
  original_filename: string
  hash: string
  bytes: number
  host: string
  host_icon: string
  split: number
  progress: number
  status: string
  added: string
  ended: string | null
  links: string[]
  link: string | null
}

export interface TorrentInfo {
  id: string
  filename: string
  original_filename: string
  hash: string
  bytes: number
  host: string
  host_icon: string
  split: number
  progress: number
  status: string
  added: string
  ended: string | null
  links: string[]
  link: string | null
  seeders: number
  download_speed: number
  upload_speed: number
}

// Link Unrestricting
export interface UnrestrictLink {
  id: string
  filename: string
  original_filename: string
  mime: string
  filesize: number
  host: string
  host_icon: string
  link: string
  alternate_link: string
  generated_link: string
  streaming_quality: string
  streaming_server: string
}

// Streaming Information
export interface StreamingServer {
  id: string
  name: string
  quality: string
  status: string
}

export interface StreamingLink {
  id: string
  filename: string
  generated: string
  quality: string
  server: string
}

// Request Types
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  params?: Record<string, string | number>
  cache?: RequestCache
  signal?: AbortSignal
}

export interface RealDebridConfig {
  apiBaseUrl: string
  apiVersion: string
  timeout: number
  retryAttempts: number
  retryDelay: number
  rateLimitRequests: number
  rateLimitWindow: number
  cacheEnabled: boolean
  cacheTtl: number
}

export interface RealDebridClientOptions {
  config?: Partial<RealDebridConfig>
  getToken: () => Promise<string | null>
  onTokenRefresh?: () => Promise<string | null>
  onError?: (error: ApiError) => void
  onRateLimit?: (info: RateLimitInfo) => void
}

// Error Types
export class RealDebridApiError extends Error {
  constructor(
    public error_code: string,
    public error_message: string,
    public status_code?: number
  ) {
    super(`Real-Debrid API Error [${error_code}]: ${error_message}`)
    this.name = 'RealDebridApiError'
  }
}

export class RealDebridRateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(`Rate limit exceeded: ${message}`)
    this.name = 'RealDebridRateLimitError'
  }
}

export class RealDebridAuthError extends Error {
  constructor(message: string) {
    super(`Authentication failed: ${message}`)
    this.name = 'RealDebridAuthError'
  }
}

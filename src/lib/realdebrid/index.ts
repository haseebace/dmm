/**
 * Real-Debrid API Client
 *
 * Complete Real-Debrid REST API v1.0 client with all endpoints
 * Provides a unified interface for interacting with Real-Debrid services
 */

import RealDebridClient from './client'
import { UserEndpoint } from './endpoints/user'
import { HostsEndpoint } from './endpoints/hosts'
import { UnrestrictEndpoint } from './endpoints/unrestrict'
import { TorrentsEndpoint } from './endpoints/torrents'
import { StreamingEndpoint } from './endpoints/streaming'
import {
  RealDebridClientOptions,
  User,
  Host,
  UnrestrictLink,
  Torrent,
  StreamingLink,
} from '@/types/realdebrid'

export class RealDebridApi {
  private client: RealDebridClient
  public user: UserEndpoint
  public hosts: HostsEndpoint
  public unrestrict: UnrestrictEndpoint
  public torrents: TorrentsEndpoint
  public streaming: StreamingEndpoint

  constructor(options: RealDebridClientOptions) {
    this.client = new RealDebridClient(options)

    // Initialize endpoints
    this.user = new UserEndpoint(this.client)
    this.hosts = new HostsEndpoint(this.client)
    this.unrestrict = new UnrestrictEndpoint(this.client)
    this.torrents = new TorrentsEndpoint(this.client)
    this.streaming = new StreamingEndpoint(this.client)
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.user.getUserInfo()
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get comprehensive API status
   */
  async getApiStatus(): Promise<{
    connected: boolean
    authenticated: boolean
    rateLimit: {
      limit: number
      remaining: number
      reset: number
    }
    cacheSize: number
  }> {
    const rateLimit = this.client.getRateLimitInfo()
    const cacheSize = this.client.getCacheSize()

    let connected = false
    let authenticated = false

    try {
      await this.user.getUserInfo()
      connected = true
      authenticated = true
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'status_code' in error &&
        error.status_code === 401
      ) {
        connected = true
        authenticated = false
      } else {
        connected = false
        authenticated = false
      }
    }

    return {
      connected,
      authenticated,
      rateLimit,
      cacheSize,
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.client.clearCache()
  }

  /**
   * Get rate limit information
   */
  getRateLimitInfo() {
    return this.client.getRateLimitInfo()
  }

  /**
   * Get client configuration
   */
  getConfig() {
    return this.client.getConfig()
  }

  /**
   * Direct access to the underlying client for advanced usage
   */
  get rawClient(): RealDebridClient {
    return this.client
  }
}

// Export types for convenience
export type {
  User,
  Host,
  UnrestrictLink,
  Torrent,
  StreamingLink,
  RealDebridClientOptions,
  RealDebridApiError,
  RealDebridRateLimitError,
  RealDebridAuthError,
} from '@/types/realdebrid'

export { RealDebridClient } from './client'
export type {
  UnrestrictLinkOptions,
  AddTorrentOptions,
  AddMagnetOptions,
  StreamingOptions,
} from './endpoints'

// Export default class
export default RealDebridApi

/**
 * Create a new Real-Debrid API client with sensible defaults
 * @param tokenProvider Function to get authentication token
 * @param options Additional configuration options
 */
export function createRealDebridClient(
  tokenProvider: () => Promise<string | null>,
  options: Partial<RealDebridClientOptions> = {}
): RealDebridApi {
  return new RealDebridApi({
    getToken: tokenProvider,
    ...options,
  })
}

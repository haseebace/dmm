/**
 * Real-Debrid Unrestrict Endpoint
 *
 * Link unlocking and download management endpoints
 */

import RealDebridClient from '../client'
import { UnrestrictLink } from '@/types/realdebrid'

export interface UnrestrictLinkOptions {
  password?: string
  remote?: number // Enable remote traffic management
}

export class UnrestrictEndpoint {
  constructor(private client: RealDebridClient) {}

  /**
   * Unlock and convert a link to a premium link
   * POST /unrestrict/link
   * @param link Original link to unlock
   * @param options Additional options for unlocking
   */
  async unlockLink(
    link: string,
    options: UnrestrictLinkOptions = {}
  ): Promise<UnrestrictLink> {
    return this.client.post<UnrestrictLink>('/unrestrict/link', {
      link,
      ...options,
    })
  }

  /**
   * Get unlocked link information without downloading
   * @param link Original link to check
   * @param options Additional options
   */
  async checkLink(
    link: string,
    options: UnrestrictLinkOptions = {}
  ): Promise<UnrestrictLink | null> {
    try {
      return await this.unlockLink(link, options)
    } catch (error) {
      return null
    }
  }

  /**
   * Get file size before unlocking (if available)
   * @param link Original link to check
   */
  async getFileSize(link: string): Promise<number | null> {
    try {
      const info = await this.checkLink(link)
      return info?.filesize || null
    } catch (error) {
      return null
    }
  }

  /**
   * Check if a link can be unlocked (supported host)
   * @param link Original link to check
   */
  async isLinkSupported(link: string): Promise<boolean> {
    try {
      const info = await this.checkLink(link)
      return info !== null
    } catch (error) {
      return false
    }
  }

  /**
   * Extract host from link
   * @param link URL to extract host from
   */
  extractHostFromLink(link: string): string | null {
    try {
      const url = new URL(link)
      return url.hostname
    } catch {
      return null
    }
  }

  /**
   * Check if multiple links are from the same host
   * @param links Array of links to check
   */
  getLinksHost(links: string[]): Record<string, string[]> {
    const hostGroups: Record<string, string[]> = {}

    links.forEach((link) => {
      const host = this.extractHostFromLink(link)
      if (host) {
        if (!hostGroups[host]) {
          hostGroups[host] = []
        }
        hostGroups[host].push(link)
      }
    })

    return hostGroups
  }

  /**
   * Unlock multiple links in parallel
   * @param links Array of links to unlock
   * @param options Options to apply to all links
   */
  async unlockMultipleLinks(
    links: string[],
    options: UnrestrictLinkOptions = {}
  ): Promise<
    Array<{ link: string; result: UnrestrictLink | null; error: Error | null }>
  > {
    const promises = links.map(async (link) => {
      try {
        const result = await this.unlockLink(link, options)
        return { link, result, error: null }
      } catch (error) {
        return { link, result: null, error: error as Error }
      }
    })

    return Promise.all(promises)
  }

  /**
   * Batch unlock links with concurrency control
   * @param links Array of links to unlock
   * @param options Options for unlocking
   * @param concurrency Maximum concurrent requests
   */
  async unlockMultipleLinksBatch(
    links: string[],
    options: UnrestrictLinkOptions = {},
    concurrency = 3
  ): Promise<
    Array<{ link: string; result: UnrestrictLink | null; error: Error | null }>
  > {
    const results: Array<{
      link: string
      result: UnrestrictLink | null
      error: Error | null
    }> = []

    for (let i = 0; i < links.length; i += concurrency) {
      const batch = links.slice(i, i + concurrency)
      const batchResults = await this.unlockMultipleLinks(batch, options)
      results.push(...batchResults)
    }

    return results
  }
}

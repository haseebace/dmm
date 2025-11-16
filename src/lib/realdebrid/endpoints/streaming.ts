/**
 * Real-Debrid Streaming Endpoint
 *
 * Streaming and media access endpoints
 */

import RealDebridClient from '../client'
import { StreamingServer, StreamingLink } from '@/types/realdebrid'

export interface StreamingOptions {
  quality?: string // Preferred quality
  server?: string // Preferred server
}

export class StreamingEndpoint {
  constructor(private client: RealDebridClient) {}

  /**
   * Get available streaming servers
   * GET /streaming/serverAvailability
   */
  async getStreamingServers(): Promise<StreamingServer[]> {
    return this.client.get<StreamingServer[]>('/streaming/serverAvailability')
  }

  /**
   * Get streaming information for a file
   * GET /streaming/info/{id}
   * @param id File ID or torrent ID
   * @param options Streaming preferences
   */
  async getStreamingInfo(
    id: string,
    options: StreamingOptions = {}
  ): Promise<StreamingLink[]> {
    return this.client.get<StreamingLink[]>(
      `/streaming/info/${id}`,
      options as Record<string, string>
    )
  }

  /**
   * Get best quality streaming link
   * @param id File ID or torrent ID
   * @param options Streaming preferences
   */
  async getBestQualityLink(
    id: string,
    options: StreamingOptions = {}
  ): Promise<StreamingLink | null> {
    try {
      const links = await this.getStreamingInfo(id, options)

      // Sort by quality (HD > SD > other)
      const qualityOrder = ['HD', 'SD', 'FULL HD', '4K']

      return (
        links
          .sort((a, b) => {
            const aQualityIndex = qualityOrder.indexOf(a.quality)
            const bQualityIndex = qualityOrder.indexOf(b.quality)

            if (aQualityIndex !== bQualityIndex) {
              return (
                (aQualityIndex === -1 ? 999 : aQualityIndex) -
                (bQualityIndex === -1 ? 999 : bQualityIndex)
              )
            }

            // If same quality, prefer available server
            return a.server.localeCompare(b.server)
          })
          .find((link) => link.generated) || null
      )
    } catch {
      return null
    }
  }

  /**
   * Get streaming link by quality preference
   * @param id File ID or torrent ID
   * @param quality Preferred quality
   * @param server Preferred server (optional)
   */
  async getStreamingLinkByQuality(
    id: string,
    quality: string,
    server?: string
  ): Promise<StreamingLink | null> {
    try {
      const links = await this.getStreamingInfo(id)

      return (
        links.find(
          (link) =>
            link.quality.toLowerCase() === quality.toLowerCase() &&
            (!server || link.server.toLowerCase() === server.toLowerCase()) &&
            link.generated
        ) || null
      )
    } catch {
      return null
    }
  }

  /**
   * Get all available qualities for a media file
   * @param id File ID or torrent ID
   */
  async getAvailableQualities(id: string): Promise<string[]> {
    try {
      const links = await this.getStreamingInfo(id)
      const qualities = [...new Set(links.map((link) => link.quality))]
      return qualities.sort()
    } catch {
      return []
    }
  }

  /**
   * Get all available servers for a media file
   * @param id File ID or torrent ID
   */
  async getAvailableServers(id: string): Promise<string[]> {
    try {
      const links = await this.getStreamingInfo(id)
      const servers = [...new Set(links.map((link) => link.server))]
      return servers.sort()
    } catch {
      return []
    }
  }

  /**
   * Check if streaming is available for a file
   * @param id File ID or torrent ID
   */
  async isStreamingAvailable(id: string): Promise<boolean> {
    try {
      const links = await this.getStreamingInfo(id)
      return links.some((link) => link.generated)
    } catch {
      return false
    }
  }

  /**
   * Get streaming server status
   * @param serverId Server ID
   */
  async getServerStatus(serverId: string): Promise<StreamingServer | null> {
    try {
      const servers = await this.getStreamingServers()
      return servers.find((server) => server.id === serverId) || null
    } catch {
      return null
    }
  }

  /**
   * Get available streaming servers by status
   * @param status Server status filter
   */
  async getServersByStatus(status: string): Promise<StreamingServer[]> {
    try {
      const servers = await this.getStreamingServers()
      return servers.filter((server) => server.status === status)
    } catch {
      return []
    }
  }

  /**
   * Get streaming links for multiple files
   * @param ids Array of file IDs
   * @param options Streaming preferences
   */
  async getMultipleStreamingInfo(
    ids: string[],
    options: StreamingOptions = {}
  ): Promise<
    Array<{ id: string; links: StreamingLink[]; error: Error | null }>
  > {
    const promises = ids.map(async (id) => {
      try {
        const links = await this.getStreamingInfo(id, options)
        return { id, links, error: null }
      } catch (error) {
        return { id, links: [], error: error as Error }
      }
    })

    return Promise.all(promises)
  }

  /**
   * Get streaming links with fallback (try multiple servers/qualities)
   * @param id File ID or torrent ID
   * @param preferredQualities Array of preferred qualities in order
   * @param preferredServers Array of preferred servers in order
   */
  async getStreamingLinkWithFallback(
    id: string,
    preferredQualities: string[] = ['HD', 'SD'],
    preferredServers: string[] = []
  ): Promise<StreamingLink | null> {
    try {
      const links = await this.getStreamingInfo(id)

      // Create priority order for qualities
      for (const quality of preferredQualities) {
        for (const server of preferredServers.length > 0
          ? preferredServers
          : ['']) {
          const link = links.find(
            (l) =>
              l.quality.toLowerCase() === quality.toLowerCase() &&
              (!server || l.server.toLowerCase() === server.toLowerCase()) &&
              l.generated
          )

          if (link) return link
        }

        // If no preferred servers, try any server with this quality
        const anyServerLink = links.find(
          (l) =>
            l.quality.toLowerCase() === quality.toLowerCase() && l.generated
        )

        if (anyServerLink) return anyServerLink
      }

      // If no preferred qualities work, return any generated link
      return links.find((l) => l.generated) || null
    } catch {
      return null
    }
  }

  /**
   * Generate direct streaming URL
   * @param link Streaming link object
   */
  getDirectStreamingUrl(link: StreamingLink): string {
    return link.generated || ''
  }

  /**
   * Check if link is valid streaming link
   * @param link Streaming link object
   */
  isValidStreamingLink(link: StreamingLink): boolean {
    return !!link.id && !!link.filename && !!link.generated
  }

  /**
   * Get streaming media type from filename
   * @param filename Media filename
   */
  getMediaType(filename: string): 'video' | 'audio' | 'other' {
    const videoExtensions = [
      '.mp4',
      '.avi',
      '.mkv',
      '.mov',
      '.wmv',
      '.flv',
      '.webm',
      '.m4v',
    ]
    const audioExtensions = [
      '.mp3',
      '.wav',
      '.flac',
      '.aac',
      '.ogg',
      '.wma',
      '.m4a',
    ]

    const extension = filename
      .toLowerCase()
      .substring(filename.lastIndexOf('.'))

    if (videoExtensions.includes(extension)) return 'video'
    if (audioExtensions.includes(extension)) return 'audio'
    return 'other'
  }
}

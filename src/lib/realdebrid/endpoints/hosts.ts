/**
 * Real-Debrid Hosts Endpoint
 *
 * File hosting services information endpoints
 */

import RealDebridClient from '../client'
import { Host } from '@/types/realdebrid'

export class HostsEndpoint {
  constructor(private client: RealDebridClient) {}

  /**
   * Get available file hosting services
   * GET /hosts
   */
  async getHosts(): Promise<Host[]> {
    return this.client.get<Host[]>('/hosts')
  }

  /**
   * Get status of a specific host
   * @param hostId Host identifier
   */
  async getHostStatus(hostId: string): Promise<Host | null> {
    try {
      const hosts = await this.getHosts()
      return hosts.find((host) => host.id === hostId) || null
    } catch (error) {
      return null
    }
  }

  /**
   * Get supported hosts (hosts with supported: true)
   */
  async getSupportedHosts(): Promise<Host[]> {
    const hosts = await this.getHosts()
    return hosts.filter((host) => host.supported)
  }

  /**
   * Get hosts by file extension
   * @param extension File extension (without dot)
   */
  async getHostsByExtension(extension: string): Promise<Host[]> {
    const hosts = await this.getHosts()
    return hosts.filter(
      (host) =>
        host.supported &&
        host.extensions.some(
          (ext) => ext.toLowerCase() === extension.toLowerCase()
        )
    )
  }

  /**
   * Check if a file extension is supported
   * @param extension File extension (without dot)
   */
  async isExtensionSupported(extension: string): Promise<boolean> {
    try {
      const hosts = await this.getHostsByExtension(extension)
      return hosts.length > 0
    } catch (error) {
      return false
    }
  }

  /**
   * Get hosts by status
   * @param status Host status filter
   */
  async getHostsByStatus(status: string): Promise<Host[]> {
    const hosts = await this.getHosts()
    return hosts.filter((host) => host.status === status)
  }

  /**
   * Search hosts by name
   * @param query Search query
   */
  async searchHosts(query: string): Promise<Host[]> {
    const hosts = await this.getHosts()
    const lowercaseQuery = query.toLowerCase()
    return hosts.filter(
      (host) =>
        host.name.toLowerCase().includes(lowercaseQuery) ||
        host.id.toLowerCase().includes(lowercaseQuery)
    )
  }
}

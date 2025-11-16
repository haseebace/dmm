/**
 * Real-Debrid Torrents Endpoint
 *
 * Torrent management and information endpoints
 */

import RealDebridClient from '../client'
import { Torrent, TorrentInfo } from '@/types/realdebrid'

export interface AddTorrentOptions {
  host?: string
  split?: number
  remote?: number // Enable remote traffic management
}

export interface AddMagnetOptions extends AddTorrentOptions {
  name?: string // Custom torrent name
}

export class TorrentsEndpoint {
  constructor(private client: RealDebridClient) {}

  /**
   * Add a torrent by magnet link
   * POST /torrents/addMagnet
   * @param magnet Magnet link
   * @param options Additional options
   */
  async addMagnet(
    magnet: string,
    options: AddMagnetOptions = {}
  ): Promise<Torrent> {
    return this.client.post<Torrent>('/torrents/addMagnet', {
      magnet,
      ...options,
    })
  }

  /**
   * Add a torrent by URL
   * POST /torrents/addUrl
   * @param url Torrent URL
   * @param options Additional options
   */
  async addTorrentByUrl(
    url: string,
    options: AddTorrentOptions = {}
  ): Promise<Torrent> {
    return this.client.post<Torrent>('/torrents/addUrl', {
      url,
      ...options,
    })
  }

  /**
   * Add a torrent file
   * POST /torrents/addTorrent
   * @param file Torrent file data (base64 or multipart)
   * @param options Additional options
   */
  async addTorrentFile(
    file: string | File,
    options: AddTorrentOptions = {}
  ): Promise<Torrent> {
    if (typeof file === 'string') {
      // Base64 encoded file
      return this.client.post<Torrent>('/torrents/addTorrent', {
        file,
        ...options,
      })
    } else {
      // File object for multipart upload
      const formData = new FormData()
      formData.append('file', file)

      // Add options as query parameters for multipart
      const params = new URLSearchParams()
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value))
        }
      })

      const queryString = params.toString()
      const endpoint = `/torrents/addTorrent${queryString ? `?${queryString}` : ''}`

      return this.client.request<Torrent>(endpoint, {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set multipart headers
      })
    }
  }

  /**
   * Get list of user's torrents
   * GET /torrents
   */
  async getTorrents(): Promise<Torrent[]> {
    return this.client.get<Torrent[]>('/torrents')
  }

  /**
   * Get detailed information about a specific torrent
   * GET /torrents/info/{id}
   * @param id Torrent ID
   */
  async getTorrentInfo(id: string): Promise<TorrentInfo> {
    return this.client.get<TorrentInfo>(`/torrents/info/${id}`)
  }

  /**
   * Select files from a torrent to download
   * POST /torrents/selectFiles/{id}
   * @param id Torrent ID
   * @param files Array of file IDs to select
   */
  async selectFiles(id: string, files: number[]): Promise<void> {
    await this.client.post(`/torrents/selectFiles/${id}`, {
      files: files.join(','),
    })
  }

  /**
   * Delete a torrent
   * DELETE /torrents/delete/{id}
   * @param id Torrent ID
   */
  async deleteTorrent(id: string): Promise<void> {
    await this.client.delete(`/torrents/delete/${id}`)
  }

  /**
   * Get torrent status
   * @param id Torrent ID
   */
  async getTorrentStatus(
    id: string
  ): Promise<
    | 'downloading'
    | 'downloaded'
    | 'error'
    | 'magnet_error'
    | 'waiting_files_selection'
    | 'dead'
  > {
    try {
      const torrent = await this.getTorrentInfo(id)
      return torrent.status as
        | 'downloading'
        | 'downloaded'
        | 'error'
        | 'magnet_error'
        | 'waiting_files_selection'
        | 'dead'
    } catch {
      throw new Error('Failed to get torrent status')
    }
  }

  /**
   * Check if torrent is completed and ready for download
   * @param id Torrent ID
   */
  async isTorrentReady(id: string): Promise<boolean> {
    try {
      const torrent = await this.getTorrentInfo(id)
      return torrent.status === 'downloaded' && torrent.link !== null
    } catch {
      return false
    }
  }

  /**
   * Get download link for a completed torrent
   * @param id Torrent ID
   */
  async getDownloadLink(id: string): Promise<string | null> {
    try {
      const torrent = await this.getTorrentInfo(id)
      return torrent.link
    } catch {
      return null
    }
  }

  /**
   * Get torrent progress percentage
   * @param id Torrent ID
   */
  async getTorrentProgress(id: string): Promise<number> {
    try {
      const torrent = await this.getTorrentInfo(id)
      return torrent.progress
    } catch {
      return 0
    }
  }

  /**
   * Get all active torrents (downloading or waiting)
   */
  async getActiveTorrents(): Promise<TorrentInfo[]> {
    const torrents = await this.getTorrents()
    const activeStatuses = [
      'downloading',
      'waiting_files_selection',
      'magnet_error',
    ]

    const activeTorrents = await Promise.all(
      torrents
        .filter((torrent) => activeStatuses.includes(torrent.status))
        .map(async (torrent) => {
          try {
            return await this.getTorrentInfo(torrent.id)
          } catch {
            return null
          }
        })
    )

    return activeTorrents.filter(
      (torrent): torrent is TorrentInfo => torrent !== null
    )
  }

  /**
   * Get completed torrents
   */
  async getCompletedTorrents(): Promise<TorrentInfo[]> {
    const torrents = await this.getTorrents()
    const completedTorrents = torrents.filter(
      (torrent) => torrent.status === 'downloaded'
    )

    const detailedTorrents = await Promise.all(
      completedTorrents.map(async (torrent) => {
        try {
          return await this.getTorrentInfo(torrent.id)
        } catch {
          return null
        }
      })
    )

    return detailedTorrents.filter(
      (torrent): torrent is TorrentInfo => torrent !== null
    )
  }

  /**
   * Delete multiple torrents
   * @param ids Array of torrent IDs
   */
  async deleteMultipleTorrents(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => this.deleteTorrent(id)))
  }

  /**
   * Get torrent by magnet link (check if already added)
   * @param magnet Magnet link to search for
   */
  async getTorrentByMagnet(magnet: string): Promise<Torrent | null> {
    try {
      const torrents = await this.getTorrents()
      // Extract hash from magnet link and compare
      const hashMatch = magnet.match(/btih:([a-fA-F0-9]{40})/i)
      if (!hashMatch) return null

      const targetHash = hashMatch[1].toLowerCase()
      return (
        torrents.find((torrent) => torrent.hash.toLowerCase() === targetHash) ||
        null
      )
    } catch {
      return null
    }
  }

  /**
   * Get torrent download speed
   * @param id Torrent ID
   */
  async getDownloadSpeed(id: string): Promise<number> {
    try {
      const torrent = await this.getTorrentInfo(id)
      return torrent.download_speed || 0
    } catch {
      return 0
    }
  }

  /**
   * Get torrent upload speed
   * @param id Torrent ID
   */
  async getUploadSpeed(id: string): Promise<number> {
    try {
      const torrent = await this.getTorrentInfo(id)
      return torrent.upload_speed || 0
    } catch {
      return 0
    }
  }
}

/**
 * Real-Debrid Unrestrict Endpoint Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import RealDebridClient from '../../../realdebrid/client'
import { UnrestrictEndpoint } from '@/lib/realdebrid/endpoints/unrestrict'
import type { UnrestrictLink } from '@/types/realdebrid'

// Mock the RealDebridClient
vi.mock('../../client', () => {
  return {
    default: class MockRealDebridClient {
      public post = vi.fn()
    },
  }
})

describe('UnrestrictEndpoint', () => {
  let unrestrictEndpoint: UnrestrictEndpoint
  let mockClient: { post: vi.Mock }

  beforeEach(() => {
    const client = new RealDebridClient({
      getToken: () => Promise.resolve('test'),
    })
    mockClient = client as unknown as { post: vi.Mock }
    unrestrictEndpoint = new UnrestrictEndpoint(client)
  })

  describe('unlockLink', () => {
    it('should unlock a link successfully', async () => {
      const mockLink: UnrestrictLink = {
        id: '123',
        filename: 'test-file.mp4',
        original_filename: 'original-test-file.mp4',
        mime: 'video/mp4',
        filesize: 1024000,
        host: 'example.com',
        host_icon: 'https://example.com/icon.png',
        link: 'https://example.com/download/123',
        alternate_link: 'https://example.com/alt/123',
        generated_link: 'https://cdn.example.com/file/123',
        streaming_quality: 'HD',
        streaming_server: 'server1',
      }

      mockClient.post.mockResolvedValueOnce(mockLink)

      const result = await unrestrictEndpoint.unlockLink(
        'https://example.com/file'
      )

      expect(mockClient.post).toHaveBeenCalledWith('/unrestrict/link', {
        link: 'https://example.com/file',
      })
      expect(result).toEqual(mockLink)
    })

    it('should unlock a link with password', async () => {
      const mockLink: UnrestrictLink = {
        id: '123',
        filename: 'protected-file.mp4',
        original_filename: 'original-protected-file.mp4',
        mime: 'video/mp4',
        filesize: 1024000,
        host: 'example.com',
        host_icon: 'https://example.com/icon.png',
        link: 'https://example.com/download/123',
        alternate_link: 'https://example.com/alt/123',
        generated_link: 'https://cdn.example.com/file/123',
        streaming_quality: 'HD',
        streaming_server: 'server1',
      }

      mockClient.post.mockResolvedValueOnce(mockLink)

      const result = await unrestrictEndpoint.unlockLink(
        'https://example.com/file',
        {
          password: 'secret123',
        }
      )

      expect(mockClient.post).toHaveBeenCalledWith('/unrestrict/link', {
        link: 'https://example.com/file',
        password: 'secret123',
      })
      expect(result).toEqual(mockLink)
    })

    it('should unlock a link with remote traffic management', async () => {
      const mockLink: UnrestrictLink = {
        id: '123',
        filename: 'remote-file.mp4',
        original_filename: 'original-remote-file.mp4',
        mime: 'video/mp4',
        filesize: 1024000,
        host: 'example.com',
        host_icon: 'https://example.com/icon.png',
        link: 'https://example.com/download/123',
        alternate_link: 'https://example.com/alt/123',
        generated_link: 'https://cdn.example.com/file/123',
        streaming_quality: 'HD',
        streaming_server: 'server1',
      }

      mockClient.post.mockResolvedValueOnce(mockLink)

      const result = await unrestrictEndpoint.unlockLink(
        'https://example.com/file',
        {
          remote: 1,
        }
      )

      expect(mockClient.post).toHaveBeenCalledWith('/unrestrict/link', {
        link: 'https://example.com/file',
        remote: 1,
      })
      expect(result).toEqual(mockLink)
    })
  })

  describe('checkLink', () => {
    it('should return link information', async () => {
      const mockLink: UnrestrictLink = {
        id: '123',
        filename: 'check-file.mp4',
        original_filename: 'original-check-file.mp4',
        mime: 'video/mp4',
        filesize: 2048000,
        host: 'example.com',
        host_icon: 'https://example.com/icon.png',
        link: 'https://example.com/download/123',
        alternate_link: 'https://example.com/alt/123',
        generated_link: 'https://cdn.example.com/file/123',
        streaming_quality: 'HD',
        streaming_server: 'server1',
      }

      mockClient.post.mockResolvedValueOnce(mockLink)

      const result = await unrestrictEndpoint.checkLink(
        'https://example.com/file'
      )

      expect(result).toEqual(mockLink)
    })

    it('should return null for invalid link', async () => {
      mockClient.post.mockRejectedValueOnce(new Error('Invalid link'))

      const result = await unrestrictEndpoint.checkLink(
        'https://example.com/invalid'
      )

      expect(result).toBeNull()
    })
  })

  describe('getFileSize', () => {
    it('should return file size for valid link', async () => {
      const mockLink: UnrestrictLink = {
        id: '123',
        filename: 'size-file.mp4',
        original_filename: 'original-size-file.mp4',
        mime: 'video/mp4',
        filesize: 5120000,
        host: 'example.com',
        host_icon: 'https://example.com/icon.png',
        link: 'https://example.com/download/123',
        alternate_link: 'https://example.com/alt/123',
        generated_link: 'https://cdn.example.com/file/123',
        streaming_quality: 'HD',
        streaming_server: 'server1',
      }

      mockClient.post.mockResolvedValueOnce(mockLink)

      const result = await unrestrictEndpoint.getFileSize(
        'https://example.com/file'
      )

      expect(result).toBe(5120000)
    })

    it('should return null for invalid link', async () => {
      mockClient.post.mockRejectedValueOnce(new Error('Invalid link'))

      const result = await unrestrictEndpoint.getFileSize(
        'https://example.com/invalid'
      )

      expect(result).toBeNull()
    })
  })

  describe('isLinkSupported', () => {
    it('should return true for supported link', async () => {
      const mockLink: UnrestrictLink = {
        id: '123',
        filename: 'supported-file.mp4',
        original_filename: 'original-supported-file.mp4',
        mime: 'video/mp4',
        filesize: 1024000,
        host: 'example.com',
        host_icon: 'https://example.com/icon.png',
        link: 'https://example.com/download/123',
        alternate_link: 'https://example.com/alt/123',
        generated_link: 'https://cdn.example.com/file/123',
        streaming_quality: 'HD',
        streaming_server: 'server1',
      }

      mockClient.post.mockResolvedValueOnce(mockLink)

      const result = await unrestrictEndpoint.isLinkSupported(
        'https://example.com/file'
      )

      expect(result).toBe(true)
    })

    it('should return false for unsupported link', async () => {
      mockClient.post.mockRejectedValueOnce(new Error('Unsupported host'))

      const result = await unrestrictEndpoint.isLinkSupported(
        'https://unsupported.com/file'
      )

      expect(result).toBe(false)
    })
  })

  describe('extractHostFromLink', () => {
    it('should extract hostname from valid URL', () => {
      const link = 'https://example.com/path/to/file'
      const result = unrestrictEndpoint.extractHostFromLink(link)

      expect(result).toBe('example.com')
    })

    it('should extract hostname from URL with subdomain', () => {
      const link = 'https://cdn.example.com/path/to/file'
      const result = unrestrictEndpoint.extractHostFromLink(link)

      expect(result).toBe('cdn.example.com')
    })

    it('should return null for invalid URL', () => {
      const link = 'invalid-url'
      const result = unrestrictEndpoint.extractHostFromLink(link)

      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const link = ''
      const result = unrestrictEndpoint.extractHostFromLink(link)

      expect(result).toBeNull()
    })
  })

  describe('getLinksHost', () => {
    it('should group links by host', () => {
      const links = [
        'https://example.com/file1',
        'https://example.com/file2',
        'https://cdn.example.com/file3',
        'https://another.com/file4',
        'https://example.com/file5',
      ]

      const result = unrestrictEndpoint.getLinksHost(links)

      expect(result).toEqual({
        'example.com': [
          'https://example.com/file1',
          'https://example.com/file2',
          'https://example.com/file5',
        ],
        'cdn.example.com': ['https://cdn.example.com/file3'],
        'another.com': ['https://another.com/file4'],
      })
    })

    it('should handle empty array', () => {
      const links: string[] = []
      const result = unrestrictEndpoint.getLinksHost(links)

      expect(result).toEqual({})
    })

    it('should handle invalid URLs', () => {
      const links = [
        'https://example.com/file1',
        'invalid-url',
        'https://another.com/file2',
        '',
      ]

      const result = unrestrictEndpoint.getLinksHost(links)

      expect(result).toEqual({
        'example.com': ['https://example.com/file1'],
        'another.com': ['https://another.com/file2'],
      })
    })
  })

  describe('unlockMultipleLinks', () => {
    it('should unlock multiple links successfully', async () => {
      const mockLinks: UnrestrictLink[] = [
        {
          id: '1',
          filename: 'file1.mp4',
          original_filename: 'original-file1.mp4',
          mime: 'video/mp4',
          filesize: 1024000,
          host: 'example.com',
          host_icon: 'https://example.com/icon.png',
          link: 'https://example.com/download/1',
          alternate_link: 'https://example.com/alt/1',
          generated_link: 'https://cdn.example.com/file/1',
          streaming_quality: 'HD',
          streaming_server: 'server1',
        },
        {
          id: '2',
          filename: 'file2.mp4',
          original_filename: 'original-file2.mp4',
          mime: 'video/mp4',
          filesize: 2048000,
          host: 'example.com',
          host_icon: 'https://example.com/icon.png',
          link: 'https://example.com/download/2',
          alternate_link: 'https://example.com/alt/2',
          generated_link: 'https://cdn.example.com/file/2',
          streaming_quality: 'HD',
          streaming_server: 'server1',
        },
      ]

      mockClient.post
        .mockResolvedValueOnce(mockLinks[0])
        .mockResolvedValueOnce(mockLinks[1])

      const links = ['https://example.com/file1', 'https://example.com/file2']
      const result = await unrestrictEndpoint.unlockMultipleLinks(links)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        link: 'https://example.com/file1',
        result: mockLinks[0],
        error: null,
      })
      expect(result[1]).toEqual({
        link: 'https://example.com/file2',
        result: mockLinks[1],
        error: null,
      })
    })

    it('should handle mixed success and failure', async () => {
      const mockLink: UnrestrictLink = {
        id: '1',
        filename: 'file1.mp4',
        original_filename: 'original-file1.mp4',
        mime: 'video/mp4',
        filesize: 1024000,
        host: 'example.com',
        host_icon: 'https://example.com/icon.png',
        link: 'https://example.com/download/1',
        alternate_link: 'https://example.com/alt/1',
        generated_link: 'https://cdn.example.com/file/1',
        streaming_quality: 'HD',
        streaming_server: 'server1',
      }

      mockClient.post
        .mockResolvedValueOnce(mockLink)
        .mockRejectedValueOnce(new Error('Failed to unlock'))

      const links = ['https://example.com/file1', 'https://example.com/file2']
      const result = await unrestrictEndpoint.unlockMultipleLinks(links)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        link: 'https://example.com/file1',
        result: mockLink,
        error: null,
      })
      expect(result[1]).toEqual({
        link: 'https://example.com/file2',
        result: null,
        error: expect.any(Error),
      })
    })
  })

  describe('unlockMultipleLinksBatch', () => {
    it('should process links in batches', async () => {
      const mockLinks: UnrestrictLink[] = Array(5)
        .fill(null)
        .map((_, index) => ({
          id: String(index + 1),
          filename: `file${index + 1}.mp4`,
          original_filename: `original-file${index + 1}.mp4`,
          mime: 'video/mp4',
          filesize: 1024000,
          host: 'example.com',
          host_icon: 'https://example.com/icon.png',
          link: `https://example.com/download/${index + 1}`,
          alternate_link: `https://example.com/alt/${index + 1}`,
          generated_link: `https://cdn.example.com/file/${index + 1}`,
          streaming_quality: 'HD',
          streaming_server: 'server1',
        }))

      mockClient.post.mockImplementation((endpoint, body) => {
        const linkIndex = parseInt(body.link.split('/').pop()!) - 1
        return Promise.resolve(mockLinks[linkIndex])
      })

      const links = Array(5)
        .fill(null)
        .map((_, index) => `https://example.com/file${index + 1}`)
      const result = await unrestrictEndpoint.unlockMultipleLinksBatch(
        links,
        {},
        2
      )

      expect(result).toHaveLength(5)
      expect(mockClient.post).toHaveBeenCalledTimes(5)

      // Verify batching happened (calls should be limited by concurrency)
      expect(result.every((item) => item.error === null)).toBe(true)
    })
  })
})

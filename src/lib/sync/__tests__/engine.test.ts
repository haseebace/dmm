/**
 * Tests for Metadata Sync Engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MetadataSyncEngine } from '../engine'
import type { RealDebridTorrent } from '../../../types/metadata'
import { createClient } from '../../supabase/client'
import { RealDebridClient } from '../../real-debrid/client'

// Mock dependencies
vi.mock('../../realdebrid', () => ({
  createRealDebridClient: vi.fn().mockReturnValue({
    torrents: {
      getTorrents: vi.fn(),
    },
  }),
}))

vi.mock('../../supabase/client', () => ({
  createClient: vi.fn().mockReturnValue({
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  }),
}))

vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('MetadataSyncEngine', () => {
  let syncEngine: MetadataSyncEngine
  let mockSupabase: any
  let mockRealDebridClient: any

  beforeEach(() => {
    syncEngine = new MetadataSyncEngine()

    mockSupabase = {
      auth: { getUser: vi.fn() },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn(),
          }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn(),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn(),
        }),
      }),
    }

    vi.mocked(createClient).mockReturnValue(mockSupabase)
  })

  describe('startFullSync', () => {
    it('should start a full sync operation', async () => {
      const userId = 'test-user-id'
      const accessToken = 'test-access-token'

      // Mock successful user authentication
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId } },
      })

      // Mock sync operation creation
      const mockSyncOp = {
        id: 'test-operation-id',
        user_id: userId,
        operation_type: 'full_sync',
        status: 'pending',
      }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockSyncOp }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })

      // Mock torrent data
      const mockTorrents: RealDebridTorrent[] = [
        {
          id: 'test-torrent-1',
          filename: 'Test Movie 2024',
          original_filename: 'test-movie-2024.mp4',
          hash: 'abc123',
          bytes: 1073741824, // 1GB
          original_bytes: 1073741824,
          host: 'example.com',
          host_icon: 'https://example.com/icon.png',
          split: 50,
          progress: 100,
          status: 'downloaded',
          added: '2024-01-01T00:00:00.000Z',
          files: [
            {
              id: 1,
              path: '/Test Movie 2024.mp4',
              bytes: 1073741824,
              selected: 1,
            },
          ],
          links: ['http://example.com/download'],
          link: 'http://example.com/torrent',
          ended: '2024-01-01T01:00:00.000Z',
        },
      ]

      // Mock Real-Debrid client responses
      const mockClient = {
        setAccessToken: vi.fn(),
        getTorrents: vi.fn().mockResolvedValue(mockTorrents),
        getTorrentInfo: vi.fn().mockResolvedValue(mockTorrents[0]),
      }

      vi.mocked(RealDebridClient).mockImplementation(() => mockClient)

      // Execute sync
      const result = await syncEngine.startFullSync(userId, accessToken)

      // Verify results
      expect(result.success).toBe(true)
      expect(result.operation_id).toBe('test-operation-id')
      expect(result.items_processed).toBe(1)
      expect(result.items_total).toBe(1)
      expect(result.conflicts).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle sync errors gracefully', async () => {
      const userId = 'test-user-id'
      const accessToken = 'invalid-token'

      // Mock successful user authentication
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId } },
      })

      // Mock sync operation creation
      const mockSyncOp = {
        id: 'test-operation-id',
        user_id: userId,
        operation_type: 'full_sync',
        status: 'pending',
      }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockSyncOp }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })

      // Mock Real-Debrid client to throw error
      const mockClient = {
        setAccessToken: vi.fn(),
        getTorrents: vi
          .fn()
          .mockRejectedValue(new Error('API Error: Invalid token')),
      }

      vi.mocked(RealDebridClient).mockImplementation(() => mockClient)

      // Execute sync and expect error
      await expect(
        syncEngine.startFullSync(userId, accessToken)
      ).rejects.toThrow('API Error: Invalid token')
    })
  })

  describe('getSyncStatus', () => {
    it('should return sync operation status', async () => {
      const operationId = 'test-operation-id'
      const mockStatus = {
        id: operationId,
        status: 'completed',
        items_processed: 100,
        items_total: 100,
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockStatus }),
          }),
        }),
      })

      const result = await syncEngine.getSyncStatus(operationId)

      expect(result).toEqual(mockStatus)
    })

    it('should return null for non-existent operation', async () => {
      const operationId = 'non-existent-id'

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      })

      const result = await syncEngine.getSyncStatus(operationId)

      expect(result).toBeNull()
    })
  })

  describe('cancelSync', () => {
    it('should cancel a sync operation', async () => {
      const operationId = 'test-operation-id'

      // Mock the operation being cancelled
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })

      // Mock successful status check before cancellation
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: operationId, status: 'running' },
            }),
          }),
        }),
      })

      await expect(syncEngine.cancelSync(operationId)).resolves.not.toThrow()
    })
  })

  describe('getUserSyncHistory', () => {
    it("should return user's sync history", async () => {
      const userId = 'test-user-id'
      const mockHistory = [
        {
          id: 'operation-1',
          user_id: userId,
          operation_type: 'full_sync',
          status: 'completed',
          items_processed: 100,
          items_total: 100,
        },
        {
          id: 'operation-2',
          user_id: userId,
          operation_type: 'incremental_sync',
          status: 'completed',
          items_processed: 5,
          items_total: 5,
        },
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: mockHistory }),
            }),
          }),
        }),
      })

      const result = await syncEngine.getUserSyncHistory(userId)

      expect(result).toEqual(mockHistory)
      expect(result).toHaveLength(2)
    })
  })
})

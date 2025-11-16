/**
 * Real-Debrid User Endpoint Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import RealDebridClient from '../../../realdebrid/client'
import { UserEndpoint } from '@/lib/realdebrid/endpoints/user'
import type { User } from '@/types/realdebrid'

// Mock the RealDebridClient
vi.mock('../../client', () => {
  return {
    default: class MockRealDebridClient {
      public get = vi.fn()
    },
  }
})

describe('UserEndpoint', () => {
  let userEndpoint: UserEndpoint
  let mockClient: { get: vi.Mock }

  beforeEach(() => {
    const client = new RealDebridClient({
      getToken: () => Promise.resolve('test'),
    })
    mockClient = client as unknown as { get: vi.Mock }
    userEndpoint = new UserEndpoint(client)
  })

  describe('getUserInfo', () => {
    it('should return user information', async () => {
      const mockUser: User = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg',
        points: 1000,
        premium: 1,
        expiration: '2024-12-31T23:59:59.000Z',
        locale: 'en',
        country: 'US',
        api_version: '1.0',
      }

      mockClient.get.mockResolvedValueOnce(mockUser)

      const result = await userEndpoint.getUserInfo()

      expect(mockClient.get).toHaveBeenCalledWith('/user')
      expect(result).toEqual(mockUser)
    })

    it('should handle API errors', async () => {
      const error = new Error('API error')
      mockClient.get.mockRejectedValueOnce(error)

      await expect(userEndpoint.getUserInfo()).rejects.toThrow(error)
      expect(mockClient.get).toHaveBeenCalledWith('/user')
    })
  })

  describe('isPremium', () => {
    it('should return true for premium user with valid expiration', async () => {
      const mockUser: User = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg',
        points: 1000,
        premium: 1,
        expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        locale: 'en',
        country: 'US',
        api_version: '1.0',
      }

      mockClient.get.mockResolvedValueOnce(mockUser)

      const result = await userEndpoint.isPremium()

      expect(result).toBe(true)
    })

    it('should return false for non-premium user', async () => {
      const mockUser: User = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg',
        points: 1000,
        premium: 0,
        expiration: null,
        locale: 'en',
        country: 'US',
        api_version: '1.0',
      }

      mockClient.get.mockResolvedValueOnce(mockUser)

      const result = await userEndpoint.isPremium()

      expect(result).toBe(false)
    })

    it('should return false for expired premium user', async () => {
      const mockUser: User = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg',
        points: 1000,
        premium: 1,
        expiration: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        locale: 'en',
        country: 'US',
        api_version: '1.0',
      }

      mockClient.get.mockResolvedValueOnce(mockUser)

      const result = await userEndpoint.isPremium()

      expect(result).toBe(false)
    })

    it('should return false when API call fails', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('API error'))

      const result = await userEndpoint.isPremium()

      expect(result).toBe(false)
    })
  })

  describe('getPremiumExpiration', () => {
    it('should return expiration date for premium user', async () => {
      const expirationDate = new Date('2024-12-31T23:59:59.000Z')
      const mockUser: User = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg',
        points: 1000,
        premium: 1,
        expiration: expirationDate.toISOString(),
        locale: 'en',
        country: 'US',
        api_version: '1.0',
      }

      mockClient.get.mockResolvedValueOnce(mockUser)

      const result = await userEndpoint.getPremiumExpiration()

      expect(result).toEqual(expirationDate)
    })

    it('should return null for non-premium user', async () => {
      const mockUser: User = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg',
        points: 1000,
        premium: 0,
        expiration: null,
        locale: 'en',
        country: 'US',
        api_version: '1.0',
      }

      mockClient.get.mockResolvedValueOnce(mockUser)

      const result = await userEndpoint.getPremiumExpiration()

      expect(result).toBeNull()
    })

    it('should return null when API call fails', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('API error'))

      const result = await userEndpoint.getPremiumExpiration()

      expect(result).toBeNull()
    })
  })

  describe('getUserQuota', () => {
    it('should return quota information', async () => {
      const mockUser: User = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg',
        points: 2500,
        premium: 1,
        expiration: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(), // 7 days from now
        locale: 'en',
        country: 'US',
        api_version: '1.0',
      }

      mockClient.get.mockResolvedValueOnce(mockUser)

      const result = await userEndpoint.getUserQuota()

      expect(result).toEqual({
        points: 2500,
        premiumDays: 7,
      })
    })

    it('should return null when API call fails', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('API error'))

      const result = await userEndpoint.getUserQuota()

      expect(result).toBeNull()
    })

    it('should handle expired premium correctly', async () => {
      const mockUser: User = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg',
        points: 1000,
        premium: 1,
        expiration: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        locale: 'en',
        country: 'US',
        api_version: '1.0',
      }

      mockClient.get.mockResolvedValueOnce(mockUser)

      const result = await userEndpoint.getUserQuota()

      expect(result).toEqual({
        points: 1000,
        premiumDays: 0,
      })
    })
  })
})

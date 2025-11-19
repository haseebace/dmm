/**
 * Real-Debrid User Endpoint
 *
 * User information and account management endpoints
 */

import RealDebridClient from '../client'
import { User } from '@/types/realdebrid'

export class UserEndpoint {
  constructor(private client: RealDebridClient) {}

  /**
   * Get current user information
   * GET /user
   */
  async getUserInfo(): Promise<User> {
    return this.client.get<User>('/user')
  }

  /**
   * Check if user has premium subscription
   */
  async isPremium(): Promise<boolean> {
    try {
      const user = await this.getUserInfo()
      return Boolean(
        user.premium > 0 &&
          user.expiration &&
          new Date(user.expiration) > new Date()
      )
    } catch {
      return false
    }
  }

  /**
   * Get user's premium expiration date
   */
  async getPremiumExpiration(): Promise<Date | null> {
    try {
      const user = await this.getUserInfo()
      return user.expiration ? new Date(user.expiration) : null
    } catch {
      return null
    }
  }

  /**
   * Get user's remaining quota information (if available)
   */
  async getUserQuota(): Promise<{
    points: number
    premiumDays: number
  } | null> {
    try {
      const user = await this.getUserInfo()
      return {
        points: user.points,
        premiumDays: user.expiration
          ? Math.max(
              0,
              Math.ceil(
                (new Date(user.expiration).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24)
              )
            )
          : 0,
      }
    } catch {
      return null
    }
  }
}

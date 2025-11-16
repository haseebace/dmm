export interface OAuth2Tokens {
  accessToken: string
  refreshToken?: string
  tokenType: string
  expiresIn: number
  scope: string
  createdAt: number
}

export interface OAuth2UserInfo {
  id: string
  username: string
  email?: string
  avatar?: string
  premium: boolean
  expiration?: string
}

export interface OAuth2State {
  state: string
  codeVerifier: string
  codeChallenge: string
  redirectUri: string
  createdAt: number
}

export interface OAuth2Session {
  user: OAuth2UserInfo
  tokens: OAuth2Tokens
  isAuthenticated: boolean
  expiresAt: number
}

export interface OAuth2Error {
  error: string
  error_description?: string
  error_uri?: string
  state?: string
}

export type OAuth2Status =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'error'
  | 'revoked'

export interface OAuth2AuthState {
  status: OAuth2Status
  user: OAuth2UserInfo | null
  error: OAuth2Error | null
  isAuthenticated: boolean
  isLoading: boolean
}

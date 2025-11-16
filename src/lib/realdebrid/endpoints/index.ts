/**
 * Real-Debrid API Endpoints
 *
 * Export all endpoint classes for modular usage
 */

export { UserEndpoint } from './user'
export { HostsEndpoint } from './hosts'
export { UnrestrictEndpoint } from './unrestrict'
export { TorrentsEndpoint } from './torrents'
export { StreamingEndpoint } from './streaming'

export type { UnrestrictLinkOptions } from './unrestrict'

export type { AddTorrentOptions, AddMagnetOptions } from './torrents'

export type { StreamingOptions } from './streaming'

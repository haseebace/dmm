/**
 * Content Type Detector
 *
 * Analyzes file names, sizes, and metadata to determine content types
 */

import type { FileMetadata } from '@/types/metadata'

export enum ContentType {
  MOVIE = 'movie',
  TV_SHOW = 'tv_show',
  MUSIC = 'music',
  GAME = 'game',
  SOFTWARE = 'software',
  EBOOK = 'ebook',
  ARCHIVE = 'archive',
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image',
  DOCUMENT = 'document',
  OTHER = 'other',
}

export interface ContentInfo {
  type: ContentType
  subtype?: string
  quality?: string
  season?: number
  episode?: number
  year?: number
  language?: string
  resolution?: string
  codec?: string
  source?: string
  tags: string[]
}

export interface ContentDetectionOptions {
  strictMode?: boolean
  includeQuality?: boolean
  detectLanguages?: boolean
  analyzeFilename?: boolean
}

export class ContentTypeDetector {
  private static readonly MOVIE_PATTERNS = [
    // Common movie indicators
    /\b(19|20)\d{2}\b/, // Years between 1900-2099
    /\b(1080p|720p|480p|4K|2160p|HD|BluRay|BRRip|DVDRip|WEBRip|WEB-DL)\b/i,
    /\b(x264|x265|H\.264|H\.265|HEVC|AVC)\b/i,
    /\b(MP4|MKV|AVI|MOV|WMV)\b$/i,
    // Movie-specific terms
    /\b(movie|film|cinema)\b/i,
    /\b(directors?.cut|extended|unrated|theatrical)\b/i,
  ]

  private static readonly TV_SHOW_PATTERNS = [
    // Season/Episode patterns
    /[S](\d{1,2})[E](\d{1,2})/i, // S01E01
    [/(\d{1,2})x(\d{1,2})/, /\bseason\s*(\d{1,2})\s*episode\s*(\d{1,2})\b/i],
    // TV-specific terms
    /\b(episode|ep|season|series)\b/i,
    /\b(pilot|premiere|finale)\b/i,
  ]

  private static readonly MUSIC_PATTERNS = [
    // Audio file extensions
    /\b(MP3|FLAC|AAC|WAV|ALAC|OGG|M4A|APE)\b$/i,
    // Music-specific terms
    /\b(album|single|track|song|music|audio)\b/i,
    // Common music quality indicators
    /\b(320kbps|128kbps|lossless|FLAC|CD|VINYL)\b/i,
  ]

  private static readonly GAME_PATTERNS = [
    // Game file extensions and patterns
    /\b(ISO|CSO|NSP|XCI|PKG|RPK|CIA|3DS|NDS|ROM|GBA|NES|SNES)\b$/i,
    // Gaming platforms
    /\b(PC|PS4|PS5|XBOX|XBOX360|XONE|Switch|Wii|3DS|N64|GameCube)\b/i,
    // Game-specific terms
    /\b(game|play|crack|repack|multi\d+|dlc|expansion|update|patch)\b/i,
  ]

  private static readonly SOFTWARE_PATTERNS = [
    // Software file extensions
    /\b(EXE|MSI|DMG|APP|DEB|RPM|APK|IPA|TAR|ZIP|RAR|7Z)\b$/i,
    // Software-specific terms
    /\b(software|app|application|program|installer|setup|crack|patch|keygen)\b/i,
    // Operating systems
    /\b(windows|macos|linux|ubuntu|android|ios)\b/i,
  ]

  private static readonly EBOOK_PATTERNS = [
    // Ebook file extensions
    /\b(EPUB|MOBI|AZW|AZW3|PDF|CBR|CBZ|DJVU|LIT|FB2)\b$/i,
    // Book-specific terms
    /\b(ebook|book|novel|comics|manga|magazine|article)\b/i,
  ]

  private static readonly ARCHIVE_PATTERNS = [
    // Archive file extensions
    /\b(RAR|ZIP|7Z|TAR|GZ|BZ2|XZ|ACE|CAB)\b$/i,
    // Archive-specific terms
    /\b(archive|compressed|pack|collection)\b/i,
  ]

  private static readonly VIDEO_EXTENSIONS = [
    'mp4',
    'mkv',
    'avi',
    'mov',
    'wmv',
    'flv',
    'webm',
    'm4v',
    '3gp',
    'mpg',
    'mpeg',
  ]

  private static readonly AUDIO_EXTENSIONS = [
    'mp3',
    'flac',
    'aac',
    'wav',
    'alac',
    'ogg',
    'm4a',
    'ape',
    'wma',
  ]

  private static readonly IMAGE_EXTENSIONS = [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'bmp',
    'tiff',
    'webp',
    'svg',
    'ico',
  ]

  private static readonly DOCUMENT_EXTENSIONS = [
    'pdf',
    'doc',
    'docx',
    'txt',
    'rtf',
    'odt',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
  ]

  private static readonly QUALITY_PATTERNS = {
    resolution: [/\b(4K|2160p|1080p|720p|480p|360p|240p)\b/i],
    quality: [
      /\b(HD|Full\s*HD|Ultra\s*HD|4K|SD|BluRay|BRRip|DVDRip|WEBRip|WEB-DL)\b/i,
    ],
    codec: [/\b(x264|x265|H\.264|H\.265|HEVC|AVC|VP9|AV1)\b/i],
    source: [/\b(BluRay|DVD|WEB|TV|Netflix|Amazon|Hulu|Disney\+)\b/i],
  }

  private static readonly LANGUAGE_PATTERNS = [
    /\b(english|eng|en|french|fr|spanish|es|german|de|italian|it|portuguese|pt|russian|ru)\b/i,
    /\b(multi|multilang|multilingual)\b/i,
  ]

  /**
   * Detect content type from filename and metadata
   */
  static detectContent(
    filename: string,
    metadata?: Partial<FileMetadata>,
    options: ContentDetectionOptions = {}
  ): ContentInfo {
    const {
      strictMode = false,
      includeQuality = true,
      detectLanguages = true,
      analyzeFilename = true,
    } = options

    const contentInfo: ContentInfo = {
      type: ContentType.OTHER,
      tags: [],
    }

    if (!filename) {
      return contentInfo
    }

    const name = filename.toLowerCase()
    const extension = this.extractExtension(filename)

    // Analyze the filename if enabled
    if (analyzeFilename) {
      this.analyzeFilenamePatterns(name, contentInfo)
    }

    // Check file extension
    this.analyzeFileExtension(extension, contentInfo)

    // Additional metadata analysis
    if (metadata) {
      this.analyzeMetadata(metadata, contentInfo)
    }

    // Extract quality information if enabled
    if (includeQuality) {
      this.extractQualityInfo(name, contentInfo)
    }

    // Extract language information if enabled
    if (detectLanguages) {
      this.extractLanguageInfo(name, contentInfo)
    }

    // Apply strict mode filtering
    if (strictMode) {
      this.applyStrictMode(contentInfo)
    }

    return contentInfo
  }

  /**
   * Batch detect content types
   */
  static detectContentBatch(
    items: Array<{ filename: string; metadata?: Partial<FileMetadata> }>,
    options: ContentDetectionOptions = {}
  ): Array<{ filename: string; content: ContentInfo }> {
    return items.map((item) => ({
      filename: item.filename,
      content: this.detectContent(item.filename, item.metadata, options),
    }))
  }

  private static extractExtension(filename: string): string {
    const match = filename.match(/\.([^.]+)$/)
    return match ? match[1].toLowerCase() : ''
  }

  private static analyzeFilenamePatterns(
    filename: string,
    contentInfo: ContentInfo
  ): void {
    // Check for TV shows first (most specific patterns)
    for (const pattern of this.TV_SHOW_PATTERNS) {
      const match = filename.match(pattern)
      if (match) {
        contentInfo.type = ContentType.TV_SHOW
        if (match[1] && match[2]) {
          contentInfo.season = parseInt(match[1])
          contentInfo.episode = parseInt(match[2])
        }
        return
      }
    }

    // Check for movies
    const yearMatch = filename.match(/\b(19|20)\d{2}\b/)
    const hasMovieIndicators = this.MOVIE_PATTERNS.some((pattern) =>
      pattern.test(filename)
    )
    const hasVideoExtension = this.VIDEO_EXTENSIONS.includes(
      this.extractExtension(filename)
    )

    if ((yearMatch || hasMovieIndicators) && hasVideoExtension) {
      contentInfo.type = ContentType.MOVIE
      if (yearMatch) {
        contentInfo.year = parseInt(yearMatch[0])
      }
      return
    }

    // Check for other content types
    if (this.GAME_PATTERNS.some((pattern) => pattern.test(filename))) {
      contentInfo.type = ContentType.GAME
    } else if (
      this.SOFTWARE_PATTERNS.some((pattern) => pattern.test(filename))
    ) {
      contentInfo.type = ContentType.SOFTWARE
    } else if (this.EBOOK_PATTERNS.some((pattern) => pattern.test(filename))) {
      contentInfo.type = ContentType.EBOOK
    } else if (this.MUSIC_PATTERNS.some((pattern) => pattern.test(filename))) {
      contentInfo.type = ContentType.MUSIC
    } else if (
      this.ARCHIVE_PATTERNS.some((pattern) => pattern.test(filename))
    ) {
      contentInfo.type = ContentType.ARCHIVE
    }
  }

  private static analyzeFileExtension(
    extension: string,
    contentInfo: ContentInfo
  ): void {
    if (
      this.VIDEO_EXTENSIONS.includes(extension) &&
      contentInfo.type === ContentType.OTHER
    ) {
      contentInfo.type = ContentType.VIDEO
    } else if (
      this.AUDIO_EXTENSIONS.includes(extension) &&
      contentInfo.type === ContentType.OTHER
    ) {
      contentInfo.type = ContentType.AUDIO
    } else if (
      this.IMAGE_EXTENSIONS.includes(extension) &&
      contentInfo.type === ContentType.OTHER
    ) {
      contentInfo.type = ContentType.IMAGE
    } else if (
      this.DOCUMENT_EXTENSIONS.includes(extension) &&
      contentInfo.type === ContentType.OTHER
    ) {
      contentInfo.type = ContentType.DOCUMENT
    }
  }

  private static analyzeMetadata(
    metadata: Partial<FileMetadata>,
    contentInfo: ContentInfo
  ): void {
    // Analyze properties if available
    if (metadata.properties) {
      const props = metadata.properties

      // Check for Real-Debrid host information
      if (props.host) {
        contentInfo.tags.push(`host:${props.host}`)
      }

      // Check for file size to determine likely content
      if (metadata.size) {
        const sizeGB = metadata.size / (1024 * 1024 * 1024)

        if (
          sizeGB > 1 &&
          sizeGB < 50 &&
          contentInfo.type === ContentType.VIDEO
        ) {
          contentInfo.tags.push('feature-length')
        } else if (sizeGB > 10 && contentInfo.type === ContentType.GAME) {
          contentInfo.tags.push('large-game')
        }
      }
    }
  }

  private static extractQualityInfo(
    filename: string,
    contentInfo: ContentInfo
  ): void {
    // Extract resolution
    for (const pattern of this.QUALITY_PATTERNS.resolution) {
      const match = filename.match(pattern)
      if (match) {
        contentInfo.resolution = match[1]
        break
      }
    }

    // Extract quality indicators
    for (const pattern of this.QUALITY_PATTERNS.quality) {
      const match = filename.match(pattern)
      if (match) {
        contentInfo.quality = match[1]
        break
      }
    }

    // Extract codec
    for (const pattern of this.QUALITY_PATTERNS.codec) {
      const match = filename.match(pattern)
      if (match) {
        contentInfo.codec = match[1]
        break
      }
    }

    // Extract source
    for (const pattern of this.QUALITY_PATTERNS.source) {
      const match = filename.match(pattern)
      if (match) {
        contentInfo.source = match[1]
        break
      }
    }
  }

  private static extractLanguageInfo(
    filename: string,
    contentInfo: ContentInfo
  ): void {
    for (const pattern of this.LANGUAGE_PATTERNS) {
      const match = filename.match(pattern)
      if (match) {
        contentInfo.language = match[1]
        break
      }
    }
  }

  private static applyStrictMode(contentInfo: ContentInfo): void {
    // In strict mode, we only keep high-confidence detections
    const strictTypes = [
      ContentType.MOVIE,
      ContentType.TV_SHOW,
      ContentType.GAME,
      ContentType.SOFTWARE,
    ]

    if (!strictTypes.includes(contentInfo.type)) {
      contentInfo.type = ContentType.OTHER
    }

    // Only keep quality info if we're confident about it
    if (!contentInfo.resolution && !contentInfo.quality) {
      delete contentInfo.quality
      delete contentInfo.resolution
      delete contentInfo.codec
      delete contentInfo.source
    }
  }
}

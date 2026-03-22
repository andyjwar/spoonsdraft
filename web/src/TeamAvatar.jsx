import { useState, useMemo } from 'react'

const RAW_BASE = `${import.meta.env.BASE_URL}team-logos/`
const WEB_BASE = `${import.meta.env.BASE_URL}team-logos-web/`
const LOGO_EXTS = ['png', 'PNG', 'jpg', 'JPG', 'jpeg', 'JPEG', 'webp', 'WEBP']

function buildSrcList(entryId, logoMap) {
  const key = String(entryId)
  const mapped = logoMap[key]
  if (mapped) return [`${RAW_BASE}${mapped}`]
  const list = [`${WEB_BASE}${entryId}.png`]
  for (const ext of LOGO_EXTS) {
    list.push(`${RAW_BASE}${entryId}.${ext}`)
  }
  return list
}

const KIT_TEXT_SHADOW =
  '0 0 4px rgba(0, 0, 0, 0.75), 0 1px 2px rgba(0, 0, 0, 0.55)'

/**
 * Eight default “shirt” looks for an 8-team league (slot = stable hash % 8).
 * Order: solid blue, blue/white stripes, matte red, forest green, black/white stripes,
 * rust orange, yellow/green stripes, aubergine.
 */
const KIT_STYLES = [
  {
    style: {
      background: '#1d4ed8',
      color: '#f8fafc',
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)',
    },
  },
  {
    style: {
      backgroundColor: '#1e3a8a',
      backgroundImage:
        'repeating-linear-gradient(90deg, #f1f5f9 0 5px, #1e40af 5px 10px)',
      color: '#ffffff',
      textShadow: KIT_TEXT_SHADOW,
    },
  },
  {
    style: {
      background: '#9f1b2e',
      color: '#fafafa',
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
    },
  },
  {
    style: {
      background: '#14532d',
      color: '#f0fdf4',
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)',
    },
  },
  {
    style: {
      backgroundColor: '#0a0a0a',
      backgroundImage:
        'repeating-linear-gradient(90deg, #fafafa 0 4px, #171717 4px 8px)',
      color: '#ffffff',
      textShadow: KIT_TEXT_SHADOW,
    },
  },
  {
    style: {
      background: '#c2410c',
      color: '#fff7ed',
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)',
    },
  },
  {
    style: {
      backgroundColor: '#14532d',
      backgroundImage:
        'repeating-linear-gradient(90deg, #eab308 0 4px, #166534 4px 8px)',
      color: '#ffffff',
      textShadow: KIT_TEXT_SHADOW,
    },
  },
  {
    style: {
      background: '#4a1d4d',
      color: '#faf5ff',
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
    },
  },
]

function fnv1a32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Pick one of eight kits — FNV + golden-ratio mix spreads sequential entry ids. */
function kitStyleIndex(entryId, name) {
  const key = `${entryId == null ? '' : String(entryId)}\u{1e}${name == null ? '' : String(name)}`
  const h = fnv1a32(key)
  const mixed = Math.imul(h, 2654435769) >>> 0
  return mixed % KIT_STYLES.length
}

function InitialsBadge({ name, entryId, size }) {
  const initial = (name || '?').slice(0, 2).toUpperCase()
  const kit = KIT_STYLES[kitStyleIndex(entryId, name)].style
  return (
    <span
      className={`team-badge team-badge--${size}`}
      style={kit}
      aria-hidden
    >
      {initial}
    </span>
  )
}

/**
 * Prefers pre-sized assets in team-logos-web/ (run: npm run dev / npm run build).
 */
export function TeamAvatar({ entryId, name, size = 'md', logoMap = {} }) {
  const srcList = useMemo(() => buildSrcList(entryId, logoMap), [entryId, logoMap])
  const [idx, setIdx] = useState(0)
  const [showInitials, setShowInitials] = useState(false)

  if (entryId == null || showInitials) {
    return <InitialsBadge name={name} entryId={entryId} size={size} />
  }

  const src = srcList[idx]
  if (!src) {
    return <InitialsBadge name={name} entryId={entryId} size={size} />
  }

  const px = size === 'sm' ? 28 : size === 'lg' ? 64 : 36
  return (
    <img
      className={`team-avatar team-avatar--${size}`}
      src={src}
      alt=""
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (idx < srcList.length - 1) setIdx((i) => i + 1)
        else setShowInitials(true)
      }}
    />
  )
}

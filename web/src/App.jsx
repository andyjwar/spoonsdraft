import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from 'react'
import {
  LEAGUE_TITLE,
  LEAGUE_TITLE_ABBR,
  showDashboardHall,
  showDashboardPlayoff,
  showDashboardTrades,
} from './siteFeatures'
import {
  useLeagueData,
  FORM_LAST_N,
  FORM_STRIP_N,
  WIN_MARGIN_BUCKET_KEYS,
} from './useLeagueData'
import { TeamAvatar } from './TeamAvatar'
import { LiveScores } from './LiveScores'
import { PlayOffBracket } from './PlayOffBracket'
import './App.css'

/** Sorted ascending unique GWs from schedule rows (1–38). */
function sortedUniqueGwFromMatches(matches, predicate) {
  const s = new Set()
  for (const m of matches ?? []) {
    if (!predicate(m)) continue
    const g = Number(m.event)
    if (Number.isFinite(g) && g >= 1 && g <= 38) s.add(g)
  }
  return [...s].sort((a, b) => a - b)
}
const FORM_STRIP_DESKTOP_N = 7

function useFormStripDisplayCount() {
  const subscribe = useCallback((onChange) => {
    if (typeof window === 'undefined') return () => {}
    const mq = window.matchMedia('(max-width: 560px)')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return FORM_STRIP_DESKTOP_N
    return window.matchMedia('(max-width: 560px)').matches
      ? FORM_STRIP_N
      : FORM_STRIP_DESKTOP_N
  }, [])
  return useSyncExternalStore(subscribe, getSnapshot, () => FORM_STRIP_DESKTOP_N)
}

/** Past champions — optional `entryId` (team-logos-web), or `bannerImage` (fills entire banner sheet) */
const HALL_OF_CHAMPIONS = [
  {
    season: '2020-21',
    team: 'Essex Ratigans',
    bannerImage: 'hall-champions/essex-ratigans.png',
  },
  {
    season: '2021-22',
    team: 'Dalston Bellsprouts',
    bannerImage: 'hall-champions/dalston-bellsprouts.png',
  },
  {
    season: '2022-23',
    team: 'Dalston Benoit',
    bannerImage: 'hall-champions/dalston-benoit.png',
  },
  {
    season: '2023-24',
    team: 'Toronto Wiggum',
    bannerImage: 'hall-champions/toronto-wiggum.png',
  },
  {
    season: '2024-25',
    team: 'Soul Ze Moles',
    bannerImage: 'hall-champions/soul-ze-moles.png',
  },
]

function HallOfChampions({ logoMap, kitIndexByEntry = {} }) {
  return (
    <section
      className="tile hall-of-champions"
      aria-labelledby="hall-champions-heading"
    >
      <h2
        id="hall-champions-heading"
        className="tile-title tile-title--sm hall-of-champions__main-title"
      >
        TCLOT Hall of Champions
      </h2>
      <div className="hall-of-champions__rule" aria-hidden="true" />
      <ul className="hall-of-champions__list">
        {HALL_OF_CHAMPIONS.map((row) => (
          <li key={row.season} className="hall-champion-banner">
            <div className="hall-champion-banner__rigging" aria-hidden="true">
              <div className="hall-champion-banner__rod" />
              <div className="hall-champion-banner__cords">
                <span className="hall-champion-banner__cord" />
                <span className="hall-champion-banner__cord" />
              </div>
            </div>
            <div
              className={
                'hall-champion-banner__sheet' +
                (row.bannerImage
                  ? ' hall-champion-banner__sheet--fullbleed'
                  : '')
              }
            >
              {row.bannerImage ? (
                <img
                  className="hall-champion-banner__fullbleed-img"
                  src={`${import.meta.env.BASE_URL}${row.bannerImage}`}
                  alt={`${row.team}, ${row.season} season champion`}
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
              <div className="hall-champion-banner__sheet-content">
                <p className="hall-champion-banner__team">{row.team}</p>
                {row.bannerImage ? (
                  <div
                    className="hall-champion-banner__sheet-spacer"
                    aria-hidden="true"
                  />
                ) : (
                  <div className="hall-champion-banner__avatar">
                    <TeamAvatar
                      entryId={row.entryId ?? null}
                      name={row.team}
                      size="lg"
                      logoMap={logoMap ?? {}}
                      kitIndexByEntry={kitIndexByEntry}
                    />
                  </div>
                )}
                <p className="hall-champion-banner__season">{row.season} season</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FormCircles({ form }) {
  return (
    <div className="form-circles" aria-label="Last matches form">
      {form.map((r, i) => {
        if (r == null) {
          return <span key={i} className="form-dot form-dot--empty" aria-label="No result" />
        }
        const result = typeof r === 'object' ? r.result : r
        const tooltip =
          typeof r === 'object' && r.opponentName
            ? `GW${r.event} · ${r.scoreStr} · vs ${r.opponentName}`
            : result === 'W' ? 'Win' : result === 'L' ? 'Loss' : 'Draw'
        return (
          <span
            key={i}
            className={`form-dot form-dot--${result === 'W' ? 'win' : result === 'L' ? 'loss' : 'draw'}`}
            data-tooltip={tooltip}
            aria-label={tooltip}
          >
            {result}
          </span>
        )
      })}
    </div>
  )
}

function PlayerKit({ shirtUrl, badgeUrl, teamShort }) {
  const urls = [shirtUrl, badgeUrl].filter(Boolean)
  const [u, setU] = useState(0)
  if (u >= urls.length) {
    return (
      <span className="pl-kit-fallback" title={teamShort}>
        {teamShort?.slice(0, 3) ?? '?'}
      </span>
    )
  }
  return (
    <img
      className={u === 0 ? 'pl-kit-shirt' : 'pl-kit-badge'}
      src={urls[u]}
      alt=""
      loading="lazy"
      onError={() => setU((x) => x + 1)}
    />
  )
}

/** One player row inside a trade tile (offered or received leg). */
function TradePlayerLine({ leg }) {
  if (!leg) return null
  return (
    <div className="trade-player-line">
      <PlayerKit
        shirtUrl={leg.gained.shirtUrl}
        badgeUrl={leg.gained.badgeUrl}
        teamShort={leg.gained.teamShort}
      />
      <div className="trade-player-line__text">
        <span className="trade-player-line__name">{leg.gained.web_name}</span>
        <span className="trade-player-line__club muted">{leg.gained.teamShort}</span>
        <span className="trade-player-line__pts tabular">
          <strong>{leg.totalPoints}</strong> pts · GW {leg.gwRangeLabel}
          {leg.stillOnTeam ? ' · on squad' : ''}
        </span>
      </div>
    </div>
  )
}

/** Single processed-trade card (GW, date, managers, pairs + tenure points). */
function TradeCardArticle({ trade, teamLogoMap, kitIndexByEntry = {} }) {
  const pairs = trade.pairs || []
  const offeredPtsTotal = pairs.reduce(
    (s, p) => s + (Number(p.offeredLeg?.totalPoints) || 0),
    0,
  )
  const receivedPtsTotal = pairs.reduce(
    (s, p) => s + (Number(p.receivedLeg?.totalPoints) || 0),
    0,
  )
  const multiPair = pairs.length > 1
  return (
    <article className="trade-card">
      <div className="trade-card__head">
        {trade.event != null ? (
          <span className="league-pill league-pill--sm">GW {trade.event}</span>
        ) : null}
        {trade.responseTime ? (
          <time className="muted trade-card__date" dateTime={trade.responseTime}>
            {new Date(trade.responseTime).toLocaleDateString(undefined, {
              dateStyle: 'medium',
            })}
          </time>
        ) : null}
      </div>
      <div
        className="trade-card__teams-row"
        aria-label="Teams and cumulative tenure points from this trade"
      >
        <div className="trade-card__mgr trade-card__mgr--left">
          <TeamAvatar
            entryId={trade.offeredLeagueEntry ?? trade.offeredFplEntry}
            name={trade.offeredTeamName}
            size="sm"
            logoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
          />
          <span className="trade-card__mgr-name">{trade.offeredTeamName}</span>
        </div>
        <div
          className="trade-card__pts-summary trade-card__pts-summary--center"
          aria-label="Total tenure points for players each side acquired in this trade"
        >
          <span className="trade-card__pts-summary-side tabular">
            <strong>{offeredPtsTotal}</strong>
            <span className="muted trade-card__pts-summary-label"> pts</span>
          </span>
          <span className="trade-card__vs trade-card__vs--summary" aria-hidden>
            ·
          </span>
          <span className="trade-card__pts-summary-side tabular">
            <strong>{receivedPtsTotal}</strong>
            <span className="muted trade-card__pts-summary-label"> pts</span>
          </span>
        </div>
        <div className="trade-card__mgr trade-card__mgr--right">
          <TeamAvatar
            entryId={trade.receivedLeagueEntry ?? trade.receivedFplEntry}
            name={trade.receivedTeamName}
            size="sm"
            logoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
          />
          <span className="trade-card__mgr-name">{trade.receivedTeamName}</span>
        </div>
      </div>
      <div className="trade-pairs-grid">
        {multiPair ? (
          <div className="trade-pair trade-pair--bundled">
            <div className="trade-player-tile trade-player-tile--group">
              {pairs.map((pair, pidx) => (
                <TradePlayerLine key={`o-${pidx}`} leg={pair.offeredLeg} />
              ))}
            </div>
            <span className="trade-pair__swap" aria-hidden="true" title="Swap">
              ↔
            </span>
            <div className="trade-player-tile trade-player-tile--group">
              {pairs.map((pair, pidx) => (
                <TradePlayerLine key={`r-${pidx}`} leg={pair.receivedLeg} />
              ))}
            </div>
          </div>
        ) : (
          pairs.map((pair, pidx) => (
            <div key={pidx} className="trade-pair">
              <div className="trade-player-tile">
                <TradePlayerLine leg={pair.offeredLeg} />
              </div>
              <span
                className="trade-pair__swap"
                aria-hidden="true"
                title="Swap"
              >
                ↔
              </span>
              <div className="trade-player-tile">
                <TradePlayerLine leg={pair.receivedLeg} />
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  )
}

/** Match `max-width: 1080px` nav breakpoint — phones / narrow tablets default to Live. */
function initialDashboardViewForViewport() {
  if (typeof window === 'undefined') return 'standings'
  return window.matchMedia('(max-width: 1080px)').matches ? 'live' : 'standings'
}

const STANDINGS_SORT_KEYS = /** @type {const} */ (['gf', 'ga', 'gd', 'total'])

/** Sortable header for For / Faced / GD / PTS — `null` sortState = league order. */
function StandingsSortTh({ columnKey, sortState, onSort, label, title, className }) {
  const isPts = columnKey === 'total'
  const active = sortState?.key === columnKey
  const dir = active ? sortState.dir : null
  /** League table is ordered by points high → low; show green ↓ on PTS when using that order */
  const ptsLeagueDefault = isPts && sortState === null

  let arrowGlyph = '↕'
  let arrowClass = 'standings-sort-arrow'
  if (isPts) {
    if (ptsLeagueDefault) {
      arrowGlyph = '↓'
      arrowClass += ' standings-sort-arrow--active standings-sort-arrow--desc'
    } else if (active) {
      arrowGlyph = dir === 'asc' ? '↑' : '↓'
      arrowClass += ` standings-sort-arrow--active standings-sort-arrow--${dir}`
    }
  } else if (active) {
    arrowGlyph = dir === 'asc' ? '↑' : '↓'
    arrowClass += ` standings-sort-arrow--active standings-sort-arrow--${dir}`
  }

  const ariaSort =
    ptsLeagueDefault
      ? 'descending'
      : active
        ? dir === 'asc'
          ? 'ascending'
          : 'descending'
        : undefined

  const ariaLabel = isPts
    ? ptsLeagueDefault
      ? 'League order (points high to low). Click to sort by points.'
      : active
        ? `PTS: sorted ${dir === 'desc' ? 'high to low' : 'low to high'}. Click to reverse.`
        : 'Sort by points'
    : active
      ? `${label}: sorted ${dir === 'desc' ? 'high to low' : 'low to high'}. Click to reverse.`
      : `Sort by ${label}`

  return (
    <th scope="col" className={className} title={title}>
      <button
        type="button"
        className="standings-sort-btn"
        onClick={() => onSort(columnKey)}
        aria-sort={ariaSort}
        aria-label={ariaLabel}
      >
        <span className="standings-sort-btn__label">{label}</span>
        <span className={arrowClass} aria-hidden>
          {arrowGlyph}
        </span>
      </button>
    </th>
  )
}

function App() {
  const { data, error, loading } = useLeagueData()
  const {
    tableRows = [],
    teamFormStripByEntry = {},
    teamsForFormSelect = [],
    nextEvent = null,
    previousGameweek = null,
    isSampleData = false,
    fetchFailedDemo = false,
    teamLogoMap = {},
    defaultKitIndexByLeagueEntry: kitIndexByEntry = {},
    mostWaiveredPlayers = [],
    pointsAgainstList = [],
    waiverOutPointsByTeam = [],
    waiverInTenureTopRows = [],
    waiverInPointsByTeam = [],
    winMarginBucketRows = [],
    lossMarginBucketRows = [],
    tradesPanelRows = [],
    matches = [],
    waiverOutGwRows = [],
  } = data ?? {}
  const [formTeamId, setFormTeamId] = useState(null)
  const [waiverOutTeamFilter, setWaiverOutTeamFilter] = useState('all')
  const [waiverOutGwFilter, setWaiverOutGwFilter] = useState('all')
  const [waiverGwTableMode, setWaiverGwTableMode] = useState('out')
  const [dashboardView, setDashboardView] = useState(initialDashboardViewForViewport) // standings | playoff | waivers | trades | live | hall
  /** `null` = API league order; otherwise sort by numeric column */
  const [standingsSort, setStandingsSort] = useState(null)
  const [liveGw, setLiveGw] = useState(null)
  /** Draft bootstrap `events.current` — default Live tab GW when user has not chosen one. */
  const [fplLiveLandingGw, setFplLiveLandingGw] = useState(null)
  const [waiverGwView, setWaiverGwView] = useState(null)
  const [completeGwView, setCompleteGwView] = useState(null)
  const [futureGwView, setFutureGwView] = useState(null)
  const formStripDisplayCount = useFormStripDisplayCount()

  const onBootstrapLiveMeta = useCallback((meta) => {
    setFplLiveLandingGw(meta?.currentGw ?? null)
  }, [])

  useEffect(() => {
    if (dashboardView === 'trades' && !showDashboardTrades) {
      setDashboardView('live')
      return
    }
    if (dashboardView === 'hall' && !showDashboardHall) {
      setDashboardView('live')
      return
    }
    if (dashboardView === 'playoff' && !showDashboardPlayoff) {
      setDashboardView('live')
    }
  }, [
    dashboardView,
    showDashboardTrades,
    showDashboardHall,
    showDashboardPlayoff,
  ])

  /** drops-gw-live rows: waivers only (excludes free-agency rows used in Latest Waivers). */
  const waiverOutRowsWaiverOnly = useMemo(
    () => (data?.waiverOutGwRows ?? []).filter((r) => r.transactionKind !== 'f'),
    [data?.waiverOutGwRows],
  )

  const waiverOutTeamOptions = useMemo(() => {
    const rows = waiverOutRowsWaiverOnly
    const m = new Map()
    for (const r of rows) {
      if (r.entry != null && !m.has(r.entry)) {
        m.set(r.entry, r.teamName ?? `Team ${r.entry}`)
      }
    }
    return [...m.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])))
  }, [waiverOutRowsWaiverOnly])

  const waiverOutGwOptions = useMemo(() => {
    const rows = waiverOutRowsWaiverOnly
    const s = new Set(rows.map((r) => r.gameweek).filter((g) => g != null))
    return [...s].sort((a, b) => a - b)
  }, [waiverOutRowsWaiverOnly])

  const filteredWaiverOutRows = useMemo(() => {
    const rows = waiverOutRowsWaiverOnly
    return rows.filter((r) => {
      if (
        waiverOutTeamFilter !== 'all' &&
        Number(r.entry) !== Number(waiverOutTeamFilter)
      ) {
        return false
      }
      if (
        waiverOutGwFilter !== 'all' &&
        Number(r.gameweek) !== Number(waiverOutGwFilter)
      ) {
        return false
      }
      return true
    })
  }, [waiverOutRowsWaiverOnly, waiverOutTeamFilter, waiverOutGwFilter])

  const waiverOutTeamPointsTotal = useMemo(() => {
    if (waiverOutTeamFilter === 'all') return null
    let sum = 0
    let missing = 0
    for (const r of filteredWaiverOutRows) {
      const v =
        waiverGwTableMode === 'out'
          ? r.droppedPlayerGwPoints
          : r.pickedUpPlayerGwPoints
      if (typeof v === 'number') sum += v
      else missing += 1
    }
    return {
      sum,
      missing,
      rowCount: filteredWaiverOutRows.length,
      mode: waiverGwTableMode,
    }
  }, [filteredWaiverOutRows, waiverOutTeamFilter, waiverGwTableMode])

  const rankByEntryId = useMemo(() => {
    const m = new Map()
    for (const row of data?.tableRows ?? []) {
      m.set(row.league_entry, row.rank)
    }
    return m
  }, [data?.tableRows])

  /** First 4 teams left of title, next/last 4 right (no overlap; >8 teams → first + last 4). */
  const heroLogoSides = useMemo(() => {
    const teams = data?.teamsForFormSelect ?? []
    const left = teams.slice(0, 4)
    const right =
      teams.length > 8 ? teams.slice(-4) : teams.slice(4, 8)
    return { left, right }
  }, [data?.teamsForFormSelect])

  /** GWs present in waiver / FA analytics (drops-gw-live). */
  const processedWaiverGws = useMemo(() => {
    const s = new Set()
    for (const r of waiverOutGwRows) {
      const g = Number(r.gameweek)
      if (Number.isFinite(g) && g >= 1 && g <= 38) s.add(g)
    }
    return [...s].sort((a, b) => a - b)
  }, [waiverOutGwRows])

  /** GWs with at least one finished H2H in league schedule. */
  const processedCompleteGws = useMemo(
    () => sortedUniqueGwFromMatches(matches, (m) => m.finished),
    [matches],
  )

  /** GWs with at least one unfinished H2H in league schedule. */
  const processedFutureGws = useMemo(
    () => sortedUniqueGwFromMatches(matches, (m) => !m.finished),
    [matches],
  )

  const firstUpcomingGw = useMemo(() => {
    const ev = (matches ?? [])
      .filter((m) => !m.finished)
      .map((m) => Number(m.event))
      .filter(Number.isFinite)
    if (!ev.length) return null
    return Math.min(...ev)
  }, [matches])

  const latestProcessedWaiverGw =
    processedWaiverGws.length > 0
      ? processedWaiverGws[processedWaiverGws.length - 1]
      : null
  const latestProcessedCompleteGw =
    processedCompleteGws.length > 0
      ? processedCompleteGws[processedCompleteGws.length - 1]
      : null
  const waiverGwEffective = (() => {
    const fallback =
      latestProcessedWaiverGw ?? previousGameweek ?? 1
    const raw = waiverGwView ?? fallback
    if (
      processedWaiverGws.length > 0 &&
      !processedWaiverGws.includes(raw)
    ) {
      return latestProcessedWaiverGw ?? processedWaiverGws[0]
    }
    return raw
  })()

  const completeGwEffective = (() => {
    const fallback =
      latestProcessedCompleteGw ?? previousGameweek ?? 1
    const raw = completeGwView ?? fallback
    if (
      processedCompleteGws.length > 0 &&
      !processedCompleteGws.includes(raw)
    ) {
      return latestProcessedCompleteGw ?? processedCompleteGws[0]
    }
    return raw
  })()

  const futureGwEffective = (() => {
    /** Earliest GW with an unfinished fixture — “next” gameweek, not the last in the schedule */
    const nextFutureGw =
      firstUpcomingGw ??
      (processedFutureGws.length > 0 ? processedFutureGws[0] : null)
    const fallback = nextFutureGw ?? nextEvent ?? 1
    const raw = futureGwView ?? fallback
    if (
      processedFutureGws.length > 0 &&
      !processedFutureGws.includes(raw)
    ) {
      return processedFutureGws[0] ?? nextFutureGw ?? 1
    }
    return raw
  })()

  const entryNameByLeagueId = useMemo(() => {
    const m = new Map()
    for (const r of tableRows ?? []) {
      m.set(r.league_entry, r.teamName)
    }
    return m
  }, [tableRows])

  const handleStandingsSort = useCallback((columnKey) => {
    if (!STANDINGS_SORT_KEYS.includes(columnKey)) return
    setStandingsSort((prev) => {
      if (prev?.key === columnKey) {
        return { key: columnKey, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      }
      return { key: columnKey, dir: 'desc' }
    })
  }, [])

  const sortedStandingsRows = useMemo(() => {
    if (!standingsSort) return tableRows
    const { key, dir } = standingsSort
    const out = [...tableRows]
    out.sort((a, b) => {
      const va = Number(a[key])
      const vb = Number(b[key])
      if (!Number.isFinite(va) && !Number.isFinite(vb)) return 0
      if (!Number.isFinite(va)) return 1
      if (!Number.isFinite(vb)) return -1
      const cmp = dir === 'desc' ? vb - va : va - vb
      if (cmp !== 0) return cmp
      return Number(a.rank) - Number(b.rank)
    })
    return out
  }, [tableRows, standingsSort])

  const completeGwFixtures = useMemo(() => {
    const gw = Number(completeGwEffective)
    return (matches ?? [])
      .filter((m) => m.finished && Number(m.event) === gw)
      .map((m) => ({
        event: m.event,
        homeId: m.league_entry_1,
        awayId: m.league_entry_2,
        homeName: entryNameByLeagueId.get(m.league_entry_1) ?? '?',
        awayName: entryNameByLeagueId.get(m.league_entry_2) ?? '?',
        homePts: m.league_entry_1_points,
        awayPts: m.league_entry_2_points,
      }))
  }, [matches, completeGwEffective, entryNameByLeagueId])

  const futureGwFixtures = useMemo(() => {
    const gw = Number(futureGwEffective)
    return (matches ?? [])
      .filter((m) => !m.finished && Number(m.event) === gw)
      .map((m) => ({
        event: m.event,
        homeId: m.league_entry_1,
        awayId: m.league_entry_2,
        homeName: entryNameByLeagueId.get(m.league_entry_1) ?? '?',
        awayName: entryNameByLeagueId.get(m.league_entry_2) ?? '?',
      }))
  }, [matches, futureGwEffective, entryNameByLeagueId])

  const waiversForSelectedGw = useMemo(() => {
    const rows = waiverOutGwRows
    const fplToLeague = new Map()
    for (const t of teamsForFormSelect ?? []) {
      if (t.fplEntryId != null) fplToLeague.set(Number(t.fplEntryId), t.id)
    }
    const gw = Number(waiverGwEffective)
    if (!rows.length || !Number.isFinite(gw)) return { gw: null, groups: [] }
    const inGw = rows.filter((r) => Number(r.gameweek) === gw)
    if (!inGw.length) return { gw, groups: [] }
    const byEntry = new Map()
    for (const r of inGw) {
      const k = r.entry
      if (!byEntry.has(k)) {
        const leagueEntryId = fplToLeague.get(Number(k)) ?? Number(k)
        byEntry.set(k, {
          entry: k,
          leagueEntryId,
          teamName: r.teamName,
          moves: [],
        })
      }
      byEntry.get(k).moves.push(r)
    }
    for (const g of byEntry.values()) {
      g.moves.sort((a, b) => {
        const da = a.added ? Date.parse(a.added) : 0
        const db = b.added ? Date.parse(b.added) : 0
        if (db !== da) return db - da
        return (b.transactionId ?? 0) - (a.transactionId ?? 0)
      })
    }
    const groups = [...byEntry.values()].sort((a, b) =>
      a.teamName.localeCompare(b.teamName, undefined, { sensitivity: 'base' })
    )
    return { gw, groups }
  }, [waiverOutGwRows, teamsForFormSelect, waiverGwEffective])

  const defaultFormEntry = teamsForFormSelect[0]?.id
  const activeFormEntry = formTeamId ?? defaultFormEntry
  const formStripRowsRaw =
    activeFormEntry != null ? teamFormStripByEntry[activeFormEntry] ?? [] : []
  const formStripRows = useMemo(
    () => formStripRowsRaw.slice(-formStripDisplayCount),
    [formStripRowsRaw, formStripDisplayCount],
  )

  if (loading) {
    return (
      <div className="app fotmob">
        <div className="load-screen">Loading league…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="app fotmob">
        <header className="page-header page-header--centered">
          <section className="tile tile--title-banner" aria-label="League">
            <h1 className="page-title-main">
              <span className="page-title-main__abbr">{LEAGUE_TITLE_ABBR}</span>
            </h1>
            <p className="page-title-sub">{LEAGUE_TITLE}</p>
            <p className="brand-sub brand-sub--in-title-tile">FPL Draft · Head-to-head</p>
          </section>
        </header>
        <main className="main-tiles">
          <section className="tile error-tile">
            <p className="error-msg">{error ?? 'No data'}</p>
            <p className="muted">
              Run <code>python3 ingest.py &lt;LEAGUE_ID&gt;</code> then{' '}
              <code>npm run dev</code> to copy data into the site.
            </p>
          </section>
        </main>
      </div>
    )
  }

  /**
   * Live tab GW: explicit pick → FPL official current (from bootstrap) → first unfinished H2H in
   * schedule → last finished — so e.g. GW31 shows while live, not GW30.
   */
  const liveGameweek =
    Number(liveGw ?? fplLiveLandingGw ?? nextEvent ?? previousGameweek ?? 1) || 1

  const renderGwFixture = (fx, i) => {
    const homeRank = rankByEntryId.get(fx.homeId)
    const awayRank = rankByEntryId.get(fx.awayId)
    const homeWin =
      fx.homePts != null && fx.awayPts != null && fx.homePts > fx.awayPts
    const awayWin =
      fx.homePts != null && fx.awayPts != null && fx.awayPts > fx.homePts
    return (
      <li key={`${fx.event}-${fx.homeId}-${fx.awayId}-${i}`} className="gw-fixture-row">
        <div className="gw-fixture-teams">
          <span className="gw-fixture-avatar gw-fixture-avatar--home">
            <TeamAvatar
              entryId={fx.homeId}
              name={fx.homeName}
              size="sm"
              logoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
            />
          </span>
          <span
            className={`gw-fixture-name-cell gw-fixture-name-cell--home${homeWin ? ' gw-fixture-name--winner' : ''}`}
          >
            <span className="gw-fixture-name-text team-name team-name--sidebar">
              {fx.homeName}
            </span>
            {homeRank != null ? (
              <span className="gw-fixture-rank muted"> ({homeRank})</span>
            ) : null}
          </span>
          {fx.homePts != null ? (
            <span className="gw-fixture-score gw-fixture-mid">
              {fx.homePts} – {fx.awayPts}
            </span>
          ) : (
            <span className="gw-fixture-vs gw-fixture-mid">v</span>
          )}
          <span
            className={`gw-fixture-name-cell gw-fixture-name-cell--away${awayWin ? ' gw-fixture-name--winner' : ''}`}
          >
            <span className="gw-fixture-name-text team-name team-name--sidebar">
              {fx.awayName}
            </span>
            {awayRank != null ? (
              <span className="gw-fixture-rank muted"> ({awayRank})</span>
            ) : null}
          </span>
          <span className="gw-fixture-avatar gw-fixture-avatar--away">
            <TeamAvatar
              entryId={fx.awayId}
              name={fx.awayName}
              size="sm"
              logoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
            />
          </span>
        </div>
      </li>
    )
  }

  return (
    <div className="app fotmob">
      <main className="dashboard-layout dashboard-layout--with-nav">
        <div className="dashboard-page-hero">
          <header className="page-header page-header--centered">
            <section
              className="tile tile--title-banner tile--title-with-flank-logos"
              aria-label="League"
            >
              <div className="title-hero-row">
                <div className="title-hero-row__logos title-hero-row__logos--left">
                  {heroLogoSides.left.map((t) => (
                    <div
                      key={t.id}
                      className="title-hero-row__logo-wrap"
                      title={t.teamName}
                    >
                      <TeamAvatar
                        entryId={t.id}
                        name={t.teamName}
                        size="lg"
                        logoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                    </div>
                  ))}
                </div>
                <div className="title-hero-row__title">
                  <h1 className="page-title-main">
                    <span className="page-title-main__abbr">{LEAGUE_TITLE_ABBR}</span>
                  </h1>
                  <p className="page-title-sub">{LEAGUE_TITLE}</p>
                </div>
                <div className="title-hero-row__logos title-hero-row__logos--right">
                  {heroLogoSides.right.map((t) => (
                    <div
                      key={t.id}
                      className="title-hero-row__logo-wrap"
                      title={t.teamName}
                    >
                      <TeamAvatar
                        entryId={t.id}
                        name={t.teamName}
                        size="lg"
                        logoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
            {fetchFailedDemo && (
              <div className="data-banner data-banner--error" role="alert">
                <strong>League file didn’t load</strong> (wrong URL or deploy). Showing demo only.{' '}
                Use <code>https://YOUR_USER.github.io/repo-name/</code> with your real repo name (often
                lowercase). If the repo is <code>you.github.io</code>, use <code>https://you.github.io/</code>{' '}
                — no <code>/repo/</code> path.
              </div>
            )}
            {isSampleData && !fetchFailedDemo && (
              <div className="data-banner" role="status">
                <strong>Demo data</strong> — site owner: add GitHub secret{' '}
                <code>FPL_LEAGUE_ID</code> (your draft league number) under Settings → Secrets, then redeploy.
                Or publish files: <code>python3 ingest.py ID</code>,{' '}
                <code>cd web && npm run publish-real-league</code>, commit{' '}
                <code>web/public/league-data/</code>. ID: <code>draft.premierleague.com/league/YOUR_ID</code>
              </div>
            )}
          </header>
        </div>
        <nav className="dashboard-nav" aria-label="Dashboard sections">
          <button
            type="button"
            className={
              'dashboard-nav__btn' +
              (dashboardView === 'standings' ? ' dashboard-nav__btn--active' : '')
            }
            onClick={() => setDashboardView('standings')}
            aria-current={dashboardView === 'standings' ? 'page' : undefined}
          >
            <span className="dashboard-nav__emoji" aria-hidden="true">
              📈
            </span>
            <span className="dashboard-nav__label">Standings &amp; Form</span>
          </button>
          {showDashboardPlayoff ? (
            <button
              type="button"
              className={
                'dashboard-nav__btn' +
                (dashboardView === 'playoff' ? ' dashboard-nav__btn--active' : '')
              }
              onClick={() => setDashboardView('playoff')}
              aria-current={dashboardView === 'playoff' ? 'page' : undefined}
            >
              <span className="dashboard-nav__emoji" aria-hidden="true">
                🏅
              </span>
              <span className="dashboard-nav__label">Play Off</span>
            </button>
          ) : null}
          <button
            type="button"
            className={
              'dashboard-nav__btn' +
              (dashboardView === 'waivers' ? ' dashboard-nav__btn--active' : '')
            }
            onClick={() => setDashboardView('waivers')}
            aria-current={dashboardView === 'waivers' ? 'page' : undefined}
          >
            <span className="dashboard-nav__emoji" aria-hidden="true">
              🏃
            </span>
            <span className="dashboard-nav__label">Waivers</span>
          </button>
          {showDashboardTrades ? (
            <button
              type="button"
              className={
                'dashboard-nav__btn' +
                (dashboardView === 'trades' ? ' dashboard-nav__btn--active' : '')
              }
              onClick={() => setDashboardView('trades')}
              aria-current={dashboardView === 'trades' ? 'page' : undefined}
            >
              <span className="dashboard-nav__emoji" aria-hidden="true">
                🤝
              </span>
              <span className="dashboard-nav__label">Trades</span>
            </button>
          ) : null}
          {showDashboardHall ? (
            <button
              type="button"
              className={
                'dashboard-nav__btn' +
                (dashboardView === 'hall' ? ' dashboard-nav__btn--active' : '')
              }
              onClick={() => setDashboardView('hall')}
              aria-current={dashboardView === 'hall' ? 'page' : undefined}
            >
              <span className="dashboard-nav__emoji" aria-hidden="true">
                🏆
              </span>
              <span className="dashboard-nav__label">Hall of Champions</span>
            </button>
          ) : null}
          <button
            type="button"
            className={
              'dashboard-nav__btn' +
              (dashboardView === 'live' ? ' dashboard-nav__btn--active' : '')
            }
            onClick={() => setDashboardView('live')}
            aria-current={dashboardView === 'live' ? 'page' : undefined}
          >
            <span className="dashboard-nav__emoji" aria-hidden="true">
              ⚽
            </span>
            <span className="dashboard-nav__label">Live Scoring</span>
          </button>
        </nav>
        <div className="dashboard-content">
          {dashboardView === 'standings' && (
            <>
              <section
                className="tile tile--standings"
                aria-labelledby="standings-heading"
              >
            <div className="tile-head-row tile-head-row--tight">
              <h2 id="standings-heading" className="tile-title tile-title--sm">
                Standings
              </h2>
            </div>
            <div className="table-scroll table-scroll--standings-open">
              <table className="standings-table standings-table--sidebar">
                <thead>
                  <tr>
                    <th className="col-rank">#</th>
                    <th className="col-team">Team</th>
                    <th className="col-num col-pl">PL</th>
                    <th className="col-num col-wdl">W</th>
                    <th className="col-num col-wdl">D</th>
                    <th className="col-num col-wdl">L</th>
                    <StandingsSortTh
                      columnKey="gf"
                      sortState={standingsSort}
                      onSort={handleStandingsSort}
                      label="For"
                      title="Your team’s total FPL points across all H2H gameweeks"
                      className="col-num col-for"
                    />
                    <StandingsSortTh
                      columnKey="ga"
                      sortState={standingsSort}
                      onSort={handleStandingsSort}
                      label="Faced"
                      title="Points against, all H2H gameweeks"
                      className="col-num col-faced"
                    />
                    <StandingsSortTh
                      columnKey="gd"
                      sortState={standingsSort}
                      onSort={handleStandingsSort}
                      label="GD"
                      title="Goal difference (points for minus points against)"
                      className="col-num col-gd"
                    />
                    <StandingsSortTh
                      columnKey="total"
                      sortState={standingsSort}
                      onSort={handleStandingsSort}
                      label="PTS"
                      title="League points (3 / 1 / 0 per H2H)"
                      className="col-num col-pts"
                    />
                    <th
                      className="col-form"
                      title={`Last ${FORM_LAST_N} H2H matches (W / D / L)`}
                    >
                      Form
                    </th>
                    <th className="col-next">Nxt</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStandingsRows.map((row) => {
                    const isLeader = row.rank === 1
                    const rowClass = [
                      isLeader ? 'row-highlight' : '',
                      row.rank === 1 ? 'standings-row--divider-below' : '',
                      row.rank === 8 ? 'standings-row--divider-above standings-row--8th' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <tr key={row.league_entry} className={rowClass || undefined}>
                        <td className="col-rank">
                          {row.rank === 8 ? (
                            <span role="img" className="standings-rank-8" aria-label="8">
                              🧩
                            </span>
                          ) : (
                            row.rank
                          )}
                        </td>
                        <td className="col-team">
                          <span className="team-cell">
                            <TeamAvatar
                              entryId={row.league_entry}
                              name={row.teamName}
                              size="sm"
                              logoMap={teamLogoMap}
                              kitIndexByEntry={kitIndexByEntry}
                            />
                            <span className="team-name team-name--sidebar">{row.teamName}</span>
                          </span>
                        </td>
                        <td className="col-num col-pl">{row.pl}</td>
                        <td className="col-num col-wdl">{row.matches_won}</td>
                        <td className="col-num col-wdl">{row.matches_drawn}</td>
                        <td className="col-num col-wdl">{row.matches_lost}</td>
                        <td className="col-num col-for tabular" title="Your points for, all GWs">
                          {row.gf}
                        </td>
                        <td className="col-num col-faced tabular">
                          {row.ga}
                        </td>
                        <td className="col-num col-gd tabular">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                        <td className="col-num col-pts tabular">
                          <strong>{row.total}</strong>
                        </td>
                        <td className="col-form">
                          <FormCircles form={row.form} />
                        </td>
                        <td className="col-next">
                          {row.next ? (
                            <TeamAvatar
                              entryId={row.next.id}
                              name={row.next.name}
                              size="sm"
                              logoMap={teamLogoMap}
                              kitIndexByEntry={kitIndexByEntry}
                            />
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="table-foot muted standings-landscape-hint">
              On mobile, turn your device to landscape for the full table.
            </p>
          </section>

              <div className="dashboard-stack">
                <div className="dashboard-gw-two">
                  <section className="tile tile--compact">
                    <div className="tile-head-row tile-head-row--tight">
                      <h2 className="tile-title tile-title--sm tile-title--with-select">
                        <span className="tile-title__text">Complete game weeks</span>
                        {processedCompleteGws.length > 0 ? (
                          <select
                            className="tile-gw-select tile-gw-select--inline"
                            aria-label="Complete gameweek"
                            value={completeGwEffective}
                            onChange={(e) => setCompleteGwView(Number(e.target.value))}
                          >
                            {processedCompleteGws.map((gw) => (
                              <option key={gw} value={gw}>
                                GW {gw}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </h2>
                    </div>
                    {completeGwFixtures?.length ? (
                      <ul className="gw-fixture-list gw-fixture-list--tight">
                        {completeGwFixtures.map(renderGwFixture)}
                      </ul>
                    ) : (
                      <p className="muted muted--tight">No finished matches in this gameweek.</p>
                    )}
                  </section>

                  <section className="tile tile--compact">
                    <div className="tile-head-row tile-head-row--tight">
                      <h2 className="tile-title tile-title--sm tile-title--with-select">
                        <span className="tile-title__text">Future Game Weeks</span>
                        {processedFutureGws.length > 0 ? (
                          <select
                            className="tile-gw-select tile-gw-select--inline"
                            aria-label="Future gameweek"
                            value={futureGwEffective}
                            onChange={(e) => setFutureGwView(Number(e.target.value))}
                          >
                            {processedFutureGws.map((gw) => (
                              <option key={gw} value={gw}>
                                GW {gw}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </h2>
                    </div>
                    {futureGwFixtures?.length ? (
                      <ul className="gw-fixture-list gw-fixture-list--tight">
                        {futureGwFixtures.map((fx, i) => renderGwFixture(fx, i))}
                      </ul>
                    ) : (
                      <p className="muted muted--tight">No upcoming fixtures in data for this gameweek.</p>
                    )}
                  </section>
                </div>

                <section className="tile tile--compact tile--team-form">
            <h2 className="tile-title tile-title--sm">Team form</h2>
            <div className="form-team-toolbar form-team-toolbar--full">
              <div className="form-team-picker form-team-picker--full">
                <span className="form-team-picker__glyph" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <select
                  id="form-team-select"
                  className="form-team-select"
                  aria-label="Team for form strip"
                  value={activeFormEntry ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setFormTeamId(v === '' ? null : Number(v))
                  }}
                >
                  {teamsForFormSelect.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.teamName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-strip form-strip--tight">
              {formStripRows.length ? (
                formStripRows.map((row, i) => (
                  <div key={`${row.event}-${i}`} className="form-strip__item">
                    <div
                      className={`form-score form-score--${row.result === 'W' ? 'win' : row.result === 'L' ? 'loss' : 'draw'}`}
                    >
                      {row.scoreStr}
                    </div>
                    <span className="form-strip__opp" title={row.opponentName}>
                      <TeamAvatar
                        entryId={row.opponentEntryId}
                        name={row.opponentName}
                        size="sm"
                        logoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted">No finished matches yet.</p>
              )}
            </div>
          </section>

          <section className="tile tile--compact" aria-labelledby="points-against-heading">
            <div className="tile-head-row tile-head-row--tight">
              <h2 id="points-against-heading" className="tile-title tile-title--sm">
                Points against
              </h2>
            </div>
            {pointsAgainstList?.length ? (
              <ol className="pa-list">
                {pointsAgainstList.map((row, i) => (
                  <li key={row.league_entry} className="pa-row">
                    <span className="pa-rank">{i + 1}</span>
                    <TeamAvatar
                      entryId={row.league_entry}
                      name={row.teamName}
                      size="sm"
                      logoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                    />
                    <span className="pa-team">{row.teamName}</span>
                    <span className="pa-value tabular">{row.pointsAgainst}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted muted--tight">No finished matches yet.</p>
            )}
          </section>

          <section
            className="tile tile--compact"
            aria-labelledby="win-margin-buckets-heading"
          >
            <h2 id="win-margin-buckets-heading" className="tile-title tile-title--sm">
              Wins by margin
            </h2>
            {winMarginBucketRows?.some((r) => r.totalWins > 0) ? (
              <div className="table-scroll table-scroll--win-margin">
                <table className="win-margin-table">
                  <thead>
                    <tr>
                      <th scope="col" className="win-margin-table__team">
                        Team
                      </th>
                      {WIN_MARGIN_BUCKET_KEYS.map((k) => (
                        <th
                          key={k}
                          scope="col"
                          className="win-margin-table__n tabular"
                          title={
                            k === '21+'
                              ? 'Won by 21 or more'
                              : k.includes('-')
                                ? `Won by ${k.replace('-', '–')} pts`
                                : `Won by exactly ${k}`
                          }
                        >
                          {k}
                        </th>
                      ))}
                      <th scope="col" className="win-margin-table__sum tabular" title="Total wins">
                        Σ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {winMarginBucketRows.map((row) => (
                      <tr key={row.league_entry}>
                        <th scope="row" className="win-margin-table__team">
                          <span className="win-margin-table__team-inner">
                            <TeamAvatar
                              entryId={row.league_entry}
                              name={row.teamName}
                              size="sm"
                              logoMap={teamLogoMap}
                              kitIndexByEntry={kitIndexByEntry}
                            />
                            <span className="win-margin-table__name">{row.teamName}</span>
                          </span>
                        </th>
                        {WIN_MARGIN_BUCKET_KEYS.map((k) => (
                          <td key={k} className="tabular win-margin-table__n">
                            {row.buckets[k] ?? 0}
                          </td>
                        ))}
                        <td className="tabular win-margin-table__sum">
                          <strong>{row.totalWins}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted muted--tight">No wins in finished matches yet.</p>
            )}
          </section>

          <section
            className="tile tile--compact"
            aria-labelledby="loss-margin-buckets-heading"
          >
            <h2 id="loss-margin-buckets-heading" className="tile-title tile-title--sm">
              Losses by margin
            </h2>
            {lossMarginBucketRows?.some((r) => r.totalLosses > 0) ? (
              <div className="table-scroll table-scroll--win-margin">
                <table className="win-margin-table">
                  <thead>
                    <tr>
                      <th scope="col" className="win-margin-table__team">
                        Team
                      </th>
                      {WIN_MARGIN_BUCKET_KEYS.map((k) => (
                        <th
                          key={k}
                          scope="col"
                          className="win-margin-table__n tabular"
                          title={
                            k === '21+'
                              ? 'Lost by 21 or more'
                              : k.includes('-')
                                ? `Lost by ${k.replace('-', '–')} pts`
                                : `Lost by exactly ${k}`
                          }
                        >
                          {k}
                        </th>
                      ))}
                      <th scope="col" className="win-margin-table__sum tabular" title="Total losses">
                        Σ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lossMarginBucketRows.map((row) => (
                      <tr key={row.league_entry}>
                        <th scope="row" className="win-margin-table__team">
                          <span className="win-margin-table__team-inner">
                            <TeamAvatar
                              entryId={row.league_entry}
                              name={row.teamName}
                              size="sm"
                              logoMap={teamLogoMap}
                              kitIndexByEntry={kitIndexByEntry}
                            />
                            <span className="win-margin-table__name">{row.teamName}</span>
                          </span>
                        </th>
                        {WIN_MARGIN_BUCKET_KEYS.map((k) => (
                          <td key={k} className="tabular win-margin-table__n">
                            {row.buckets[k] ?? 0}
                          </td>
                        ))}
                        <td className="tabular win-margin-table__sum">
                          <strong>{row.totalLosses}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted muted--tight">No losses in finished matches yet.</p>
            )}
          </section>
              </div>
            </>
          )}

          {showDashboardPlayoff && dashboardView === 'playoff' ? (
            <div className="dashboard-stack">
              <PlayOffBracket
                tableRows={tableRows}
                teamLogoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
            </div>
          ) : null}

          {showDashboardHall && dashboardView === 'hall' ? (
            <HallOfChampions logoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
          ) : null}

          {dashboardView === 'waivers' && (
            <div className="dashboard-stack">
              <section className="tile tile--compact" aria-labelledby="latest-waivers-heading">
                <div className="tile-head-row tile-head-row--tight">
                  <h2
                    id="latest-waivers-heading"
                    className="tile-title tile-title--sm tile-title--with-select"
                  >
                    <span className="tile-title__text">Latest Waivers</span>
                    {processedWaiverGws.length > 0 ? (
                      <select
                        className="tile-gw-select tile-gw-select--inline"
                        aria-label="Waivers gameweek"
                        value={waiverGwEffective}
                        onChange={(e) => setWaiverGwView(Number(e.target.value))}
                      >
                        {processedWaiverGws.map((gw) => (
                          <option key={gw} value={gw}>
                            GW {gw}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </h2>
                </div>
                {waiversForSelectedGw.groups.length ? (
                  <div className="latest-waivers">
                    {waiversForSelectedGw.groups.map((g) => (
                      <div key={g.entry} className="latest-waivers__team-block">
                        <h3 className="latest-waivers__team-title">
                          <TeamAvatar
                            entryId={g.leagueEntryId}
                            name={g.teamName}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                          <span>{g.teamName}</span>
                        </h3>
                        <ul className="latest-waivers__move-list">
                          {g.moves.map((r) => (
                            <li
                              key={r.transactionId}
                              className={`latest-waivers__move${r.transactionKind === 'f' ? ' latest-waivers__move--fa' : ''}`}
                            >
                              <div className="latest-waivers__move-stack">
                                <div className="latest-waivers__fa-row">
                                  {r.transactionKind === 'f' ? (
                                    <span
                                      className="latest-waivers__txn-badge"
                                      title="Free agency pickup"
                                    >
                                      FA
                                    </span>
                                  ) : null}
                                </div>
                                <div className="latest-waivers__swap-line">
                                  <span className="latest-waivers__io-label muted">In</span>
                                  <PlayerKit
                                    shirtUrl={r.pickedShirtUrl}
                                    badgeUrl={r.pickedBadgeUrl}
                                    teamShort={r.pickedTeamShort}
                                  />
                                  <span className="latest-waivers__player-name">{r.pickedName}</span>
                                </div>
                                <div className="latest-waivers__swap-line">
                                  <span className="latest-waivers__io-label muted">Out</span>
                                  <PlayerKit
                                    shirtUrl={r.droppedShirtUrl}
                                    badgeUrl={r.droppedBadgeUrl}
                                    teamShort={r.droppedTeamShort}
                                  />
                                  <span className="latest-waivers__player-name">{r.droppedName}</span>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted muted--tight">
                    {waiverOutGwRows.length ? (
                      <>
                        No waiver or free-agency activity in GW {waiverGwEffective}.
                      </>
                    ) : (
                      <>
                        No waiver / free-agency rows in <code>drops-gw-live.json</code> yet. Run{' '}
                        <code>npm run dev</code> / <code>npm run build</code> (runs waiver analytics)
                        after <code>transactions.json</code> is present.
                      </>
                    )}
                  </p>
                )}
              </section>
          <section className="tile tile--compact" aria-labelledby="waiver-in-by-team-heading">
            <div className="tile-head-row tile-head-row--tight">
              <h2 id="waiver-in-by-team-heading" className="tile-title tile-title--sm">
                Waiver in - team totals
              </h2>
            </div>
            <p className="tile-hint muted tile-hint--tight">
              Total FPL points scored by every player this team has <strong>waivered in</strong>, from
              pickup until they left.
            </p>
            {waiverInPointsByTeam?.length ? (
              <div className="waiver-in-team-wrap">
                <table className="waiver-in-team-table">
                  <colgroup>
                    <col className="waiver-in-team-col-rank" />
                    <col className="waiver-in-team-col-logo" />
                    <col />
                    <col className="waiver-in-team-col-num" />
                    <col className="waiver-in-team-col-num" />
                    <col className="waiver-in-team-col-total" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="waiver-in-team__rank" scope="col">
                        #
                      </th>
                      <th className="waiver-in-team__logo" scope="col" aria-hidden>
                        {' '}
                      </th>
                      <th className="waiver-in-team__team" scope="col">
                        Team
                      </th>
                      <th className="waiver-in-team__num" scope="col">
                        Pl.
                      </th>
                      <th className="waiver-in-team__num" scope="col">
                        Avg
                      </th>
                      <th className="waiver-in-team__num" scope="col">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {waiverInPointsByTeam.map((t, i) => (
                      <tr key={t.league_entry}>
                        <td className="waiver-in-team__rank tabular">{i + 1}</td>
                        <td className="waiver-in-team__logo">
                          <TeamAvatar
                            entryId={t.league_entry}
                            name={t.teamName}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                        </td>
                        <td className="waiver-in-team__team">
                          <span className="waiver-in-team__name">{t.teamName}</span>
                        </td>
                        <td className="waiver-in-team__num tabular">{t.distinctWaiverPlayers}</td>
                        <td
                          className="waiver-in-team__num tabular"
                          title={
                            t.averageWaiverInPerPlayer != null
                              ? `${t.totalWaiverInPoints} ÷ ${t.distinctWaiverPlayers} players`
                              : undefined
                          }
                        >
                          {t.averageWaiverInPerPlayer != null
                            ? t.averageWaiverInPerPlayer.toFixed(1)
                            : '—'}
                        </td>
                        <td className="waiver-in-team__num waiver-in-team__num--total tabular">
                          {t.totalWaiverInPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted muted--tight">
                Run a full build to generate <code>pickups-tenure.json</code>. If data loads
                locally but not on the live site, try disabling ad blockers (some block
                &quot;waiver&quot; in URLs — we use neutral filenames now).
              </p>
            )}
          </section>

          <section className="tile tile--compact" aria-labelledby="waiver-out-totals-heading">
            <div className="tile-head-row tile-head-row--tight">
              <h2 id="waiver-out-totals-heading" className="tile-title tile-title--sm">
                Waived out - team totals
              </h2>
            </div>
            <p className="tile-hint muted tile-hint--tight">
              Sum of dropped players’ FPL points in the gameweek each waiver hit.
            </p>
            {waiverOutPointsByTeam?.some((t) => t.waiverOutCount > 0) ? (
              <>
                <div className="waiver-totals-grid-head" aria-hidden>
                  <span className="waiver-totals-grid-head__rank">#</span>
                  <span className="waiver-totals-grid-head__avatar" />
                  <span className="waiver-totals-grid-head__team">Team</span>
                  <span
                    className="waiver-totals-grid-head__num tabular"
                    title="Total dropped-player GW points"
                  >
                    Total
                  </span>
                  <span
                    className="waiver-totals-grid-head__num tabular"
                    title="Average GW points per waived-out player (total ÷ number of waivers)"
                  >
                    Avg
                  </span>
                </div>
                <ol className="pa-list waiver-totals-list waiver-totals-list--grid">
                  {waiverOutPointsByTeam.map((t, i) => (
                    <li key={t.league_entry} className="waiver-total-row">
                      <span className="waiver-total-row__rank">{i + 1}</span>
                      <TeamAvatar
                        entryId={t.league_entry}
                        name={t.teamName}
                        size="sm"
                        logoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                      <div className="waiver-total-main">
                        <span className="pa-team">{t.teamName}</span>
                        <span className="waiver-totals-meta muted">
                          {t.waiverOutCount} waiver{t.waiverOutCount === 1 ? '' : 's'}
                          {t.knownPtsCount < t.waiverOutCount
                            ? ` · ${t.knownPtsCount}/${t.waiverOutCount} GW pts known`
                            : ''}
                        </span>
                      </div>
                      <span className="waiver-total-row__total tabular">{t.totalDroppedGwPoints}</span>
                      <span
                        className="waiver-total-row__avg tabular"
                        title={
                          t.waiverOutCount > 0
                            ? `${t.totalDroppedGwPoints} ÷ ${t.waiverOutCount} waivers`
                            : ''
                        }
                      >
                        {t.waiverOutCount > 0 && t.averageDroppedGwPoints != null
                          ? t.averageDroppedGwPoints.toFixed(1)
                          : '—'}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="muted muted--tight">No waiver-out data yet — run a full ingest + build.</p>
            )}
          </section>

          <section className="tile tile--compact" aria-labelledby="waiver-out-gw-heading">
            <div className="tile-head-row tile-head-row--tight">
              <h2 id="waiver-out-gw-heading" className="tile-title tile-title--sm">
                Waived out — GW points
              </h2>
            </div>
            {waiverOutRowsWaiverOnly.length ? (
              <>
                <div className="waiver-out-filters">
                  <div className="waiver-out-filter">
                    <label htmlFor="waiver-gw-mode-filter">Type</label>
                    <select
                      id="waiver-gw-mode-filter"
                      className="waiver-out-filter__select"
                      value={waiverGwTableMode}
                      onChange={(e) =>
                        setWaiverGwTableMode(e.target.value === 'in' ? 'in' : 'out')
                      }
                    >
                      <option value="out">Waivers out</option>
                      <option value="in">Waivers in</option>
                    </select>
                  </div>
                  <div className="waiver-out-filter">
                    <label htmlFor="waiver-out-team-filter">Team</label>
                    <select
                      id="waiver-out-team-filter"
                      className="waiver-out-filter__select"
                      value={waiverOutTeamFilter}
                      onChange={(e) => setWaiverOutTeamFilter(e.target.value)}
                    >
                      <option value="all">All teams</option>
                      {waiverOutTeamOptions.map(([entry, name]) => (
                        <option key={entry} value={String(entry)}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="waiver-out-filter">
                    <select
                      id="waiver-out-gw-filter"
                      className="waiver-out-filter__select"
                      aria-label="Gameweek filter"
                      value={waiverOutGwFilter}
                      onChange={(e) => setWaiverOutGwFilter(e.target.value)}
                    >
                      <option value="all">All gameweeks</option>
                      {waiverOutGwOptions.map((gw) => (
                        <option key={gw} value={String(gw)}>
                          GW {gw}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {waiverOutTeamPointsTotal && (
                  <p className="waiver-out-sum-banner">
                    <strong>Total</strong>{' '}
                    {waiverOutTeamPointsTotal.mode === 'in'
                      ? 'picked-up player GW points'
                      : 'dropped-player GW points'}
                    :{' '}
                    <span className="tabular waiver-out-sum-banner__num">
                      {waiverOutTeamPointsTotal.sum}
                    </span>
                    <span className="muted">
                      {' '}
                      ({waiverOutTeamPointsTotal.rowCount} waiver
                      {waiverOutTeamPointsTotal.rowCount === 1 ? '' : 's'}
                      {waiverOutGwFilter !== 'all' ? ` · GW ${waiverOutGwFilter}` : ''}
                      {waiverOutTeamPointsTotal.missing > 0
                        ? ` · ${waiverOutTeamPointsTotal.missing} row(s) no GW data`
                        : ''}
                      )
                    </span>
                  </p>
                )}
                <div className="waiver-gw-table-wrap">
                  {filteredWaiverOutRows.length ? (
                    <table className="waiver-gw-table">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th>GW</th>
                          <th>
                            {waiverGwTableMode === 'out' ? 'Waived out' : 'Waived in'}
                          </th>
                          <th className="tabular">Pts</th>
                          <th className="muted">
                            {waiverGwTableMode === 'out' ? 'Waived in' : 'Waived out'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWaiverOutRows.map((r) => {
                          const primaryPts =
                            waiverGwTableMode === 'out'
                              ? r.droppedPlayerGwPoints
                              : r.pickedUpPlayerGwPoints
                          const primaryName =
                            waiverGwTableMode === 'out' ? r.droppedName : r.pickedName
                          const otherName =
                            waiverGwTableMode === 'out' ? r.pickedName : r.droppedName
                          return (
                            <tr key={r.transactionId}>
                              <td className="waiver-gw-team">{r.teamName}</td>
                              <td className="tabular">{r.gameweek}</td>
                              <td>{primaryName}</td>
                              <td className="tabular fw-600">
                                {primaryPts == null ? '—' : primaryPts}
                              </td>
                              <td className="muted">{otherName}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="muted muted--tight waiver-out-empty">
                      No waivers match these filters.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="muted muted--tight">
                Run a full build after <code>ingest</code> — this table is built from{' '}
                <code>transactions.json</code> + FPL event/live per GW.
              </p>
            )}
          </section>

          <section className="tile tile--compact" aria-labelledby="waiver-in-tenure-heading">
            <h2 id="waiver-in-tenure-heading" className="tile-title tile-title--sm">
              Best waiver pickups
            </h2>
            <p className="tile-hint muted tile-hint--tight">
              Top 10 player–team pairs by total FPL points from each <strong>waiver in</strong> until
              that player left the squad. Same player re-waived later: stints added together. Uses
              official GW live scores through the last finished gameweek.
            </p>
            {waiverInTenureTopRows?.length ? (
              <ol className="waiver-list waiver-list--tight waiver-pickup-list">
                {waiverInTenureTopRows.map((r) => (
                  <li
                    key={`${r.entry}-${r.elementId}`}
                    className="waiver-row waiver-pickup-row"
                  >
                    <span className="waiver-rank">{r.rank}</span>
                    <PlayerKit
                      shirtUrl={r.shirtUrl}
                      badgeUrl={r.badgeUrl}
                      teamShort={r.teamShort}
                    />
                    <div className="waiver-info waiver-pickup-info">
                      <span className="waiver-name">{r.playerName}</span>
                      <span className="waiver-pickup-team">{r.teamName}</span>
                      <span className="waiver-club muted">
                        GW {r.firstGw}–{r.lastGw}
                        {r.waiverStints > 1 ? ` · ${r.waiverStints} pickups` : ''}
                      </span>
                    </div>
                    <span className="waiver-count tabular" title="Total pts for this team over those weeks">
                      {r.totalPointsForTeam}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted muted--tight">
                Run <code>npm run dev</code> / build so <code>pickups-tenure.json</code> is
                generated (needs <code>transactions.json</code> + finished GWs).
              </p>
            )}
          </section>

          <section className="tile tile--compact">
            <h2 className="tile-title tile-title--sm">Most waivered players</h2>
            {mostWaiveredPlayers?.length ? (
              <ol className="waiver-list waiver-list--tight">
                {mostWaiveredPlayers.map((p, i) => (
                  <li key={p.elementId} className="waiver-row">
                    <span className="waiver-rank">{i + 1}</span>
                    <PlayerKit shirtUrl={p.shirtUrl} badgeUrl={p.badgeUrl} teamShort={p.teamShort} />
                    <div className="waiver-info">
                      <span className="waiver-name">{p.web_name}</span>
                      <span className="waiver-club muted">{p.teamShort}</span>
                    </div>
                    <span className="waiver-count">{p.claims}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">
                Run full <code>ingest.py</code> (includes <code>transactions.json</code> and{' '}
                <code>bootstrap_draft.json</code>) then <code>npm run dev</code> to build waiver stats.
              </p>
            )}
          </section>
            </div>
          )}

          {showDashboardTrades && dashboardView === 'trades' ? (
            <div className="dashboard-stack">
              <section className="tile tile--compact" aria-labelledby="trades-heading">
                <h2 id="trades-heading" className="tile-title tile-title--sm">
                  Trades
                </h2>
                {tradesPanelRows?.length ? (
                  <div className="trades-list">
                    {tradesPanelRows.map((trade) => (
                      <TradeCardArticle
                        key={trade.id}
                        trade={trade}
                        teamLogoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="muted muted--tight">
                    No trade analytics yet. Ingest <code>trades.json</code> (included in{' '}
                    <code>ingest.py</code> / local fetch), run <code>npm run dev</code> or{' '}
                    <code>npm run build</code> to generate <code>trades-panel.json</code>.
                  </p>
                )}
              </section>
            </div>
          ) : null}

          {dashboardView === 'live' && (
            <LiveScores
              teams={teamsForFormSelect}
              tableRows={tableRows}
              matches={matches ?? []}
              gameweek={liveGameweek}
              onGameweekChange={setLiveGw}
              onBootstrapLiveMeta={onBootstrapLiveMeta}
              teamLogoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
            />
          )}

        </div>
      </main>
      <footer className="page-footer--script">Tery is a Racist</footer>
    </div>
  )
}

export default App

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TeamAvatar } from './TeamAvatar'

/** H2H week for quarter-finals; winner that week progresses. */
const PLAYOFF_QF_GW = 35

/** Order: 1v8, 4v5, 2v7, 3v6 — seeds are standings positions 1–8 (current top eight, tie-break on total). */
function buildQuarterMatchups(tableRows) {
  const ordered = [...tableRows].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    return (b.total ?? 0) - (a.total ?? 0)
  })
  const t = ordered.slice(0, 8)
  const seed = (i) => {
    const row = t[i]
    if (!row) return null
    return { ...row, bracketSeed: i + 1 }
  }
  return [
    { key: 'qf1', sideA: seed(0), sideB: seed(7), pairing: '1 vs 8' },
    { key: 'qf2', sideA: seed(3), sideB: seed(4), pairing: '4 vs 5' },
    { key: 'qf3', sideA: seed(1), sideB: seed(6), pairing: '2 vs 7' },
    { key: 'qf4', sideA: seed(2), sideB: seed(5), pairing: '3 vs 6' },
  ]
}

/** One team — own bordered tile (same look as former team “bar”, now standalone). */
function TeamTile({ side, teamLogoMap }) {
  if (!side) {
    return (
      <div className="playoff-team-tile playoff-team-tile--empty">
        <span className="playoff-team-tile__seed muted">—</span>
        <span className="playoff-team-tile__name muted">—</span>
      </div>
    )
  }
  return (
    <div className="playoff-team-tile">
      <span className="playoff-team-tile__seed tabular" title={`Seed ${side.bracketSeed}`}>
        {side.bracketSeed}
      </span>
      <span className="playoff-team-tile__avatar">
        <TeamAvatar entryId={side.league_entry} name={side.teamName} size="sm" logoMap={teamLogoMap} />
      </span>
      <span className="playoff-team-tile__name" title={side.teamName}>
        {side.teamName}
      </span>
    </div>
  )
}

function PlaceholderTile({ text }) {
  return (
    <div className="playoff-team-tile playoff-team-tile--placeholder" role="status">
      <span className="playoff-team-tile__placeholder-text">{text}</span>
    </div>
  )
}

function QfPair({ matchup, teamLogoMap }) {
  return (
    <div className="playoff-qf-pair" aria-label={`Quarter-final ${matchup.pairing}`}>
      <div className="playoff-qf-pair__tiles">
        <TeamTile side={matchup.sideA} teamLogoMap={teamLogoMap} />
        <TeamTile side={matchup.sideB} teamLogoMap={teamLogoMap} />
      </div>
    </div>
  )
}

/** QF column: two fixtures (four teams), each fixture = two tiles. */
function QfColumn({ top, bottom, teamLogoMap }) {
  return (
    <div className="playoff-qf-col">
      <QfPair matchup={top} teamLogoMap={teamLogoMap} />
      <QfPair matchup={bottom} teamLogoMap={teamLogoMap} />
    </div>
  )
}

/** Stage title above the semifinal placeholder column for that row. */
function PlayoffRowStageLabel({ children }) {
  return <div className="playoff-row-stage-label">{children}</div>
}

const DEFAULT_BRIDGE_TO_SF =
  'M 0 22 L 36 22 L 36 50 M 0 78 L 36 78 L 36 50 M 36 50 L 100 50'
const DEFAULT_MERGE_TO_FINAL =
  'M 0 25 L 28 25 L 28 50 M 0 75 L 28 75 L 28 50 M 28 50 L 100 50'

function clampBridgePct(v) {
  if (v == null || Number.isNaN(v)) return null
  return Math.min(97, Math.max(3, v))
}

/** Midpoint Y (viewport px) between two stacked tiles inside a pair column. */
function midGapYBetweenTiles(container, tilesSelector) {
  if (!container) return null
  const tiles = container.querySelectorAll(tilesSelector)
  if (tiles.length < 2) return null
  const a = tiles[0].getBoundingClientRect()
  const b = tiles[1].getBoundingClientRect()
  return (a.bottom + b.top) / 2
}

/** Convert viewport Y to percentage inside `bridgeEl` height (SVG viewBox 0–100). */
function yToPct(bridgeEl, midY) {
  if (!bridgeEl || midY == null) return null
  const r = bridgeEl.getBoundingClientRect()
  if (r.height < 8) return null
  return ((midY - r.top) / r.height) * 100
}

/** Horizontal stem sits at vertical midpoint between the two fork arms; tiles shift to match (see layout effect). */
function pathBridgeToSf(bridgeEl, qfColEl) {
  const pairs = qfColEl?.querySelectorAll(':scope .playoff-qf-pair') ?? []
  if (pairs.length < 2 || !bridgeEl) return null

  const rawT = yToPct(bridgeEl, midGapYBetweenTiles(pairs[0], ':scope .playoff-qf-pair__tiles > .playoff-team-tile'))
  const rawB = yToPct(bridgeEl, midGapYBetweenTiles(pairs[1], ':scope .playoff-qf-pair__tiles > .playoff-team-tile'))
  if (rawT == null || rawB == null) return null

  const yt = clampBridgePct(rawT) ?? 22
  const yb = clampBridgePct(rawB) ?? 78
  const yo = clampBridgePct((rawT + rawB) / 2) ?? (yt + yb) / 2
  const x = 36
  const d = `M 0 ${yt} L ${x} ${yt} L ${x} ${yo} M 0 ${yb} L ${x} ${yb} L ${x} ${yo} M ${x} ${yo} L 100 ${yo}`
  return { d, stemPct: yo }
}

function pathMergeToFinal(mergeEl, sf1El, sf2El) {
  if (!mergeEl || !sf1El || !sf2El) return null

  const raw1 = yToPct(mergeEl, midGapYBetweenTiles(sf1El, ':scope .playoff-sf-col__tiles > .playoff-team-tile'))
  const raw2 = yToPct(mergeEl, midGapYBetweenTiles(sf2El, ':scope .playoff-sf-col__tiles > .playoff-team-tile'))
  if (raw1 == null || raw2 == null) return null

  const x = 28
  const a = clampBridgePct(raw1) ?? 25
  const b = clampBridgePct(raw2) ?? 75
  const stem = clampBridgePct((raw1 + raw2) / 2) ?? (a + b) / 2
  const d = `M 0 ${a} L ${x} ${a} L ${x} ${stem} M 0 ${b} L ${x} ${b} L ${x} ${stem} M ${x} ${stem} L 100 ${stem}`
  return { d, stemPct: stem }
}

/**
 * Nudge tile stack so the horizontal stem meets the midline of the gutter between the two tiles.
 * Uses incremental correction: gapY already includes current marginTop, so we must add (stemY - gapY)
 * to the previous margin — *not* replace with (stemY - gapY), or a good alignment collapses to 0 and snaps back.
 */
function tilesShiftToStemPx(stemHostEl, stemPct, colEl, tilesSelector, prevMarginPx) {
  if (!stemHostEl || stemPct == null || !colEl) return prevMarginPx
  const box = stemHostEl.getBoundingClientRect()
  if (box.height < 8) return prevMarginPx
  const stemY = box.top + (stemPct / 100) * box.height
  const gapY = midGapYBetweenTiles(colEl, tilesSelector)
  if (gapY == null) return prevMarginPx
  const err = stemY - gapY
  return Math.round(prevMarginPx + err)
}

/** Arm bridge: two QF “lanes” into one SF row (path from measured tile gaps). */
function BracketBridgeToSf({ pathD }) {
  return (
    <svg
      className="playoff-bridge-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={pathD}
        className="playoff-bridge-svg__path"
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Merge both semifinals into the final column. */
function BracketBridgeMergeToFinal({ pathD }) {
  return (
    <svg
      className="playoff-bridge-svg playoff-bridge-svg--merge"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={pathD}
        className="playoff-bridge-svg__path"
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function SfColumn({ title, hintTop, hintBottom, tilesShiftPx = 0 }) {
  return (
    <div className="playoff-sf-col" style={{ marginTop: tilesShiftPx }}>
      <PlayoffRowStageLabel>{title}</PlayoffRowStageLabel>
      <div className="playoff-sf-col__tiles">
        <PlaceholderTile text={hintTop} />
        <PlaceholderTile text={hintBottom} />
      </div>
    </div>
  )
}

function FinalColumn({ tilesShiftPx = 0 }) {
  return (
    <div className="playoff-final-col" style={{ marginTop: tilesShiftPx }}>
      <div className="playoff-row-stage-label playoff-row-stage-label--final">
        <span className="playoff-row-stage-label__emoji" aria-hidden="true">
          🏆
        </span>
        <span>Final</span>
      </div>
      <div className="playoff-final-col__tiles">
        <PlaceholderTile text="Semifinal 1 H2H winner" />
        <PlaceholderTile text="Semifinal 2 H2H winner" />
      </div>
    </div>
  )
}

export function PlayOffBracket({ tableRows, teamLogoMap }) {
  const q = useMemo(() => buildQuarterMatchups(tableRows || []), [tableRows])
  const [qf1, qf2, qf3, qf4] = q

  const gridRef = useRef(null)
  const br1Ref = useRef(null)
  const br2Ref = useRef(null)
  const qf1Ref = useRef(null)
  const qf2Ref = useRef(null)
  const sf1Ref = useRef(null)
  const sf2Ref = useRef(null)
  const mergeRef = useRef(null)
  const finalRef = useRef(null)

  const [pathToSf1, setPathToSf1] = useState(DEFAULT_BRIDGE_TO_SF)
  const [pathToSf2, setPathToSf2] = useState(DEFAULT_BRIDGE_TO_SF)
  const [pathMerge, setPathMerge] = useState(DEFAULT_MERGE_TO_FINAL)
  const [sf1TilesShiftPx, setSf1TilesShiftPx] = useState(0)
  const [sf2TilesShiftPx, setSf2TilesShiftPx] = useState(0)
  const [finalTilesShiftPx, setFinalTilesShiftPx] = useState(0)

  const sf1ShiftRef = useRef(0)
  const sf2ShiftRef = useRef(0)
  const finalShiftRef = useRef(0)

  useLayoutEffect(() => {
    sf1ShiftRef.current = 0
    sf2ShiftRef.current = 0
    finalShiftRef.current = 0
    setSf1TilesShiftPx(0)
    setSf2TilesShiftPx(0)
    setFinalTilesShiftPx(0)

    const run = () => {
      const p1 = pathBridgeToSf(br1Ref.current, qf1Ref.current)
      const p2 = pathBridgeToSf(br2Ref.current, qf2Ref.current)
      const pm = pathMergeToFinal(mergeRef.current, sf1Ref.current, sf2Ref.current)
      if (p1) {
        setPathToSf1(p1.d)
        const m1 = tilesShiftToStemPx(
          br1Ref.current,
          p1.stemPct,
          sf1Ref.current,
          ':scope .playoff-sf-col__tiles > .playoff-team-tile',
          sf1ShiftRef.current,
        )
        sf1ShiftRef.current = m1
        setSf1TilesShiftPx(m1)
      }
      if (p2) {
        setPathToSf2(p2.d)
        const m2 = tilesShiftToStemPx(
          br2Ref.current,
          p2.stemPct,
          sf2Ref.current,
          ':scope .playoff-sf-col__tiles > .playoff-team-tile',
          sf2ShiftRef.current,
        )
        sf2ShiftRef.current = m2
        setSf2TilesShiftPx(m2)
      }
      if (pm) {
        setPathMerge(pm.d)
        const mf = tilesShiftToStemPx(
          mergeRef.current,
          pm.stemPct,
          finalRef.current,
          ':scope .playoff-final-col__tiles > .playoff-team-tile',
          finalShiftRef.current,
        )
        finalShiftRef.current = mf
        setFinalTilesShiftPx(mf)
      }
    }
    const schedule = () => {
      requestAnimationFrame(() => {
        run()
        requestAnimationFrame(() => {
          run()
          requestAnimationFrame(run)
        })
      })
    }

    schedule()
    const grid = gridRef.current
    let ro
    if (grid && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule)
      ro.observe(grid)
    }
    window.addEventListener('resize', schedule)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [tableRows])

  return (
    <section className="tile tile--compact playoff-bracket" aria-labelledby="playoff-heading">
      <div className="tile-head-row tile-head-row--tight">
        <h2 id="playoff-heading" className="tile-title tile-title--sm">
          Projected play-offs
        </h2>
      </div>
      <p className="muted muted--tight playoff-bracket__note">
        Seeds from <strong>current standings</strong> (top eight).
      </p>

      <div className="playoff-bracket-grid-head" aria-hidden>
        <span>Quarter-finals (GW {PLAYOFF_QF_GW})</span>
      </div>

      <div className="playoff-bracket-grid" ref={gridRef}>
        <div className="playoff-grid__qf1" ref={qf1Ref}>
          <QfColumn top={qf1} bottom={qf2} teamLogoMap={teamLogoMap} />
        </div>
        <div className="playoff-grid__br1" ref={br1Ref}>
          <BracketBridgeToSf pathD={pathToSf1} />
        </div>
        <div className="playoff-grid__sf1" ref={sf1Ref}>
          <SfColumn
            title="Semifinal 1"
            hintTop={`GW ${PLAYOFF_QF_GW} winner · 1 vs 8`}
            hintBottom={`GW ${PLAYOFF_QF_GW} winner · 4 vs 5`}
            tilesShiftPx={sf1TilesShiftPx}
          />
        </div>
        <div className="playoff-grid__qf2" ref={qf2Ref}>
          <QfColumn top={qf3} bottom={qf4} teamLogoMap={teamLogoMap} />
        </div>
        <div className="playoff-grid__br2" ref={br2Ref}>
          <BracketBridgeToSf pathD={pathToSf2} />
        </div>
        <div className="playoff-grid__sf2" ref={sf2Ref}>
          <SfColumn
            title="Semifinal 2"
            hintTop={`GW ${PLAYOFF_QF_GW} winner · 2 vs 7`}
            hintBottom={`GW ${PLAYOFF_QF_GW} winner · 3 vs 6`}
            tilesShiftPx={sf2TilesShiftPx}
          />
        </div>
        <div className="playoff-grid__merge" ref={mergeRef}>
          <BracketBridgeMergeToFinal pathD={pathMerge} />
        </div>
        <div className="playoff-grid__final" ref={finalRef}>
          <FinalColumn tilesShiftPx={finalTilesShiftPx} />
        </div>
      </div>
    </section>
  )
}

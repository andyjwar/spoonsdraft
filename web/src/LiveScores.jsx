import { useMemo, useState, useCallback } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { useLiveScores } from './useLiveScores';

/**
 * Mins cell: green ≥60; red 0 after club’s GW fixture(s) finished; yellow 2–59.
 */
function livePickMinsCellClass(r) {
  const m = Number(r.minutes) || 0;
  if (m >= 60) return 'live-pick-cell--green';
  if (m === 0 && r.clubGwFixturesFinished === true) return 'live-pick-cell--red';
  if (m > 1 && m < 60) return 'live-pick-cell--yellow';
  return '';
}

/** DC cell: DEF ≥10, MID/FWD ≥12 (FPL defensive contribution count) */
function livePickDcGreen(r) {
  const dc = Number(r.dcCount) || 0;
  const pos = r.posSingular;
  if (pos === 'DEF') return dc >= 10;
  if (pos === 'MID' || pos === 'FWD') return dc >= 12;
  return false;
}

function KitThumb({ shirtUrl, badgeUrl, teamShort }) {
  const src = shirtUrl || badgeUrl;
  if (!src) {
    return (
      <span className="live-kit-fallback" title={teamShort}>
        {teamShort?.slice(0, 3) ?? '?'}
      </span>
    );
  }
  return (
    <img
      className="live-kit-img"
      src={src}
      alt=""
      loading="lazy"
      onError={(e) => {
        const img = e.currentTarget;
        if (shirtUrl && badgeUrl && img.src.includes(String(shirtUrl))) {
          img.src = badgeUrl;
        }
      }}
    />
  );
}

function PicksTable({ rows }) {
  if (!rows.length) return <p className="muted muted--tight">No picks</p>;
  return (
    <div className="table-scroll">
      <table className="live-picks-table">
        <colgroup>
          <col className="live-picks-col-player" />
          <col className="live-picks-col-pos" />
          <col className="live-picks-col-num live-picks-col-mins" />
          <col className="live-picks-col-num live-picks-col-dc" />
          <col className="live-picks-col-num live-picks-col-goals" />
          <col className="live-picks-col-num live-picks-col-assists" />
          <col className="live-picks-col-num live-picks-col-bonus" />
          <col className="live-picks-col-alarm" />
          <col className="live-picks-col-num live-picks-col-pts" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="live-picks-col-player">
              Player
            </th>
            <th scope="col" className="live-picks-col-pos">
              Pos
            </th>
            <th
              scope="col"
              className="live-picks-col-num live-picks-col-mins"
              title="Minutes"
            >
              Mins
            </th>
            <th
              scope="col"
              className="live-picks-col-num live-picks-col-dc"
              title="Defensive contributions this gameweek (FPL live stats)"
            >
              DC
            </th>
            <th
              scope="col"
              className="live-picks-col-num live-picks-col-goals"
              title="Goals scored this gameweek"
              aria-label="Goals"
            >
              <span aria-hidden="true">⚽</span>
            </th>
            <th
              scope="col"
              className="live-picks-col-num live-picks-col-assists"
              title="Assists this gameweek"
              aria-label="Assists"
            >
              <span aria-hidden="true">🍑</span>
            </th>
            <th
              scope="col"
              className="live-picks-col-num live-picks-col-bonus"
              title="Uses FPL bonus when stats.bonus is non-zero; otherwise BPS-based projection (keeps showing after full-time until FPL posts the final number)."
            >
              Bonus
            </th>
            <th
              scope="col"
              className="live-picks-col-alarm live-picks-col-alarm--head"
              aria-label="Defensive contribution highlight"
              title="Shows when FPL awards exactly 2 pts from defensive contributions in live explain."
            />
            <th
              scope="col"
              className="live-picks-col-num live-picks-col-pts live-picks-col-pts--split"
              title="Live FPL points; bonus in the total matches the Bonus column (including BPS estimate when not yet posted)."
            >
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const minsTone = livePickMinsCellClass(r);
            return (
            <tr key={`${r.pickPosition}-${r.element}`}>
              <td className="live-picks-col-player">
                <div className="live-player-cell">
                  <KitThumb
                    shirtUrl={r.shirtUrl}
                    badgeUrl={r.badgeUrl}
                    teamShort={r.teamShort}
                  />
                  <div className="live-player-text">
                    <div
                      className="live-player-name"
                      title={`${r.web_name} · #${r.element}${r.teamName ? ` · ${r.teamName}` : ''}`}
                    >
                      {r.displayName ?? r.web_name}
                    </div>
                  </div>
                </div>
              </td>
              <td className="live-picks-col-pos tabular">{r.posSingular}</td>
              <td
                className={['live-picks-col-num', 'live-picks-col-mins', 'tabular', minsTone]
                  .filter(Boolean)
                  .join(' ')}
              >
                {r.minutes}
              </td>
              <td
                className={
                  'live-picks-col-num live-picks-col-dc tabular' +
                  (livePickDcGreen(r) ? ' live-pick-cell--green' : '')
                }
              >
                {r.dcCount}
              </td>
              <td
                className={
                  'live-picks-col-num live-picks-col-goals tabular' +
                  ((Number(r.goalsScored) || 0) > 0 ? ' live-pick-cell--green' : '')
                }
              >
                {r.goalsScored}
              </td>
              <td
                className={
                  'live-picks-col-num live-picks-col-assists tabular' +
                  ((Number(r.assists) || 0) > 0 ? ' live-pick-cell--green' : '')
                }
              >
                {r.assists}
              </td>
              <td
                className={
                  'live-picks-col-num live-picks-col-bonus tabular' +
                  ((Number(r.bonus) || 0) > 0 ? ' live-pick-cell--green' : '')
                }
              >
                {r.bonus}
              </td>
              <td className="live-picks-col-alarm tabular" />
              <td className="live-picks-col-num live-picks-col-pts live-picks-col-pts--split tabular">
                <strong>{r.total_points}</strong>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function sumStarterPoints(starters) {
  return starters.reduce((acc, r) => acc + (Number(r.total_points) || 0), 0);
}

/**
 * XI total for banners / meta: sum of per-player Pts (includes provisional bonus when shown).
 * Matches `entry_history.points` when FPL bonus matches our Bonus column; otherwise reflects BPS estimate.
 */
function liveGwDisplayTotal(squad) {
  if (!squad || squad.error) return null;
  if (!squad.starters?.length) return null;
  return sumStarterPoints(squad.starters);
}

/** 3 / 1 / 0 from live GW score vs opponent (same as H2H table stakes). */
function liveH2hBonusPts(myLive, oppLive) {
  if (myLive == null || oppLive == null) return 0;
  if (myLive > oppLive) return 3;
  if (myLive < oppLive) return 0;
  return 1;
}

/** GW column: league points from the live fixture (+3 / +1 / 0). */
function formatGwLeaguePtsBonus(h2hBonus) {
  if (h2hBonus === 3) return '+3';
  if (h2hBonus === 1) return '+1';
  return '0';
}

function teamNameForEntry(teams, leagueEntryId) {
  return teams?.find((t) => t.id === leagueEntryId)?.teamName ?? `Team ${leagueEntryId}`;
}

const LEFT_TO_PLAY_TITLE =
  'Starting XI players on 0 minutes whose club still has a Premier League fixture to finish this gameweek';

/** Bracketed count after the team name (both sides — keeps layout symmetrical). */
function LeftToPlayOutsideAfter({ count, leadingSpace = true }) {
  if (typeof count !== 'number') return null;
  return (
    <span className="live-left-to-play tabular" title={LEFT_TO_PLAY_TITLE}>
      {leadingSpace ? ' ' : null}
      ({count})
    </span>
  );
}

/** @param {{ squad: object }} */
function SquadLineupPanel({ squad }) {
  if (!squad) {
    return <p className="muted muted--tight">No squad data for this team.</p>;
  }
  if (squad.error) {
    return <p className="muted">{squad.error}</p>;
  }
  return (
    <>
      {squad.autoSubs?.length ? (
        <div className="live-auto-subs muted" role="status">
          <strong>Auto subs:</strong>{' '}
          {squad.autoSubs.map((a) => {
            const all = [...squad.starters, ...squad.bench];
            const rowIn = all.find((r) => r.element === Number(a.element_in));
            const rowOut = all.find((r) => r.element === Number(a.element_out));
            const nameIn = rowIn?.displayName ?? rowIn?.web_name ?? `#${a.element_in}`;
            const nameOut = rowOut?.displayName ?? rowOut?.web_name ?? `#${a.element_out}`;
            return (
              <span key={`${a.element_in}-${a.element_out}`} className="live-auto-sub-pair">
                {nameIn} ↔ {nameOut}
              </span>
            );
          })}
        </div>
      ) : null}
      <h4 className="live-lineup-heading">Starting XI</h4>
      <div className="live-picks-table-wrap live-picks-table-wrap--starting-xi-portrait">
        <PicksTable rows={squad.starters} />
      </div>
      <h4 className="live-lineup-heading live-lineup-heading--bench">Bench</h4>
      <PicksTable rows={squad.bench} />
    </>
  );
}

function proxyHostLabel() {
  const raw = import.meta.env.VITE_FPL_PROXY_URL;
  if (raw == null || String(raw).trim() === '') return null;
  try {
    return new URL(String(raw).trim()).host;
  } catch {
    return null;
  }
}

function isLikelyLocalDev() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

/**
 * @param {{ teams: Array<{ id: number, teamName: string, fplEntryId: number | null }>, tableRows?: Array<object>, matches?: Array<{ event: number, league_entry_1: number, league_entry_2: number, finished?: boolean, league_entry_1_points?: number, league_entry_2_points?: number }>, gameweek: number, onGameweekChange: (n: number) => void, onBootstrapLiveMeta?: (meta: { currentGw: number | null }) => void, teamLogoMap: object }}
 */
export function LiveScores({
  teams,
  tableRows = [],
  matches = [],
  gameweek,
  onGameweekChange,
  onBootstrapLiveMeta,
  teamLogoMap,
}) {
  const { loading, error, refresh, lastUpdated, events, eventSnapshot, squads } =
    useLiveScores({
      teams,
      gameweek,
      enabled: true,
      onBootstrapLiveMeta,
    });

  /** Fixture keys in the set are expanded; default empty = all collapsed. */
  const [expandedFixtures, setExpandedFixtures] = useState(() => new Set());
  const toggleFixtureExpanded = useCallback((key) => {
    setExpandedFixtures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const proxyHost = proxyHostLabel();

  const allMissingFplId =
    teams?.length > 0 && teams.every((t) => t.fplEntryId == null);

  const gwOptions = useMemo(() => {
    return (events || [])
      .filter((e) => e && e.id >= 1 && e.id <= 38)
      .map((e) => ({
        id: e.id,
        label: e.name || `GW ${e.id}`,
        finished: e.finished,
        is_current: e.is_current,
        is_next: e.is_next,
      }));
  }, [events]);

  const gwMatches = useMemo(() => {
    if (!Array.isArray(matches) || matches.length === 0) return [];
    return matches.filter((m) => Number(m.event) === Number(gameweek));
  }, [matches, gameweek]);

  const squadByLeagueEntry = useMemo(() => {
    const m = new Map();
    for (const s of squads) {
      m.set(s.leagueEntryId, s);
    }
    return m;
  }, [squads]);

  /** Opponent’s live GW total for this GW (for projected Faced / GD / H2H pts). */
  const oppLiveGwByLeagueEntry = useMemo(() => {
    const m = new Map();
    for (const fx of gwMatches) {
      const a = Number(fx.league_entry_1);
      const b = Number(fx.league_entry_2);
      const la = liveGwDisplayTotal(squadByLeagueEntry.get(a));
      const lb = liveGwDisplayTotal(squadByLeagueEntry.get(b));
      m.set(a, lb);
      m.set(b, la);
    }
    return m;
  }, [gwMatches, squadByLeagueEntry]);

  /**
   * Projected For / Faced / GD / PTS from this GW’s live fixtures, then sorted by projected PTS,
   * then For, then GD. `liveRank` = competition rank (ties share a #). `rankMove` uses ordinal
   * list position (i + 1) vs season rank so movement still shows inside tied groups.
   */
  const liveStandingsRows = useMemo(() => {
    if (!Array.isArray(tableRows) || tableRows.length === 0) return [];
    const enriched = tableRows.map((row) => {
      const eid = row.league_entry;
      const squad = squadByLeagueEntry.get(eid);
      const liveGw = liveGwDisplayTotal(squad);
      const inFixture = oppLiveGwByLeagueEntry.has(eid);
      const oppLiveGw = inFixture ? oppLiveGwByLeagueEntry.get(eid) : null;

      const gf = Number(row.gf) || 0;
      const ga = Number(row.ga) || 0;
      const total = Number(row.total) || 0;
      const addMine = liveGw != null ? liveGw : 0;
      const addOpp =
        inFixture && oppLiveGw != null && Number.isFinite(Number(oppLiveGw))
          ? Number(oppLiveGw)
          : 0;

      const projectedFor = gf + addMine;
      const projectedGa = ga + addOpp;
      const projectedGd = projectedFor - projectedGa;
      const h2hBonus =
        inFixture && liveGw != null && oppLiveGw != null
          ? liveH2hBonusPts(liveGw, oppLiveGw)
          : 0;
      const projectedPts = total + h2hBonus;

      return {
        ...row,
        liveGw,
        oppLiveGw: inFixture ? oppLiveGw : null,
        projectedFor,
        projectedGa,
        projectedGd,
        h2hBonus,
        projectedPts,
      };
    });
    const sorted = [...enriched].sort((a, b) => {
      const d = (b.projectedPts ?? 0) - (a.projectedPts ?? 0);
      if (d !== 0) return d;
      const f = (b.projectedFor ?? 0) - (a.projectedFor ?? 0);
      if (f !== 0) return f;
      const g = (b.projectedGd ?? 0) - (a.projectedGd ?? 0);
      if (g !== 0) return g;
      return (a.rank ?? 999) - (b.rank ?? 999);
    });
    let currentLiveRank = 0;
    return sorted.map((row, i) => {
      if (i === 0 || row.projectedPts !== sorted[i - 1].projectedPts) {
        currentLiveRank = i + 1;
      }
      const liveRank = currentLiveRank;
      const ordinalLive = i + 1;
      const rankMove = (row.rank ?? 999) - ordinalLive;
      return { ...row, liveRank, ordinalLive, rankMove };
    });
  }, [tableRows, squadByLeagueEntry, oppLiveGwByLeagueEntry]);

  const pairedLeagueEntryIds = useMemo(() => {
    const s = new Set();
    for (const m of gwMatches) {
      s.add(Number(m.league_entry_1));
      s.add(Number(m.league_entry_2));
    }
    return s;
  }, [gwMatches]);

  const orphanSquads = useMemo(
    () => squads.filter((q) => !pairedLeagueEntryIds.has(q.leagueEntryId)),
    [squads, pairedLeagueEntryIds]
  );

  const useFixtureLayout = gwMatches.length > 0;

  const metaLine = eventSnapshot
    ? [
        eventSnapshot.finished ? 'Finished' : 'In progress / upcoming',
        eventSnapshot.is_current ? '· FPL current GW' : '',
        eventSnapshot.is_next ? '· FPL next GW' : '',
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  return (
    <div className="dashboard-stack live-scores-root">
      <section className="tile tile--compact" aria-labelledby="live-heading">
        <h2 id="live-heading" className="tile-title tile-title--sm">
          Live scores
        </h2>

        {!proxyHost ? (
          <div className="data-banner data-banner--error" role="alert">
            <strong>No proxy in this JavaScript build.</strong>{' '}
            {isLikelyLocalDev() ? (
              <>
                For <strong>local dev</strong>, create <code>web/.env.local</code> with{' '}
                <code>
                  VITE_FPL_PROXY_URL=https://…workers.dev
                </code>{' '}
                (same URL as your Cloudflare Worker / GitHub secret). Copy{' '}
                <code>web/.env.local.example</code> → <code>.env.local</code>, edit the URL, then{' '}
                <strong>restart</strong> Vite (<code>Ctrl+C</code> and <code>npx vite</code> again).
              </>
            ) : (
              <>
                <code>VITE_FPL_PROXY_URL</code> was empty at build time, so the browser calls FPL
                directly and usually gets <em>Failed to fetch</em> on GitHub Pages. Add the secret,
                then <strong>re-run the deploy workflow</strong>. Check <code>deploy-check.json</code>{' '}
                — <code>liveProxyConfigured</code> should be <code>true</code>.
              </>
            )}
          </div>
        ) : null}

        {allMissingFplId ? (
          <div className="data-banner" role="status">
            <strong>No FPL entry ids</strong> — sample/demo <code>details.json</code> omits{' '}
            <code>entry_id</code> on each team. Ingest your real draft league so each manager has an{' '}
            <code>entry_id</code> (the number from the FPL game URL).
          </div>
        ) : null}

        <div className="live-toolbar">
          <label className="live-gw-label">
            <select
              className="live-gw-select"
              aria-label="Gameweek"
              value={gameweek}
              onChange={(e) => onGameweekChange(Number(e.target.value))}
            >
              {gwOptions.length ? (
                gwOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                    {o.finished ? ' ✓' : ''}
                    {o.is_current ? ' (current)' : ''}
                  </option>
                ))
              ) : (
                <option value={gameweek}>GW {gameweek}</option>
              )}
            </select>
          </label>
          <button
            type="button"
            className="live-refresh-btn"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh from FPL'}
          </button>
        </div>

        {metaLine ? <p className="muted live-meta">{metaLine}</p> : null}
        {lastUpdated ? (
          <p className="muted muted--tight live-updated">
            Last fetch: {new Date(lastUpdated).toLocaleString()}
          </p>
        ) : null}

        {error ? (
          <div className="data-banner data-banner--error" role="alert">
            <strong>Could not load live data.</strong> {error}{' '}
            <span className="muted">
              On GitHub Pages, set <code>VITE_FPL_PROXY_URL</code> to your Worker (see{' '}
              <code>web/workers/fpl-proxy/README.md</code>) and redeploy.
            </span>
          </div>
        ) : null}
      </section>

      {useFixtureLayout
        ? gwMatches.map((m) => {
            const homeId = Number(m.league_entry_1);
            const awayId = Number(m.league_entry_2);
            const homeName = teamNameForEntry(teams, homeId);
            const awayName = teamNameForEntry(teams, awayId);
            const homeSquad = squadByLeagueEntry.get(homeId);
            const awaySquad = squadByLeagueEntry.get(awayId);
            const homeLive = liveGwDisplayTotal(homeSquad);
            const awayLive = liveGwDisplayTotal(awaySquad);
            const homeLead =
              homeLive != null && awayLive != null && homeLive > awayLive;
            const awayLead =
              homeLive != null && awayLive != null && awayLive > homeLive;

            const homeLtp = homeSquad?.leftToPlayCount;
            const awayLtp = awaySquad?.leftToPlayCount;

            const fixtureKey = `${homeId}-${awayId}-${gameweek}`;
            const lineupOpen = expandedFixtures.has(fixtureKey);
            const fixtureBodyId = `live-fixture-lineups-${fixtureKey}`;

            return (
              <section
                key={fixtureKey}
                className="tile tile--compact live-fixture-tile"
                aria-label={
                  typeof homeLtp === 'number' && typeof awayLtp === 'number'
                    ? `${homeName}, ${homeLtp} left to play, vs ${awayName}, ${awayLtp} left to play`
                    : `${homeName} vs ${awayName}`
                }
              >
                <button
                  type="button"
                  className="live-fixture-banner live-fixture-banner--toggle"
                  onClick={() => toggleFixtureExpanded(fixtureKey)}
                  aria-expanded={lineupOpen}
                  aria-controls={fixtureBodyId}
                >
                  <span className="live-fixture-chevron live-fixture-chevron--desktop" aria-hidden>
                    {lineupOpen ? '▼' : '▶'}
                  </span>
                  <span className="live-fixture-banner__row">
                    <span className="live-fixture-banner__team live-fixture-banner__team--home">
                      <span className="live-fixture-banner__team-avatar">
                        <TeamAvatar
                          entryId={homeId}
                          name={homeName}
                          size="sm"
                          logoMap={teamLogoMap}
                        />
                      </span>
                      <span className="live-fixture-banner__team-text live-fixture-banner__team-text--home">
                        <span className="live-fixture-banner__team-inner">
                          <span className="live-fixture-banner__name-line">
                            <span
                              className={`live-fixture-banner__name ${homeLead ? 'live-fixture-banner__name--lead' : ''}`}
                            >
                              {homeName}
                            </span>
                          </span>
                          {typeof homeLtp === 'number' ? (
                            <span className="live-fixture-banner__ltp-line">
                              <LeftToPlayOutsideAfter count={homeLtp} leadingSpace={false} />
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </span>

                    <span className="live-fixture-banner__vs-sep" aria-hidden="true">
                      vs
                    </span>

                    <span className="live-fixture-banner__scorebox" aria-label="Gameweek points comparison">
                      <span className="live-fixture-banner__score-row">
                        <span
                          className="live-fixture-banner__score-avatar live-fixture-banner__score-avatar--home"
                          aria-hidden="true"
                        >
                          <TeamAvatar
                            entryId={homeId}
                            name={homeName}
                            size="sm"
                            logoMap={teamLogoMap}
                          />
                        </span>
                        {homeLive != null && awayLive != null ? (
                          <span className="live-fixture-banner__live-score tabular">
                            <span className={homeLead ? 'live-fixture-pts--lead' : ''}>{homeLive}</span>
                            <span className="live-fixture-banner__dash">–</span>
                            <span className={awayLead ? 'live-fixture-pts--lead' : ''}>{awayLive}</span>
                          </span>
                        ) : (
                          <span className="live-fixture-vs">v</span>
                        )}
                        <span
                          className="live-fixture-banner__score-avatar live-fixture-banner__score-avatar--away"
                          aria-hidden="true"
                        >
                          <TeamAvatar
                            entryId={awayId}
                            name={awayName}
                            size="sm"
                            logoMap={teamLogoMap}
                          />
                        </span>
                      </span>
                      <span className="muted live-fixture-banner__score-caption">GW pts (live)</span>
                    </span>

                    <span className="live-fixture-banner__team live-fixture-banner__team--away">
                      <span className="live-fixture-banner__team-text live-fixture-banner__team-text--away">
                        <span className="live-fixture-banner__team-inner">
                          <span className="live-fixture-banner__name-line">
                            <span
                              className={`live-fixture-banner__name ${awayLead ? 'live-fixture-banner__name--lead' : ''}`}
                            >
                              {awayName}
                            </span>
                          </span>
                          {typeof awayLtp === 'number' ? (
                            <span className="live-fixture-banner__ltp-line">
                              <LeftToPlayOutsideAfter count={awayLtp} leadingSpace={false} />
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="live-fixture-banner__team-avatar">
                        <TeamAvatar
                          entryId={awayId}
                          name={awayName}
                          size="sm"
                          logoMap={teamLogoMap}
                        />
                      </span>
                    </span>
                  </span>
                  {/* Mobile: bottom affordance — ▼ = collapsed (lineup below), ▲ = expanded (hide). */}
                  <span className="live-fixture-banner__expand-foot">
                    <span className="live-fixture-chevron live-fixture-chevron--mobile" aria-hidden>
                      {!lineupOpen ? '▼' : '▲'}
                    </span>
                  </span>
                </button>

                {lineupOpen ? (
                <div className="live-fixture-split" id={fixtureBodyId}>
                  <div className="live-fixture-column">
                    <div className="live-fixture-column-head">
                      <h3 className="live-fixture-column-title">
                        {homeName}
                        <LeftToPlayOutsideAfter count={homeLtp} />
                      </h3>
                      <div className="live-squad-meta tabular">
                        {homeLive != null ? (
                          <span className="live-squad-pts">
                            <strong>{homeLive}</strong> GW pts
                          </span>
                        ) : null}
                        {homeSquad?.pointsOnBench != null ? (
                          <span className="muted">Bench: {homeSquad.pointsOnBench} pts</span>
                        ) : null}
                      </div>
                    </div>
                    <SquadLineupPanel squad={homeSquad} />
                  </div>
                  <div className="live-fixture-divider" aria-hidden="true" />
                  <div className="live-fixture-column">
                    <div className="live-fixture-column-head">
                      <h3 className="live-fixture-column-title">
                        {awayName}
                        <LeftToPlayOutsideAfter count={awayLtp} />
                      </h3>
                      <div className="live-squad-meta tabular">
                        {awayLive != null ? (
                          <span className="live-squad-pts">
                            <strong>{awayLive}</strong> GW pts
                          </span>
                        ) : null}
                        {awaySquad?.pointsOnBench != null ? (
                          <span className="muted">Bench: {awaySquad.pointsOnBench} pts</span>
                        ) : null}
                      </div>
                    </div>
                    <SquadLineupPanel squad={awaySquad} />
                  </div>
                </div>
                ) : null}
              </section>
            );
          })
        : squads.map((squad) => (
            <section
              key={squad.leagueEntryId}
              className="tile tile--compact live-squad-tile"
              aria-labelledby={`live-squad-${squad.leagueEntryId}`}
            >
              <div className="live-squad-head">
                <h3
                  id={`live-squad-${squad.leagueEntryId}`}
                  className="live-squad-title"
                  title={
                    squad.fplEntryId != null
                      ? `Squad from draft FPL API · entry_id ${squad.fplEntryId} (league_entries.entry_id)`
                      : undefined
                  }
                >
                  <TeamAvatar
                    entryId={squad.leagueEntryId}
                    name={squad.teamName}
                    size="sm"
                    logoMap={teamLogoMap}
                  />
                  <span>
                    {squad.teamName}
                    <LeftToPlayOutsideAfter count={squad.leftToPlayCount} />
                  </span>
                </h3>
                <div className="live-squad-meta tabular">
                  {liveGwDisplayTotal(squad) != null ? (
                    <span className="live-squad-pts">
                      <strong>{liveGwDisplayTotal(squad)}</strong> GW pts
                    </span>
                  ) : null}
                  {squad.pointsOnBench != null ? (
                    <span className="muted">Bench: {squad.pointsOnBench} pts</span>
                  ) : null}
                </div>
              </div>
              <SquadLineupPanel squad={squad} />
            </section>
          ))}

      {useFixtureLayout && orphanSquads.length > 0
        ? orphanSquads.map((squad) => (
            <section
              key={`orphan-${squad.leagueEntryId}`}
              className="tile tile--compact live-squad-tile live-squad-tile--orphan"
              aria-labelledby={`live-squad-o-${squad.leagueEntryId}`}
            >
              <p className="muted muted--tight live-orphan-note">
                No H2H pairing in schedule for this GW — showing squad only.
              </p>
              <div className="live-squad-head">
                <h3
                  id={`live-squad-o-${squad.leagueEntryId}`}
                  className="live-squad-title"
                  title={
                    squad.fplEntryId != null
                      ? `Squad from draft FPL API · entry_id ${squad.fplEntryId}`
                      : undefined
                  }
                >
                  <TeamAvatar
                    entryId={squad.leagueEntryId}
                    name={squad.teamName}
                    size="sm"
                    logoMap={teamLogoMap}
                  />
                  <span>
                    {squad.teamName}
                    <LeftToPlayOutsideAfter count={squad.leftToPlayCount} />
                  </span>
                </h3>
                <div className="live-squad-meta tabular">
                  {liveGwDisplayTotal(squad) != null ? (
                    <span className="live-squad-pts">
                      <strong>{liveGwDisplayTotal(squad)}</strong> GW pts
                    </span>
                  ) : null}
                </div>
              </div>
              <SquadLineupPanel squad={squad} />
            </section>
          ))
        : null}

      <section
        className="tile tile--compact tile--live-standings"
        aria-labelledby="live-standings-heading"
      >
        <div className="tile-head-row tile-head-row--tight">
          <h2 id="live-standings-heading" className="tile-title tile-title--sm">
            Live standings
          </h2>
          <span className="league-pill league-pill--sm">GW {gameweek}</span>
        </div>
        {!tableRows?.length ? (
          <p className="muted muted--tight">No standings data.</p>
        ) : (
          <div className="table-scroll table-scroll--standings-open">
            <table className="standings-table standings-table--sidebar standings-table--live">
              <thead>
                <tr>
                  <th className="col-rank" title="Position by projected points this GW">
                    #
                  </th>
                  <th className="col-team">Team</th>
                  <th className="col-num col-pl">PL</th>
                  <th className="col-num col-wdl">W</th>
                  <th className="col-num col-wdl">D</th>
                  <th className="col-num col-wdl">L</th>
                  <th
                    className="col-num col-for"
                    title="Season points for, plus this GW’s live score vs your opponent"
                  >
                    For
                  </th>
                  <th
                    className="col-num col-faced"
                    title="Season points against, plus your opponent’s live GW score vs you (when paired)"
                  >
                    Faced
                  </th>
                  <th
                    className="col-num col-gd"
                    title="Projected GD: projected For minus projected Faced"
                  >
                    GD
                  </th>
                  <th
                    className="col-num col-live-gw"
                    title="League points from this GW’s live fixture: +3 win, +1 draw, 0 loss"
                  >
                    GW
                  </th>
                  <th
                    className="col-num col-pts"
                    title="Season H2H points plus 3 / 1 / 0 from live score vs opponent this GW"
                  >
                    PTS
                  </th>
                </tr>
              </thead>
              <tbody>
                {liveStandingsRows.map((row) => {
                  const isLeader = row.liveRank === 1;
                  const rowClass = [
                    isLeader ? 'row-highlight' : '',
                    row.liveRank === 1 ? 'standings-row--divider-below' : '',
                    row.liveRank === 8
                      ? 'standings-row--divider-above standings-row--8th'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  const moveUp = row.rankMove > 0;
                  const moveDown = row.rankMove < 0;
                  return (
                    <tr key={row.league_entry} className={rowClass || undefined}>
                      <td className="col-rank">
                        {row.liveRank === 8 ? (
                          <span
                            role="img"
                            className="standings-rank-8"
                            aria-label="8"
                          >
                            🧩
                          </span>
                        ) : (
                          row.liveRank
                        )}
                      </td>
                      <td className="col-team">
                        <span className="team-cell">
                          <TeamAvatar
                            entryId={row.league_entry}
                            name={row.teamName}
                            size="sm"
                            logoMap={teamLogoMap}
                          />
                          <span className="team-name team-name--sidebar live-standings-team-name">
                            {row.teamName}
                            {moveUp ? (
                              <span
                                className="live-standings-move live-standings-move--up"
                                title={`Up ${row.rankMove} vs league #${row.rank}`}
                                aria-label={`Up ${row.rankMove} places vs league position ${row.rank}`}
                              >
                                ↑
                              </span>
                            ) : null}
                            {moveDown ? (
                              <span
                                className="live-standings-move live-standings-move--down"
                                title={`Down ${-row.rankMove} vs league #${row.rank}`}
                                aria-label={`Down ${-row.rankMove} places vs league position ${row.rank}`}
                              >
                                ↓
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </td>
                      <td className="col-num col-pl">{row.pl}</td>
                      <td className="col-num col-wdl">{row.matches_won}</td>
                      <td className="col-num col-wdl">{row.matches_drawn}</td>
                      <td className="col-num col-wdl">{row.matches_lost}</td>
                      <td
                        className="col-num col-for tabular"
                        title={`Season ${row.gf} + GW live${row.liveGw != null ? ` (${row.liveGw})` : ''}`}
                      >
                        {row.projectedFor}
                      </td>
                      <td
                        className="col-num col-faced tabular"
                        title={`Season ${row.ga} + opponent GW${row.oppLiveGw != null ? ` (${row.oppLiveGw})` : ''}`}
                      >
                        {row.projectedGa}
                      </td>
                      <td className="col-num col-gd tabular">
                        {row.projectedGd > 0
                          ? `+${row.projectedGd}`
                          : row.projectedGd}
                      </td>
                      <td className="col-num col-live-gw tabular">
                        <strong
                          className={
                            row.h2hBonus === 3
                              ? 'live-standings-gw-val live-standings-gw-val--win'
                              : row.h2hBonus === 1
                                ? 'live-standings-gw-val live-standings-gw-val--draw'
                                : 'live-standings-gw-val live-standings-gw-val--loss'
                          }
                        >
                          {formatGwLeaguePtsBonus(row.h2hBonus)}
                        </strong>
                      </td>
                      <td className="col-num col-pts tabular">
                        <strong>{row.projectedPts}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="table-foot muted standings-landscape-hint">
          On mobile, turn your device to landscape for the full table.
        </p>
      </section>
    </div>
  );
}

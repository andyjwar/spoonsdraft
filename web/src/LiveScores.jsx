import { useMemo, useState, useCallback } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { useLiveScores } from './useLiveScores';

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
          <col className="live-picks-col-num" />
          <col className="live-picks-col-alarm" />
          <col className="live-picks-col-num live-picks-col-pts" />
          <col className="live-picks-col-num" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="live-picks-col-player">
              Player
            </th>
            <th scope="col" className="live-picks-col-pos">
              Pos
            </th>
            <th scope="col" className="live-picks-col-num" title="Minutes">
              Mins
            </th>
            <th
              scope="col"
              className="live-picks-col-alarm live-picks-col-alarm--head"
              aria-label="Defensive contribution"
              title="Shows when FPL awards exactly 2 pts from defensive contributions in live explain."
            />
            <th
              scope="col"
              className="live-picks-col-num live-picks-col-pts"
              title="Live FPL points; bonus in the total matches the Bonus column (including BPS estimate when not yet posted)."
            >
              Pts
            </th>
            <th
              scope="col"
              className="live-picks-col-num"
              title="FPL bonus when posted or after your fixtures finish; otherwise estimated from live BPS and official tie rules."
            >
              Bonus
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
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
              <td className="live-picks-col-num tabular">{r.minutes}</td>
              <td
                className="live-picks-col-alarm tabular"
                {...(r.defensiveContribAlarm
                  ? { 'aria-label': '2 points from defensive contributions' }
                  : {})}
              >
                {r.defensiveContribAlarm ? (
                  <span className="live-defensive-alarm" title="2 pts from defensive contributions (FPL live explain)">
                    🚨
                  </span>
                ) : null}
              </td>
              <td className="live-picks-col-num live-picks-col-pts tabular">
                <strong>{r.total_points}</strong>
              </td>
              <td className="live-picks-col-num tabular">{r.bonus}</td>
            </tr>
          ))}
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

function teamNameForEntry(teams, leagueEntryId) {
  return teams?.find((t) => t.id === leagueEntryId)?.teamName ?? `Team ${leagueEntryId}`;
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
      <PicksTable rows={squad.starters} />
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
 * @param {{ teams: Array<{ id: number, teamName: string, fplEntryId: number | null }>, matches?: Array<{ event: number, league_entry_1: number, league_entry_2: number, finished?: boolean, league_entry_1_points?: number, league_entry_2_points?: number }>, gameweek: number, onGameweekChange: (n: number) => void, onBootstrapLiveMeta?: (meta: { currentGw: number | null }) => void, teamLogoMap: object }}
 */
export function LiveScores({
  teams,
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
            <span className="muted">Gameweek</span>
            <select
              className="live-gw-select"
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

            const fixtureKey = `${homeId}-${awayId}-${gameweek}`;
            const lineupOpen = expandedFixtures.has(fixtureKey);
            const fixtureBodyId = `live-fixture-lineups-${fixtureKey}`;

            return (
              <section
                key={fixtureKey}
                className="tile tile--compact live-fixture-tile"
                aria-label={`${homeName} vs ${awayName}`}
              >
                <button
                  type="button"
                  className="live-fixture-banner live-fixture-banner--toggle"
                  onClick={() => toggleFixtureExpanded(fixtureKey)}
                  aria-expanded={lineupOpen}
                  aria-controls={fixtureBodyId}
                >
                  <span className="live-fixture-chevron" aria-hidden>
                    {lineupOpen ? '▼' : '▶'}
                  </span>
                  <span className="live-fixture-banner__row">
                    <span className="live-fixture-banner__team live-fixture-banner__team--home">
                      <TeamAvatar
                        entryId={homeId}
                        name={homeName}
                        size="sm"
                        logoMap={teamLogoMap}
                      />
                      <span className="live-fixture-banner__team-text">
                        <span
                          className={`live-fixture-banner__name ${homeLead ? 'live-fixture-banner__name--lead' : ''}`}
                        >
                          {homeName}
                        </span>
                      </span>
                    </span>

                    <span className="live-fixture-banner__scorebox" aria-label="Gameweek points comparison">
                      {homeLive != null && awayLive != null ? (
                        <span className="live-fixture-banner__live-score tabular">
                          <span className={homeLead ? 'live-fixture-pts--lead' : ''}>{homeLive}</span>
                          <span className="live-fixture-banner__dash">–</span>
                          <span className={awayLead ? 'live-fixture-pts--lead' : ''}>{awayLive}</span>
                        </span>
                      ) : (
                        <span className="live-fixture-vs">v</span>
                      )}
                      <span className="muted live-fixture-banner__score-caption">GW pts (live)</span>
                    </span>

                    <span className="live-fixture-banner__team live-fixture-banner__team--away">
                      <span className="live-fixture-banner__team-text live-fixture-banner__team-text--end">
                        <span
                          className={`live-fixture-banner__name ${awayLead ? 'live-fixture-banner__name--lead' : ''}`}
                        >
                          {awayName}
                        </span>
                      </span>
                      <TeamAvatar
                        entryId={awayId}
                        name={awayName}
                        size="sm"
                        logoMap={teamLogoMap}
                      />
                    </span>
                  </span>
                </button>

                {lineupOpen ? (
                <div className="live-fixture-split" id={fixtureBodyId}>
                  <div className="live-fixture-column">
                    <div className="live-fixture-column-head">
                      <h3 className="live-fixture-column-title">{homeName}</h3>
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
                      <h3 className="live-fixture-column-title">{awayName}</h3>
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
                  <span>{squad.teamName}</span>
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
                  <span>{squad.teamName}</span>
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
    </div>
  );
}

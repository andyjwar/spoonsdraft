import { useState, useEffect, useCallback, useRef } from 'react';
import {
  allFixturesFinished,
  computeProvisionalGwBonusByElementId,
  participatingFixtureIdsForElement,
  selectDisplayBonus,
} from './fplBonusFromBps';

/** Classic host — only used when resolving `fplApiBase()` with no proxy / non-dev. */
const FPL_DIRECT = 'https://fantasy.premierleague.com/api';

/** Draft API base (picks, bootstrap, live). IDs here ≠ classic FPL for the same number. */
const DRAFT_DIRECT = 'https://draft.premierleague.com/api';

/**
 * - **Production / preview:** `VITE_FPL_PROXY_URL` = Cloudflare Worker (must support `/draft/*`).
 * - **`npm run dev`:** if that env is **unset or empty**, use same-origin `/__fpl/*` (Vite proxy in vite.config.js).
 */
function fplApiBase() {
  const raw = import.meta.env.VITE_FPL_PROXY_URL;
  const trimmed = raw != null ? String(raw).trim() : '';
  if (trimmed !== '') {
    return trimmed.replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return '/__fpl';
  }
  return FPL_DIRECT;
}

/**
 * Resource path under draft.premierleague.com/api — no leading slash.
 * Draft `event/{gw}/live` 404s with a trailing slash; classic does not.
 */
function draftResourceUrl(path) {
  const p = String(path).replace(/^\/+/, '');
  const base = fplApiBase();
  if (base !== FPL_DIRECT) {
    return `${base}/draft/${p}`;
  }
  if (import.meta.env.DEV) {
    return `/__fpl/draft/${p}`;
  }
  return `${DRAFT_DIRECT}/${p}`;
}

/** Classic `fantasy.premierleague.com/api` path + query (fixtures, …). */
function classicResourceUrl(pathAndQuery) {
  const pq = String(pathAndQuery).replace(/^\/+/, '');
  const base = fplApiBase();
  if (base !== FPL_DIRECT) {
    return `${base.replace(/\/$/, '')}/${pq}`;
  }
  if (import.meta.env.DEV) {
    return `/__fpl/${pq}`;
  }
  return `${FPL_DIRECT}/${pq}`;
}

/**
 * @param {number} entryId FPL `entry_id` from draft `league_entries` (not `league_entry` id).
 * @param {number} gameweek
 */
function draftGameweekPicksUrl(entryId, gameweek) {
  const base = fplApiBase();
  if (base !== FPL_DIRECT) {
    return `${base}/draft/entry/${entryId}/event/${gameweek}`;
  }
  return `${DRAFT_DIRECT}/entry/${entryId}/event/${gameweek}`;
}

/** Draft bootstrap nests gameweeks in `events.data`; classic uses `events` array. */
function bootstrapEventList(boot) {
  const ev = boot?.events;
  if (ev && Array.isArray(ev.data)) return ev.data;
  if (Array.isArray(ev)) return ev;
  return [];
}

/** Draft `event/{gw}/live` returns `elements` as an id → { stats } map. */
function liveStatsByElementId(draftLiveJson) {
  const raw = draftLiveJson?.elements;
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      out[id] = (v && v.stats) || {};
    }
    return out;
  }
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      out[id] = row.stats || {};
    }
  }
  return out;
}

/** Draft + classic live payloads: id → full element row (stats + explain). */
function liveFullByElementId(liveJson) {
  const raw = liveJson?.elements;
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      out[id] = v;
    }
    return out;
  }
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      out[id] = row;
    }
  }
  return out;
}

function shirtUrl(teamId) {
  if (teamId == null) return null;
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamId}-1.png`;
}

function badgeUrl(teamCode) {
  if (teamCode == null) return null;
  return `https://resources.premierleague.com/premierleague/badges/50/t${teamCode}.png`;
}

function displayPlayerName(el, elementId) {
  if (!el) return `Player #${elementId}`;
  const known = el.known_name?.trim();
  if (known) return known;
  const parts = [el.first_name, el.second_name].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return el.web_name ?? `Player #${elementId}`;
}

function mapPickRows(picks, liveByElementId, elementById, teamById, typeById) {
  const rows = (picks || []).map((p) => {
    const pid = Number(p.element);
    const el = elementById[pid];
    const tm = el ? teamById[el.team] : null;
    const typ = el ? typeById[el.element_type] : null;
    const st = liveByElementId[pid] || {};
    const mins = st.minutes ?? 0;
    const pts = st.total_points ?? 0;
    const bps = st.bps ?? 0;
    const bonusApi = st.bonus ?? 0;
    const webName = el?.web_name ?? `Player #${pid}`;
    return {
      element: pid,
      web_name: webName,
      displayName: displayPlayerName(el, pid),
      teamShort: tm?.short_name ?? '—',
      teamName: tm?.name ?? null,
      posSingular: typ?.singular_name_short ?? '—',
      shirtUrl: shirtUrl(el?.team),
      badgeUrl: badgeUrl(tm?.code),
      minutes: mins,
      total_points: pts,
      bps,
      bonusApi,
      bonus: bonusApi,
      pickPosition: p.position,
    };
  });
  rows.sort((a, b) => a.pickPosition - b.pickPosition);
  return rows;
}

function applyBonusColumn(rows, ctx) {
  const { elementById, liveFullByElementId: liveFull, provisionalByElement, fixtureById, gwFixtures } =
    ctx;
  return rows.map((r) => {
    const el = elementById[r.element];
    const liveRow = liveFull[r.element];
    const fxIds = participatingFixtureIdsForElement(el, liveRow, gwFixtures);
    const finished = allFixturesFinished(fxIds, fixtureById);
    const prov = provisionalByElement.get(r.element) ?? 0;
    const display = selectDisplayBonus(r.bonusApi, prov, finished);
    const total_points =
      Number(r.total_points) - Number(r.bonusApi) + Number(display);
    return { ...r, bonus: display, total_points };
  });
}

/**
 * Live GW data from **draft** FPL APIs (browser fetch).
 * Uses draft bootstrap + draft event/live so element IDs match draft picks (classic uses a different id→player map).
 * @param {{ teams: Array<{ id: number, teamName: string, fplEntryId: number | null }>, gameweek: number | null, enabled: boolean }} opts
 */
export function useLiveScores({ teams, gameweek, enabled }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventSnapshot, setEventSnapshot] = useState(null);
  const [squads, setSquads] = useState([]);

  /** Parent passes a new `teams` array each render; ref avoids infinite load loops. */
  const teamsRef = useRef(teams);
  teamsRef.current = teams;

  /** When this goes 0 → N, we must re-fetch (load is not tied to `teams` by reference). */
  const teamCount = teams?.length ?? 0;

  const load = useCallback(async () => {
    const teamList = teamsRef.current;
    const gw = Number(gameweek);
    if (!enabled || !Number.isFinite(gw) || !teamList?.length) return;

    setLoading(true);
    setError(null);

    try {
      const bootUrl = draftResourceUrl('bootstrap-static');
      const bootRes = await fetch(bootUrl);
      if (!bootRes.ok) {
        throw new Error(`draft bootstrap-static HTTP ${bootRes.status}`);
      }
      const boot = await bootRes.json();
      const evRoot = boot.events;
      const evList = bootstrapEventList(boot);
      const currentGw = evRoot?.current;
      const nextGw = evRoot?.next;
      const evs = evList.map((e) => ({
        ...e,
        is_current: e.id === currentGw,
        is_next: e.id === nextGw,
      }));
      setEvents(evs);
      const ev = evs.find((e) => e.id === gw);
      setEventSnapshot(ev ?? { id: gw, name: `Gameweek ${gw}` });

      const elementById = Object.fromEntries(
        (boot.elements || []).map((e) => [Number(e.id), e])
      );
      const teamById = Object.fromEntries(
        (boot.teams || []).map((t) => [Number(t.id), t])
      );
      const typeById = Object.fromEntries(
        (boot.element_types || []).map((t) => [Number(t.id), t])
      );

      const liveUrl = draftResourceUrl(`event/${gw}/live`);
      const liveRes = await fetch(liveUrl);
      if (!liveRes.ok) {
        throw new Error(`draft event/live HTTP ${liveRes.status}`);
      }
      const liveJson = await liveRes.json();
      const liveByElementId = liveStatsByElementId(liveJson);
      const liveFull = liveFullByElementId(liveJson);

      const fxUrl = classicResourceUrl(`fixtures?event=${gw}`);
      const fxRes = await fetch(fxUrl);
      if (!fxRes.ok) {
        throw new Error(`classic fixtures HTTP ${fxRes.status}`);
      }
      const fixturesPayload = await fxRes.json();
      const gwFixtures = Array.isArray(fixturesPayload)
        ? fixturesPayload.filter((f) => Number(f.event) === gw)
        : [];
      const fixtureById = new Map(gwFixtures.map((f) => [Number(f.id), f]));

      const provisionalByElement = computeProvisionalGwBonusByElementId(
        boot.elements || [],
        liveFull,
        gwFixtures
      );

      const bonusCtx = {
        elementById,
        liveFullByElementId: liveFull,
        provisionalByElement,
        fixtureById,
        gwFixtures,
      };

      const squadList = await Promise.all(
        teamList.map(async (t) => {
          if (t.fplEntryId == null) {
            return {
              leagueEntryId: t.id,
              teamName: t.teamName,
              fplEntryId: null,
              error:
                'Missing FPL entry id in league data (need real details.json with entry_id).',
              starters: [],
              bench: [],
              gwPoints: null,
              autoSubs: [],
            };
          }

          const url = draftGameweekPicksUrl(t.fplEntryId, gw);
          const pr = await fetch(url);
          if (!pr.ok) {
            return {
              leagueEntryId: t.id,
              teamName: t.teamName,
              fplEntryId: t.fplEntryId,
              error: `Draft picks HTTP ${pr.status}`,
              starters: [],
              bench: [],
              gwPoints: null,
              autoSubs: [],
            };
          }
          const picksPayload = await pr.json();
          const picks = picksPayload.picks || [];
          const rows = mapPickRows(
            picks,
            liveByElementId,
            elementById,
            teamById,
            typeById
          );
          const withBonus = applyBonusColumn(rows, bonusCtx);
          const starters = withBonus.filter((r) => r.pickPosition <= 11);
          const bench = withBonus.filter((r) => r.pickPosition > 11);

          const eh = picksPayload.entry_history;
          const gwPoints =
            eh && typeof eh.points === 'number' ? eh.points : null;
          const pointsOnBench =
            eh && typeof eh.points_on_bench === 'number'
              ? eh.points_on_bench
              : null;
          const autoSubs =
            picksPayload.automatic_subs ?? picksPayload.subs ?? [];

          return {
            leagueEntryId: t.id,
            teamName: t.teamName,
            fplEntryId: t.fplEntryId,
            error: null,
            starters,
            bench,
            gwPoints,
            pointsOnBench,
            autoSubs,
          };
        })
      );

      setSquads(squadList);
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      setError(e?.message || String(e));
      setSquads([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, gameweek, teamCount]);

  useEffect(() => {
    if (
      enabled &&
      gameweek != null &&
      Number.isFinite(Number(gameweek)) &&
      teamCount > 0
    ) {
      void load();
    }
  }, [enabled, gameweek, load, teamCount]);

  return {
    loading,
    error,
    refresh: load,
    lastUpdated,
    events,
    eventSnapshot,
    squads,
  };
}

/**
 * FPL bonus points from BPS tiers + tie rules (mirrors official tie-breaking).
 * Provisional until FPL publishes stats.bonus; use selectDisplayBonus() for one column.
 */

/**
 * @param {Array<{ id: number, bps: number }>} players
 * @returns {Array<Array<{ id: number, bps: number }>>}
 */
export function groupByBpsDesc(players) {
  const sorted = [...players].sort((a, b) => b.bps - a.bps);
  const groups = [];
  for (const p of sorted) {
    const last = groups[groups.length - 1];
    if (!last || last[0].bps !== p.bps) groups.push([p]);
    else last.push(p);
  }
  return groups;
}

/**
 * @param {Array<Array<{ id: number }>>} groups — same BPS, best group first
 * @returns {Map<number, number>} element id → bonus (0–3) for this fixture only
 */
export function bonusFromBpsGroups(groups) {
  const m = new Map();
  const g = (i) => groups[i] || [];
  const give = (idx, pts) => {
    for (const p of g(idx)) m.set(p.id, pts);
  };

  if (!groups.length) return m;

  const n0 = g(0).length;
  if (n0 >= 3) {
    give(0, 3);
    return m;
  }
  if (n0 === 2) {
    give(0, 3);
    if (g(1).length) {
      for (const p of g(1)) m.set(p.id, 1);
    }
    return m;
  }

  give(0, 3);
  if (!g(1).length) return m;

  const n1 = g(1).length;
  if (n1 >= 3) {
    give(1, 2);
    return m;
  }
  if (n1 === 2) {
    give(1, 2);
    return m;
  }

  give(1, 2);
  if (!g(2).length) return m;

  const n2 = g(2).length;
  if (n2 >= 3) {
    give(2, 1);
    return m;
  }
  if (n2 === 2) {
    give(2, 1);
    return m;
  }

  give(2, 1);
  return m;
}

/**
 * Draft: explain is [ [ [ { stat, value, ... } ], fixtureId ], ... ]
 * Classic: [ { fixture, stats: [ { identifier, value } ] }, ... ]
 *
 * @param {object} raw — live row (not just .stats)
 * @returns {Array<{ fixtureId: number, minutes: number }>}
 */
export function explainBlocksFromLiveElement(raw) {
  const ex = raw?.explain;
  if (!Array.isArray(ex) || ex.length === 0) return [];

  const first = ex[0];
  if (Array.isArray(first) && first.length === 2 && typeof first[1] === 'number') {
    return ex.map((pair) => {
      const [statList, fixtureId] = pair;
      let minutes = 0;
      for (const s of statList || []) {
        if (s.stat === 'minutes') minutes = Number(s.value) || 0;
      }
      return { fixtureId: Number(fixtureId), minutes };
    });
  }

  if (first && first.fixture != null) {
    return ex.map((block) => {
      let minutes = 0;
      for (const s of block.stats || []) {
        if (s.identifier === 'minutes') minutes = Number(s.value) || 0;
      }
      return { fixtureId: Number(block.fixture), minutes };
    });
  }

  return [];
}

/** @param {object} liveRow */
export function activeExplainBlocks(liveRow) {
  return explainBlocksFromLiveElement(liveRow).filter((b) => b.minutes > 0);
}

/**
 * BPS for a fixture’s bonus race: use aggregate stats.bps only when the player
 * has minutes in exactly one GW fixture (avoids wrong splits on DGW).
 *
 * @returns {number | null} null → skip provisional for this player in this fixture
 */
export function bpsForFixturePool(liveRow, fixtureId) {
  const active = activeExplainBlocks(liveRow);
  const inFixture = active.filter((b) => b.fixtureId === fixtureId && b.minutes > 0);
  if (inFixture.length === 0) return null;
  if (active.length !== 1) return null;
  return Number(liveRow?.stats?.bps ?? 0);
}

/**
 * @param {Array<{ id: number, team_h: number, team_a: number, event?: number }>} gwFixtures
 * @param {number} teamId
 */
export function fixturesForTeamInGw(gwFixtures, teamId) {
  return gwFixtures.filter(
    (f) => Number(f.team_h) === teamId || Number(f.team_a) === teamId
  );
}

/**
 * When explain is empty but minutes > 0, attribute to the only GW fixture for this team.
 *
 * @returns {number | null} fixture id
 */
export function fallbackSingleFixtureId(el, liveRow, gwFixtures) {
  const mins = Number(liveRow?.stats?.minutes ?? 0);
  if (mins <= 0) return null;
  const teamId = Number(el?.team);
  if (!Number.isFinite(teamId)) return null;
  const tf = fixturesForTeamInGw(gwFixtures, teamId);
  if (tf.length !== 1) return null;
  return Number(tf[0].id);
}

/**
 * Fixture ids this element has minutes in, or fallback single-team fixture.
 *
 * @param {object} el — bootstrap element
 * @param {object | null} liveRow
 * @param {object[]} gwFixtures
 * @returns {number[]}
 */
export function participatingFixtureIdsForElement(el, liveRow, gwFixtures) {
  if (!liveRow) return [];
  const active = activeExplainBlocks(liveRow);
  if (active.length > 0) {
    return [...new Set(active.map((b) => b.fixtureId))];
  }
  const fb = fallbackSingleFixtureId(el, liveRow, gwFixtures);
  return fb != null ? [fb] : [];
}

/**
 * BPS for bonus pool: explain path or single-fixture fallback.
 *
 * @returns {number | null}
 */
export function bpsForElementInFixture(el, liveRow, fixtureId, gwFixtures) {
  if (!liveRow) return null;
  const direct = bpsForFixturePool(liveRow, fixtureId);
  if (direct != null) return direct;
  const fb = fallbackSingleFixtureId(el, liveRow, gwFixtures);
  if (fb === fixtureId) return Number(liveRow?.stats?.bps ?? 0);
  return null;
}

/**
 * Sum provisional bonus per element across all fixtures in the GW.
 *
 * @param {object[]} bootElements — bootstrap.elements
 * @param {Record<number, object>} liveFullByElementId — id → full live row
 * @param {object[]} gwFixtures — fixtures for this event only
 * @returns {Map<number, number>}
 */
export function computeProvisionalGwBonusByElementId(
  bootElements,
  liveFullByElementId,
  gwFixtures
) {
  const provisional = new Map();

  for (const fx of gwFixtures) {
    const fh = Number(fx.team_h);
    const fa = Number(fx.team_a);
    if (!Number.isFinite(fh) || !Number.isFinite(fa)) continue;

    const pool = [];
    for (const el of bootElements || []) {
      const tid = Number(el.team);
      if (tid !== fh && tid !== fa) continue;
      const id = Number(el.id);
      const liveRow = liveFullByElementId[id];
      const bps = bpsForElementInFixture(el, liveRow, Number(fx.id), gwFixtures);
      if (bps == null) continue;
      pool.push({ id, bps });
    }

    if (!pool.length) continue;
    const alloc = bonusFromBpsGroups(groupByBpsDesc(pool));
    for (const [eid, pts] of alloc) {
      provisional.set(eid, (provisional.get(eid) || 0) + pts);
    }
  }

  return provisional;
}

/**
 * @param {number[]} fixtureIds
 * @param {Map<number, object>} fixtureById — id → fixture row
 */
export function allFixturesFinished(fixtureIds, fixtureById) {
  if (!fixtureIds.length) return false;
  return fixtureIds.every((id) => fixtureById.get(id)?.finished_provisional === true);
}

/**
 * One column: FPL bonus when settled / posted; else BPS-based provisional.
 *
 * @param {number} apiBonus — stats.bonus
 * @param {number} provisionalSum — sum across GW fixtures
 * @param {boolean} participatingFinished — all fixtures this player played in are finished_provisional
 */
export function selectDisplayBonus(apiBonus, provisionalSum, participatingFinished) {
  if (participatingFinished) return apiBonus;
  if (apiBonus > 0) return apiBonus;
  return provisionalSum;
}

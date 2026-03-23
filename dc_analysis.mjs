import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const leagueDataDir = path.join(__dirname, 'web/public/league-data');

const DRAFT_API = 'https://draft.premierleague.com/api';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Sum FPL points from explain rows for defensive contribution (authoritative). */
function defensiveContributionPointsFromExplain(explain) {
  if (!explain || !Array.isArray(explain)) return 0;
  let sum = 0;
  for (const block of explain) {
    const rows = block[0];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row && row.stat === 'defensive_contribution') sum += row.points;
    }
  }
  return sum;
}

async function runAnalysis() {
  console.log('Defensive contribution impact (starters after auto-subs, GW totals from live explain)…');

  const details = JSON.parse(fs.readFileSync(path.join(leagueDataDir, 'details.json'), 'utf8'));
  const leagueEntries = details.league_entries;
  const matches = details.matches.filter(m => m.finished);

  const entryMap = new Map();
  leagueEntries.forEach(e => {
    entryMap.set(e.id, e.entry_name);
  });

  const lastGw = Math.max(...matches.map(m => m.event));
  console.log(`GW 1–${lastGw}`);

  const gwDataCache = {};
  for (let gw = 1; gw <= lastGw; gw++) {
    console.log(`Fetching live GW ${gw}…`);
    const live = await fetchJSON(`${DRAFT_API}/event/${gw}/live`);
    const playerStats = {};

    const elements = live.elements;
    if (Array.isArray(elements)) {
      elements.forEach(el => {
        playerStats[el.id] = {
          total_points: el.stats.total_points,
          bonus: el.stats.bonus,
          minutes: el.stats.minutes,
          dc_points: defensiveContributionPointsFromExplain(el.explain),
        };
      });
    } else {
      Object.entries(elements).forEach(([id, data]) => {
        playerStats[id] = {
          total_points: data.stats.total_points,
          bonus: data.stats.bonus,
          minutes: data.stats.minutes,
          dc_points: defensiveContributionPointsFromExplain(data.explain),
        };
      });
    }
    gwDataCache[gw] = playerStats;
    await sleep(150);
  }

  const results = [];
  const teamStandings = {};
  leagueEntries.forEach(e => {
    teamStandings[e.id] = {
      name: e.entry_name,
      origW: 0,
      origD: 0,
      origL: 0,
      origPts: 0,
      newW: 0,
      newD: 0,
      newL: 0,
      newPts: 0,
    };
  });

  async function getFinalStarters(fplEntryId, gw) {
    try {
      const picksData = await fetchJSON(`${DRAFT_API}/entry/${fplEntryId}/event/${gw}`);
      const picks = picksData.picks;
      const subs = picksData.automatic_subs || picksData.subs || [];
      const starters = picks.filter(p => p.position <= 11).map(p => p.element);
      subs.forEach(s => {
        const idx = starters.indexOf(s.element_out);
        if (idx !== -1) starters[idx] = s.element_in;
      });
      await sleep(150);
      return starters;
    } catch (e) {
      console.error(`Failed picks entry ${fplEntryId} GW ${gw}: ${e.message}`);
      return [];
    }
  }

  for (const match of matches) {
    const gw = match.event;
    const team1Id = match.league_entry_1;
    const team2Id = match.league_entry_2;
    const team1FplId = leagueEntries.find(e => e.id === team1Id).entry_id;
    const team2FplId = leagueEntries.find(e => e.id === team2Id).entry_id;

    const starters1 = await getFinalStarters(team1FplId, gw);
    const starters2 = await getFinalStarters(team2FplId, gw);

    const stats = gwDataCache[gw];

    const calcTeam = starters => {
      let total = 0;
      let dc = 0;
      starters.forEach(pid => {
        const p = stats[pid] || { total_points: 0, dc_points: 0 };
        total += p.total_points;
        dc += p.dc_points;
      });
      return { total, dc, noDC: total - dc };
    };

    const t1 = calcTeam(starters1);
    const t2 = calcTeam(starters2);

    const p1 = match.league_entry_1_points;
    const p2 = match.league_entry_2_points;
    const originalResult = p1 > p2 ? '1' : p1 < p2 ? '2' : 'D';

    const newResult = t1.noDC > t2.noDC ? '1' : t1.noDC < t2.noDC ? '2' : 'D';

    if (originalResult === '1') {
      teamStandings[team1Id].origW++;
      teamStandings[team2Id].origL++;
      teamStandings[team1Id].origPts += 3;
    } else if (originalResult === '2') {
      teamStandings[team2Id].origW++;
      teamStandings[team1Id].origL++;
      teamStandings[team2Id].origPts += 3;
    } else {
      teamStandings[team1Id].origD++;
      teamStandings[team2Id].origD++;
      teamStandings[team1Id].origPts += 1;
      teamStandings[team2Id].origPts += 1;
    }

    if (newResult === '1') {
      teamStandings[team1Id].newW++;
      teamStandings[team2Id].newL++;
      teamStandings[team1Id].newPts += 3;
    } else if (newResult === '2') {
      teamStandings[team2Id].newW++;
      teamStandings[team1Id].newL++;
      teamStandings[team2Id].newPts += 3;
    } else {
      teamStandings[team1Id].newD++;
      teamStandings[team2Id].newD++;
      teamStandings[team1Id].newPts += 1;
      teamStandings[team2Id].newPts += 1;
    }

    if (originalResult !== newResult) {
      results.push({
        gw,
        team1: entryMap.get(team1Id),
        team2: entryMap.get(team2Id),
        originalScore: `${p1}-${p2}`,
        newScore: `${t1.noDC}-${t2.noDC}`,
        originalWinner:
          originalResult === '1' ? entryMap.get(team1Id) : originalResult === '2' ? entryMap.get(team2Id) : 'Draw',
        newWinner: newResult === '1' ? entryMap.get(team1Id) : newResult === '2' ? entryMap.get(team2Id) : 'Draw',
        dc1: t1.dc,
        dc2: t2.dc,
      });
    }
  }

  console.log('\n--- DONE ---');
  console.log(`Matches: ${matches.length}`);
  console.log(`H2H outcome flips if defensive-contribution points removed: ${results.length}`);

  console.log('\nFlips:');
  results.forEach(r => {
    console.log(`GW${r.gw}: ${r.team1} vs ${r.team2}`);
    console.log(`  Official: ${r.originalScore} (${r.originalWinner})`);
    console.log(`  No DC:   ${r.newScore} (${r.newWinner})`);
    console.log(`  DC sum (XI): ${r.team1}=${r.dc1}, ${r.team2}=${r.dc2}`);
    console.log('---');
  });

  console.log('\n--- STANDINGS (no defensive-contribution points vs official) ---');
  const sorted = Object.values(teamStandings).sort((a, b) => b.newPts - a.newPts || b.newW - a.newW);

  console.log('Rank | Team | Official Pts | No-DC Pts | Diff');
  sorted.forEach((s, i) => {
    const diff = s.newPts - s.origPts;
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    console.log(`${String(i + 1).padStart(4)} | ${s.name.padEnd(22)} | ${String(s.origPts).padStart(12)} | ${String(s.newPts).padStart(9)} | ${diffStr}`);
  });
}

runAnalysis();

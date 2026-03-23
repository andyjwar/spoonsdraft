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

async function main() {
  const details = JSON.parse(fs.readFileSync(path.join(leagueDataDir, 'details.json'), 'utf8'));
  const leagueEntries = details.league_entries;
  const matches = details.matches.filter(m => m.finished);
  const lastGw = Math.max(...matches.map(m => m.event));

  const dcByEntry = Object.fromEntries(leagueEntries.map(e => [e.id, 0]));
  const bonusByEntry = Object.fromEntries(leagueEntries.map(e => [e.id, 0]));
  const gwPerEntryDc = Object.fromEntries(leagueEntries.map(e => [e.id, {}]));
  const gwPerEntryBonus = Object.fromEntries(leagueEntries.map(e => [e.id, {}]));

  async function finalStarters(fplEntryId, gw) {
    const picksData = await fetchJSON(`${DRAFT_API}/entry/${fplEntryId}/event/${gw}`);
    const picks = picksData.picks;
    const subs = picksData.automatic_subs || picksData.subs || [];
    const starters = picks.filter(p => p.position <= 11).map(p => p.element);
    subs.forEach(s => {
      const idx = starters.indexOf(s.element_out);
      if (idx !== -1) starters[idx] = s.element_in;
    });
    await sleep(120);
    return starters;
  }

  for (let gw = 1; gw <= lastGw; gw++) {
    process.stderr.write(`GW ${gw}/${lastGw}…\n`);
    const live = await fetchJSON(`${DRAFT_API}/event/${gw}/live`);
    const elements = live.elements;
    /** @type {Record<string|number, { dc: number, bonus: number }>} */
    const statsByElement = {};

    if (Array.isArray(elements)) {
      elements.forEach(el => {
        statsByElement[el.id] = {
          dc: defensiveContributionPointsFromExplain(el.explain),
          bonus: el.stats?.bonus ?? 0,
        };
      });
    } else {
      Object.entries(elements).forEach(([id, data]) => {
        statsByElement[id] = {
          dc: defensiveContributionPointsFromExplain(data.explain),
          bonus: data.stats?.bonus ?? 0,
        };
      });
    }
    await sleep(120);

    for (const e of leagueEntries) {
      const starters = await finalStarters(e.entry_id, gw);
      let gwDc = 0;
      let gwBonus = 0;
      for (const pid of starters) {
        const s = statsByElement[pid];
        gwDc += s?.dc ?? 0;
        gwBonus += s?.bonus ?? 0;
      }
      dcByEntry[e.id] += gwDc;
      bonusByEntry[e.id] += gwBonus;
      gwPerEntryDc[e.id][gw] = gwDc;
      gwPerEntryBonus[e.id][gw] = gwBonus;
    }
  }

  const base = leagueEntries.map(e => ({
    name: e.entry_name,
    id: e.id,
    dc: dcByEntry[e.id],
    bonus: bonusByEntry[e.id],
  }));

  const rowsDc = [...base].sort((a, b) => b.dc - a.dc);
  const rowsBonus = [...base].sort((a, b) => b.bonus - a.bonus);

  console.log('');
  console.log(`Totals on **starting XI after auto-subs**, GW1–GW${lastGw} (draft live stats).`);
  console.log('');
  console.log('### Defensive contribution (Defcon)');
  console.log('');
  console.log('| Rank | Team | Total DC pts |');
  console.log('| ---: | --- | ---: |');
  rowsDc.forEach((r, i) => {
    console.log(`| ${i + 1} | ${r.name} | ${r.dc} |`);
  });
  console.log('');
  console.log('### Bonus');
  console.log('');
  console.log('| Rank | Team | Total bonus pts |');
  console.log('| ---: | --- | ---: |');
  rowsBonus.forEach((r, i) => {
    console.log(`| ${i + 1} | ${r.name} | ${r.bonus} |`);
  });
  console.log('');
  console.log('Per-gameweek DC:');
  console.log('');
  printGwTable(rowsDc, gwPerEntryDc, lastGw);
  console.log('');
  console.log('Per-gameweek bonus:');
  console.log('');
  printGwTable(rowsBonus, gwPerEntryBonus, lastGw);
}

function printGwTable(rows, gwPerEntryMetric, lastGw) {
  const header = ['GW', ...rows.map(r => r.name.replace(/\|/g, ''))];
  console.log('| ' + header.join(' | ') + ' |');
  console.log('|' + header.map(() => ' --- ').join('|') + '|');
  for (let gw = 1; gw <= lastGw; gw++) {
    const cells = [String(gw), ...rows.map(r => String(gwPerEntryMetric[r.id][gw] ?? 0))];
    console.log('| ' + cells.join(' | ') + ' |');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

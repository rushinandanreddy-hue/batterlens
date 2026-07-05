import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const outputFile = process.argv[2] || "data/cwc-2027-odi.js";
const zipFile = process.argv[3] || path.join(os.tmpdir(), "odis_json.zip");
const downloadUrl = "https://cricsheet.org/downloads/odis_json.zip";

const recentStart = "2023-01-01";
const activeCutoff = "2024-01-01";
const hostConditionStart = "2020-01-01";
const maxPlayersPerTeam = 22;
const hostCountries = ["South Africa", "Zimbabwe", "Namibia"];
const directHostQualifiers = ["South Africa", "Zimbabwe"];

const cityCountries = new Map(
  [
    ["Benoni", "South Africa"],
    ["Bloemfontein", "South Africa"],
    ["Cape Town", "South Africa"],
    ["Centurion", "South Africa"],
    ["Durban", "South Africa"],
    ["East London", "South Africa"],
    ["Gqeberha", "South Africa"],
    ["Johannesburg", "South Africa"],
    ["Kimberley", "South Africa"],
    ["Paarl", "South Africa"],
    ["Potchefstroom", "South Africa"],
    ["Pretoria", "South Africa"],
    ["Bulawayo", "Zimbabwe"],
    ["Harare", "Zimbabwe"],
    ["Windhoek", "Namibia"],
  ].map(([city, country]) => [city.toLowerCase(), country]),
);

const countryConditionNotes = {
  "South Africa":
    "South African ODI venues usually reward batters who handle bounce, new-ball pace and large outfields.",
  Zimbabwe:
    "Zimbabwe ODI venues often become more about tempo control, spin options and avoiding soft dismissals through the middle overs.",
  Namibia:
    "Namibia fixtures in Windhoek have recently produced dry, slower-scoring ODI conditions where dot-ball control matters.",
};

function cleanName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function ensureZip() {
  if (fs.existsSync(zipFile)) return;
  console.log(`Downloading ${downloadUrl}`);
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Cricsheet download failed ${response.status}: ${downloadUrl}`);
  }
  fs.writeFileSync(zipFile, Buffer.from(await response.arrayBuffer()));
}

function zipEntries() {
  return execFileSync("unzip", ["-Z1", zipFile], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter((entry) => entry.endsWith(".json"));
}

function readMatch(entry) {
  return JSON.parse(
    execFileSync("unzip", ["-p", zipFile, entry], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    }),
  );
}

function phaseForOver(overNumber) {
  if (overNumber < 10) return "Powerplay";
  if (overNumber < 40) return "Middle";
  return "Death";
}

function countryForVenue(city, venue) {
  const cityKey = cleanName(city).toLowerCase();
  if (cityCountries.has(cityKey)) return cityCountries.get(cityKey);
  const haystack = `${city || ""} ${venue || ""}`.toLowerCase();
  for (const [knownCity, country] of cityCountries) {
    if (haystack.includes(knownCity)) return country;
  }
  return "";
}

function isLegalBall(delivery) {
  const extras = delivery.extras || {};
  return !Object.hasOwn(extras, "wides") && !Object.hasOwn(extras, "noballs");
}

function wicketForBatter(delivery, batter) {
  return (delivery.wickets || []).find((wicket) => {
    const kind = cleanName(wicket.kind).toLowerCase();
    return (
      wicket.player_out === batter &&
      kind !== "retired hurt" &&
      kind !== "retired not out" &&
      kind !== "retired out"
    );
  });
}

function hasWicket(delivery) {
  return (delivery.wickets || []).some((wicket) => {
    const kind = cleanName(wicket.kind).toLowerCase();
    return kind && !kind.startsWith("retired");
  });
}

function addToMapSet(target, key, value) {
  if (!target.has(key)) target.set(key, new Set());
  target.get(key).add(value);
}

function emptyPlayer(key, name, team, playerId) {
  return {
    key,
    name,
    team,
    playerId,
    rows: [],
    recentRows: [],
    hostRows: [],
    matches: new Set(),
    recentMatches: new Set(),
    hostMatches: new Set(),
    latestDate: "",
    firstDate: "",
  };
}

function pressureScore(stats) {
  const strikeRestriction = Math.max(0, (82 - stats.strikeRate) / 82);
  const wicketPressure = Math.min(1, stats.dismissalRate * 16);
  const raw = stats.dotRate * 0.44 + wicketPressure * 0.38 + strikeRestriction * 0.18;
  const confidence = Math.min(1, stats.balls / 48);
  return raw * (0.55 + confidence * 0.45);
}

function riskLevel(score, balls) {
  if (balls < 12) return "low";
  if (score >= 0.62) return "critical";
  if (score >= 0.48) return "high";
  if (score >= 0.33) return "medium";
  return "low";
}

function summarize(rows) {
  const balls = rows.filter((row) => row.legal).length;
  const runs = rows.reduce((sum, row) => sum + row.runs, 0);
  const totalRuns = rows.reduce((sum, row) => sum + row.totalRuns, 0);
  const dots = rows.filter((row) => row.legal && row.runs === 0).length;
  const dismissals = rows.filter((row) => row.dismissal).length;
  const boundaries = rows.filter((row) => row.runs === 4 || row.runs === 6).length;
  const fours = rows.filter((row) => row.runs === 4).length;
  const sixes = rows.filter((row) => row.runs === 6).length;
  const matches = new Set(rows.map((row) => row.matchId)).size;
  const innings = new Set(rows.map((row) => `${row.matchId}:${row.innings}`)).size;
  const strikeRate = balls ? (runs / balls) * 100 : 0;
  const dotRate = balls ? dots / balls : 0;
  const dismissalRate = balls ? dismissals / balls : 0;
  const score = pressureScore({ balls, strikeRate, dotRate, dismissalRate });

  return {
    balls,
    runs,
    totalRuns,
    dots,
    dismissals,
    boundaries,
    fours,
    sixes,
    matches,
    innings,
    strikeRate: Number(strikeRate.toFixed(1)),
    dotRate: Number(dotRate.toFixed(3)),
    dismissalRate: Number(dismissalRate.toFixed(3)),
    score: Number(score.toFixed(3)),
    risk: riskLevel(score, balls),
  };
}

function summarizeGroups(rows, getKey, minBalls = 12, limit = 8) {
  const groups = new Map();
  for (const row of rows) {
    const key = cleanName(getKey(row));
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()]
    .map(([key, groupRows]) => ({ key, ...summarize(groupRows) }))
    .filter((group) => group.balls >= minBalls)
    .sort((left, right) => right.score - left.score || right.balls - left.balls)
    .slice(0, limit);
}

function summarizeDismissals(rows) {
  const outs = rows.filter((row) => row.dismissal);
  const groups = new Map();
  for (const row of outs) {
    const key = row.dismissalKind || "Dismissal";
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  return [...groups.entries()]
    .map(([key, dismissals]) => ({ key, dismissals }))
    .sort((left, right) => right.dismissals - left.dismissals || left.key.localeCompare(right.key));
}

function conditionFit(overall, host) {
  if (host.balls < 36) {
    return {
      score: null,
      label: "Unproven in host conditions",
      note: `Only ${host.balls} host-country balls in this data. Use overall ODI form plus role fit until more South Africa/Zimbabwe/Namibia evidence appears.`,
    };
  }

  const srGap = host.strikeRate - overall.strikeRate;
  const dotGap = overall.dotRate - host.dotRate;
  const wicketGap = overall.dismissalRate - host.dismissalRate;
  const raw = 55 + srGap * 0.35 + dotGap * 120 + wicketGap * 360;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  let label = "Workable fit";
  if (score >= 68) label = "Strong host fit";
  else if (score < 38) label = "High-risk host fit";
  else if (score < 52) label = "Watch-list fit";

  return {
    score,
    label,
    note: `Host SR ${host.strikeRate} vs overall SR ${overall.strikeRate}; host dots ${Math.round(
      host.dotRate * 100,
    )}% vs overall ${Math.round(overall.dotRate * 100)}%.`,
  };
}

function roleFromPhases(phaseGroups, overall) {
  const byKey = new Map(phaseGroups.map((group) => [group.key, group]));
  const powerplayShare = overall.balls ? (byKey.get("Powerplay")?.balls || 0) / overall.balls : 0;
  const deathShare = overall.balls ? (byKey.get("Death")?.balls || 0) / overall.balls : 0;
  if (powerplayShare >= 0.38) return "Top-order ODI batter";
  if (deathShare >= 0.2) return "Finisher / lower-order hitter";
  return "Middle-order / all-round option";
}

function selectionScore(player, stats) {
  const recency =
    player.latestDate >= "2026-01-01" ? 120 : player.latestDate >= "2025-01-01" ? 90 : 58;
  return recency + Math.min(160, stats.balls / 4) + stats.runs / 7 + stats.matches * 6;
}

function venueProfile(rows, venueKey, country) {
  const legalRows = rows.filter((row) => row.legal);
  const balls = legalRows.length;
  const totalRuns = rows.reduce((sum, row) => sum + row.totalRuns, 0);
  const wickets = rows.filter((row) => row.anyWicket).length;
  const dots = legalRows.filter((row) => row.totalRuns === 0).length;
  const matches = new Set(rows.map((row) => row.matchId)).size;
  const runRate = balls ? (totalRuns / balls) * 6 : 0;
  const dotRate = balls ? dots / balls : 0;
  const wicketRate = balls ? wickets / balls : 0;
  const scoringLabel = runRate >= 5.85 ? "high scoring" : runRate >= 5.15 ? "balanced" : "grippy";
  const pressureLabel = dotRate >= 0.52 || wicketRate >= 0.035 ? "pressure venue" : "batting rhythm venue";

  return {
    key: venueKey,
    country,
    matches,
    balls,
    totalRuns,
    wickets,
    runRate: Number(runRate.toFixed(2)),
    dotRate: Number(dotRate.toFixed(3)),
    wicketRate: Number(wicketRate.toFixed(3)),
    label: `${scoringLabel}, ${pressureLabel}`,
  };
}

await ensureZip();

const players = new Map();
const venueRows = new Map();
const teamMatchDates = new Map();
let scannedMatches = 0;
let recentMatches = 0;
let recentDeliveries = 0;
let hostConditionMatches = 0;

for (const entry of zipEntries()) {
  const match = readMatch(entry);
  const info = match.info || {};
  const matchDate = info.dates?.[0] || "";
  if (info.gender !== "male" || info.match_type !== "ODI" || matchDate < hostConditionStart) {
    continue;
  }

  scannedMatches += 1;
  if (matchDate >= recentStart) recentMatches += 1;
  const matchId = entry.replace(".json", "");
  const city = cleanName(info.city);
  const venue = cleanName(info.venue);
  const venueCountry = countryForVenue(city, venue);
  const isHostCountry = hostCountries.includes(venueCountry);
  if (isHostCountry) hostConditionMatches += 1;
  const teams = info.teams || [];

  for (const team of teams) addToMapSet(teamMatchDates, team, matchDate);

  for (const [inningsIndex, innings] of (match.innings || []).entries()) {
    const battingTeam = innings.team;
    const opponent = teams.find((team) => team !== battingTeam) || "";

    for (const over of innings.overs || []) {
      for (const delivery of over.deliveries || []) {
        const batter = cleanName(delivery.batter);
        if (!batter) continue;
        const people = info.registry?.people || {};
        const playerId = people[batter] || "";
        const playerKey = `${battingTeam}|${playerId || batter}`;
        const legal = isLegalBall(delivery);
        const wicket = wicketForBatter(delivery, batter);
        const row = {
          matchId,
          matchDate,
          innings: inningsIndex + 1,
          team: battingTeam,
          opponent,
          batter,
          bowler: cleanName(delivery.bowler),
          phase: phaseForOver(Number(over.over)),
          over: Number(over.over),
          runs: Number(delivery.runs?.batter || 0),
          totalRuns: Number(delivery.runs?.total || 0),
          legal,
          dismissal: Boolean(wicket),
          dismissalKind: cleanName(wicket?.kind || ""),
          anyWicket: hasWicket(delivery),
          venue,
          city,
          venueCountry,
          hostCountry: isHostCountry ? venueCountry : "",
        };

        if (isHostCountry) {
          const venueKey = `${venue || city}, ${venueCountry}`;
          if (!venueRows.has(venueKey)) venueRows.set(venueKey, []);
          venueRows.get(venueKey).push(row);
        }

        if (matchDate < recentStart && !isHostCountry) continue;

        if (!players.has(playerKey)) {
          players.set(playerKey, emptyPlayer(playerKey, batter, battingTeam, playerId));
        }
        const player = players.get(playerKey);
        player.name = batter;
        player.rows.push(row);
        player.matches.add(matchId);
        if (!player.firstDate || matchDate < player.firstDate) player.firstDate = matchDate;
        if (!player.latestDate || matchDate > player.latestDate) player.latestDate = matchDate;

        if (matchDate >= recentStart) {
          player.recentRows.push(row);
          player.recentMatches.add(matchId);
          recentDeliveries += 1;
        }
        if (isHostCountry) {
          player.hostRows.push(row);
          player.hostMatches.add(matchId);
        }
      }
    }
  }
}

const activeByTeam = new Map();
for (const player of players.values()) {
  const recent = summarize(player.recentRows);
  if (player.latestDate < activeCutoff || recent.balls < 12) continue;
  if (!activeByTeam.has(player.team)) activeByTeam.set(player.team, []);
  activeByTeam.get(player.team).push({ player, recent, score: selectionScore(player, recent) });
}

const outputPlayers = [];
for (const [team, candidates] of activeByTeam) {
  const selected = candidates
    .sort((left, right) => right.score - left.score || right.recent.balls - left.recent.balls)
    .slice(0, maxPlayersPerTeam);

  selected.forEach(({ player, recent }, index) => {
    const host = summarize(player.hostRows);
    const phaseGroups = summarizeGroups(player.recentRows, (row) => row.phase, 1, 3);
    const hostCountryGroups = summarizeGroups(player.hostRows, (row) => row.hostCountry, 12, 3);
    const venueGroups = summarizeGroups(player.hostRows, (row) => `${row.venue || row.city}`, 12, 6);
    const bowlerGroups = summarizeGroups(player.recentRows, (row) => row.bowler, 18, 8);
    const opponentGroups = summarizeGroups(player.recentRows, (row) => row.opponent, 18, 8);
    const signals = [
      ...phaseGroups.map((group) => ({ ...group, type: "Innings phase" })),
      ...hostCountryGroups.map((group) => ({ ...group, type: "Host country" })),
      ...venueGroups.map((group) => ({ ...group, type: "Host venue" })),
      ...bowlerGroups.map((group) => ({ ...group, type: "Bowler matchup" })),
      ...opponentGroups.map((group) => ({ ...group, type: "Opposition" })),
    ]
      .filter((group) => group.balls >= 12)
      .sort((left, right) => right.score - left.score || right.balls - left.balls)
      .slice(0, 6);

    outputPlayers.push({
      id: player.key,
      name: player.name,
      team: player.team,
      playerId: player.playerId,
      projectionTier: index < 15 ? "Core squad candidate" : "Extended squad watchlist",
      rankInTeam: index + 1,
      role: roleFromPhases(phaseGroups, recent),
      firstSeen: player.firstDate,
      lastPlayed: player.latestDate,
      recent,
      host,
      conditionFit: conditionFit(recent, host),
      phases: phaseGroups,
      hostCountries: hostCountryGroups,
      hostVenues: venueGroups,
      bowlers: bowlerGroups,
      opponents: opponentGroups,
      dismissals: summarizeDismissals(player.recentRows),
      signals,
    });
  });
}

outputPlayers.sort(
  (left, right) =>
    left.team.localeCompare(right.team) ||
    left.rankInTeam - right.rankInTeam ||
    left.name.localeCompare(right.name),
);

const teams = [...activeByTeam.keys()].sort().map((team) => {
  const teamPlayers = outputPlayers.filter((player) => player.team === team);
  const dates = teamMatchDates.get(team) ? [...teamMatchDates.get(team)].sort() : [];
  const qualifierStatus = directHostQualifiers.includes(team)
    ? "Automatic host qualifier"
    : team === "Namibia"
      ? "Co-host, must qualify through pathway"
      : "Qualification not locked yet";
  return {
    team,
    players: teamPlayers.length,
    coreCandidates: teamPlayers.filter((player) => player.projectionTier === "Core squad candidate")
      .length,
    qualifierStatus,
    firstMatch: dates[0] || "",
    lastMatch: dates.at(-1) || "",
  };
});

const venueProfiles = [...venueRows.entries()]
  .map(([venueKey, rows]) => venueProfile(rows, venueKey, rows[0]?.venueCountry || ""))
  .filter((profile) => profile.matches >= 2)
  .sort((left, right) => left.country.localeCompare(right.country) || right.matches - left.matches);

const recentDates = outputPlayers.map((player) => player.lastPlayed).sort();
const result = {
  metadata: {
    source: "Cricsheet men's ODI JSON archive",
    sourceUrl: downloadUrl,
    cwcOfficialSource:
      "https://www.icc-cricket.com/media-releases/hosts-of-u19-icc-global-events-until-2027-announced",
    generatedOn: new Date().toISOString().slice(0, 10),
    recentStart,
    activeCutoff,
    hostConditionStart,
    hostCountries,
    directHostQualifiers,
    teamsTracked: teams.length,
    projectedPlayers: outputPlayers.length,
    scannedMatches,
    recentMatches,
    recentDeliveries,
    hostConditionMatches,
    coverageFrom: recentDates[0] || "",
    coverageThrough: recentDates.at(-1) || "",
    maxPlayersPerTeam,
    unavailableNote:
      "Cricsheet withholds Afghanistan men's matches, so Afghanistan player projections are not included in this real-data build.",
    projectionNote:
      "CWC 2027 squads and many qualifiers are not confirmed. This app uses recent ODI appearances as a realistic player-pool projection, not an official squad list.",
  },
  teams,
  players: outputPlayers,
  venueProfiles,
  conditionNotes: countryConditionNotes,
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `window.CWC2027_ODI_DATA = ${JSON.stringify(result)};\n`, "utf8");

console.log(
  `Wrote ${outputPlayers.length} ODI player projections across ${teams.length} teams to ${outputFile}.`,
);

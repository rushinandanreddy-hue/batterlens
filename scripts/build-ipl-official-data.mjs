import fs from "node:fs";
import path from "node:path";

const outputFile = process.argv[2] || "data/ipl-2026-official.js";
const competitionId = process.argv[3] || "284";

const feedBaseUrl = "https://scores.iplt20.com/ipl/feeds";
const sourceUrl = "https://www.iplt20.com/matches/results";

const playoffTeams = [
  "Royal Challengers Bengaluru",
  "Gujarat Titans",
  "Sunrisers Hyderabad",
  "Rajasthan Royals",
];

function parseJsonp(text) {
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Could not parse JSONP feed");
  }
  return JSON.parse(text.slice(start + 1, end));
}

async function fetchJsonp(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Feed request failed ${response.status}: ${url}`);
  }
  return parseJsonp(await response.text());
}

function cleanName(name) {
  return String(name || "")
    .replace(/\s*\((?:c|wk|IP|RP|sub|substitute)\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function phaseForOver(overNumber) {
  const zeroBasedOver = Math.max(0, numberValue(overNumber) - 1);
  if (zeroBasedOver < 6) return "Powerplay";
  if (zeroBasedOver < 16) return "Middle";
  return "Death";
}

function baseZoneForAngle(angle) {
  const normalized = ((numberValue(angle) % 360) + 360) % 360;
  const zoneIndex = Math.floor(((normalized + 22.5) % 360) / 45);
  return [
    "Third Man",
    "Point",
    "Cover",
    "Long Off",
    "Long On",
    "Mid Wicket",
    "Square Leg",
    "Fine Leg",
  ][zoneIndex];
}

function batterViewZone(angle, batType) {
  const zone = baseZoneForAngle(angle);
  if (batType !== "L") return zone;
  return {
    "Third Man": "Fine Leg",
    Point: "Square Leg",
    Cover: "Mid Wicket",
    "Long Off": "Long On",
    "Long On": "Long Off",
    "Mid Wicket": "Cover",
    "Square Leg": "Point",
    "Fine Leg": "Third Man",
  }[zone];
}

function dismissalKind(row) {
  if (String(row.IsWicket) !== "1") return "";
  const wicketType = cleanName(row.WicketType || row.Wickets || row.ShortOutDesc || "Dismissal");
  if (wicketType) return wicketType;
  const description = String(row.ShortOutDesc || row.OutDesc || "").toLowerCase();
  if (description.includes("run out")) return "run out";
  if (description.includes("stumped")) return "stumped";
  if (description.includes("lbw")) return "lbw";
  if (description.includes(" b ")) return "bowled";
  if (description.includes("c ")) return "caught";
  return "Dismissal";
}

function batterRuns(row) {
  if (String(row.IsBye) === "1" || String(row.IsLegBye) === "1" || String(row.IsWide) === "1") {
    return 0;
  }
  if (row.RunRuns !== undefined && row.RunRuns !== "") return numberValue(row.RunRuns);
  return numberValue(row.Runs);
}

function ballMatchesBatterWicket(row) {
  if (String(row.IsWicket) !== "1") return false;
  const outId = String(row.OutBatsManID || row.OutBatsmanID || "");
  return outId === "" || outId === String(row.StrikerID);
}

const scheduleUrl = `${feedBaseUrl}/${competitionId}-matchschedule.js`;
const schedule = await fetchJsonp(scheduleUrl);
const postMatches = schedule.Matchsummary.filter((match) => match.MatchStatus === "Post");
postMatches.sort((left, right) => String(left.MatchDate).localeCompare(String(right.MatchDate)));

const deliveries = [];
const includedMatchIds = new Set();
let fetchedInnings = 0;

for (const match of postMatches) {
  const inningsCount = Math.max(1, numberValue(match.CurrentInnings || 2));
  for (let inningsNo = 1; inningsNo <= Math.min(inningsCount, 2); inningsNo += 1) {
    const inningsUrl = `${feedBaseUrl}/${match.MatchID}-Innings${inningsNo}.js`;
    let inningsData;
    try {
      inningsData = await fetchJsonp(inningsUrl);
    } catch (error) {
      console.warn(error.message);
      continue;
    }

    const innings = inningsData[`Innings${inningsNo}`];
    const battingTeam = cleanName(innings?.Extras?.[0]?.BattingTeamName);
    if (!innings || !playoffTeams.includes(battingTeam)) continue;

    fetchedInnings += 1;
    includedMatchIds.add(String(match.MatchID));
    const wagonByBallId = new Map(
      (innings.WagonWheel || []).map((shot) => [String(shot.BallID), shot]),
    );

    for (const row of innings.OverHistory || []) {
      const batter = cleanName(row.BatsManName);
      if (!batter) continue;
      const ballId = String(row.BallID || "");
      const shot = wagonByBallId.get(ballId);
      const line = cleanName(row.BOWLING_LINE_ID || "Unknown line");
      const length = cleanName(row.BOWLING_LENGTH_ID || "Unknown length");
      const shotAngle = shot ? numberValue(shot.FielderAngle) : null;
      const shotDistance = shot ? numberValue(shot.FielderLengthRatio) : null;
      const batType = shot?.BatType || cleanName(row.BatType || "");
      const runs = batterRuns(row);

      deliveries.push({
        batter,
        batterId: String(row.StrikerID || ""),
        iplTeam: battingTeam,
        playoffQualified: true,
        ipl2026Played: true,
        bowler: cleanName(row.BowlerName),
        bowlerId: String(row.BowlerID || ""),
        phase: phaseForOver(row.OverNo),
        over: numberValue(row.OverNo),
        ball: cleanName(row.BallName || row.CommentOver || ""),
        runs,
        totalRuns: numberValue(row.ActualRuns || row.Runs),
        dismissal: ballMatchesBatterWicket(row),
        dismissalKind: dismissalKind(row),
        countsAsBall: String(row.IsWide) !== "1" && String(row.IsNoBall) !== "1",
        line,
        length,
        pitchX: row.Xpitch === "" ? null : numberValue(row.Xpitch),
        pitchY: row.Ypitch === "" ? null : numberValue(row.Ypitch),
        shotType: cleanName(row.ShotType || "Unknown shot"),
        bowlerType: cleanName(row.BowlTypeName || row.BowlerType || "Unknown bowling type"),
        shotZone: shot ? batterViewZone(shot.FielderAngle, shot.BatType) : "",
        fielderAngle: shotAngle,
        fielderLengthRatio: shotDistance,
        isFour: String(row.IsFour) === "1" || String(shot?.IsFour) === "1",
        isSix: String(row.IsSix) === "1" || String(shot?.IsSix) === "1",
        batType,
        scoringShotMapped: Boolean(shot),
        ballId,
        matchId: String(match.MatchID),
        officialMatchId: String(match.MatchID),
        matchName: cleanName(match.MatchName),
        matchDate: String(match.MatchDate),
        sourceUrl: `https://www.iplt20.com/match/2026/${match.MatchID}`,
      });
    }
  }
}

const includedDates = deliveries.map((delivery) => delivery.matchDate).sort();
const batters = [
  ...new Set(deliveries.map((delivery) => `${delivery.iplTeam}|${delivery.batter}`)),
];

const result = {
  metadata: {
    source: "Official IPL Match Centre feeds",
    sourceUrl,
    feedBaseUrl,
    competitionId: Number(competitionId),
    season: 2026,
    matchesAvailable: postMatches.length,
    matchesWithQualifiedTeams: includedMatchIds.size,
    qualifiedTeamInnings: fetchedInnings,
    coverageFrom: includedDates[0] || "",
    coverageThrough: includedDates.at(-1) || "",
    playoffTeams,
    qualifiedTeamBatters: batters.length,
    deliveryCount: deliveries.length,
    wagonShots: deliveries.filter((delivery) => delivery.scoringShotMapped).length,
    spatialFields: ["BOWLING_LINE_ID", "BOWLING_LENGTH_ID", "Xpitch", "Ypitch", "FielderAngle"],
  },
  deliveries,
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(
  outputFile,
  `window.IPL2026_REAL_DATA = ${JSON.stringify(result)};\n`,
  "utf8",
);

console.log(
  `Wrote ${deliveries.length} deliveries, ${result.metadata.wagonShots} wagon shots, ${batters.length} batters from ${includedMatchIds.size} qualified-team matches.`,
);

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const outputFile = process.argv[2] || "data/cwc-2027-odi.js";
const odiZip = process.argv[3] || path.join(os.tmpDir?.() || os.tmpdir(), "odis_json.zip");
const testZip = process.argv[4] || path.join(os.tmpDir?.() || os.tmpdir(), "tests_json.zip");
const t20Zip = process.argv[5] || path.join(os.tmpDir?.() || os.tmpdir(), "t20s_json.zip");

const archives = [
  {
    format: "ODI",
    zipFile: odiZip,
    url: "https://cricsheet.org/downloads/odis_json.zip",
    acceptedTypes: new Set(["ODI"]),
  },
  {
    format: "Test",
    zipFile: testZip,
    url: "https://cricsheet.org/downloads/tests_json.zip",
    acceptedTypes: new Set(["Test"]),
  },
  {
    format: "T20I",
    zipFile: t20Zip,
    url: "https://cricsheet.org/downloads/t20s_json.zip",
    acceptedTypes: new Set(["T20"]),
  },
];

const recentStart = "2023-01-01";
const activeCutoff = "2024-01-01";
const allFormatStart = "2021-01-01";
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

const STYLE_ENTRIES = [
  ["A Zampa", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["A Dutt", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["Aamir Kaleem", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Aayan Afzal Khan", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Abrar Ahmed", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["AAP Atkinson", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["AJ Hosein", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Akash Deep", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["AM Fernando", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["AR McBrine", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["AR Patel", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["AS Joseph", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["AY Patel", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["AU Rashid", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["Avesh Khan", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["Arshdeep Singh", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["B Muzarabani", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["B Kumar", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["Basil Hameed", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["BA Carse", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["BA Stokes", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["BB McCarthy", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["BJ Dwarshuis", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["BJ McMullen", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["Bilal Khan", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["BM Scholtz", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["BM Wheeler-Greenall", "Left-arm", "Pace", "Left-arm pace", "Medium-fast"],
  ["C Campher", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["C Green", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["CA Soper", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["CAK Rajitha", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["CBRLS Kumara", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["CJ Jordan", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["CR Woakes", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["D Madushanka", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["DJ Willey", "Left-arm", "Pace", "Left-arm pace", "Medium-fast"],
  ["DM de Silva", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["DM Drakes", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["DM Wellalage", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["DR Sams", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["DS Airee", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["Ebadat Hossain", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["FA Allen", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Fayyaz Butt", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["Fazalhaq Farooqi", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["G Coetzee", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["GJ Maxwell", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["G Motie", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["GH Dockrell", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Harmeet Singh", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Haris Rauf", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["Hasan Ali", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["Hasan Mahmud", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["Hasan Murad", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["H Thaker", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["HMRKB Herath", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Imad Wasim", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Iftikhar Ahmed", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["JA Richardson", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["JA Duffy", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["JA Warrican", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["JC Archer", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["JC Tongue", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["JDS Neesham", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["JH Davey", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["JJ Bumrah", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["JJ Smit", "Left-arm", "Pace", "Left-arm pace", "Medium-fast"],
  ["JL Little", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["JM Anderson", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["JO Holder", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["JP Greaves", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["JR Hazlewood", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["JNT Seales", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["Junaid Siddique", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["K Rabada", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["KA Jamieson", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["KA Maharaj", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["KAJ Roach", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["Kaleem Sana", "Left-arm", "Pace", "Left-arm pace", "Medium-fast"],
  ["Kaleemullah", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["Karan KC", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["Khaled Ahmed", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["Kuldeep Yadav", "Left-arm", "Spin", "Left-arm wrist spin", "Wrist spin"],
  ["LH Ferguson", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["L Ngidi", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["LN Rajbanshi", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["MA Starc", "Left-arm", "Pace", "Left-arm pace", "Fast"],
  ["MA Leask", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["MA Wood", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["Maheesh Theekshana", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["Mark Adair", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["M Jansen", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["Mehedi Hasan Miraz", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["MG Bracewell", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["MG Erasmus", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["Milind Kumar", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["MJ Henry", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["MJ Leach", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Mohammad Amir", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["Mohammad Hasnain", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["Mohammad Nawaz", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Mohammad Wasim", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["Mohammed Shami", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["Mohammed Siraj", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["Mustafizur Rahman", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["Mujeeb Ur Rahman", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["M Pathirana", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["MJ Santner", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["MJ Potts", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["MM Ali", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["MP Stoinis", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["MP Kuhnemann", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["MR Adair", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["MRJ Watt", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["M Theekshana", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["MW Forde", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["NA Sowter", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["Naseem Shah", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["Naveen-ul-Haq", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["Nauman Ali", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Nayeem Hasan", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["N Burger", "Left-arm", "Pace", "Left-arm pace", "Fast"],
  ["NG Smith", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["NGRP Jayasuriya", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Noor Ahmad", "Left-arm", "Spin", "Left-arm wrist spin", "Wrist spin"],
  ["NM Lyon", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["N Pradeep", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["NP Kenjige", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["NT Ellis", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["OE Robinson", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["PA van Meekeren", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["PWH de Silva", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["PVD Chameera", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["PJ Cummins", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["RA Jadeja", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Rashid Khan", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["Ravi Bishnoi", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["R Ashwin", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["R Trumpelmann", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["R Shepherd", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["RE van der Merwe", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["RJW Topley", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["R Ravindra", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["R Ngarava", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["Rishad Hossain", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["RL Chase", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["Rohan Mustafa", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["RTM Mendis", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["Saqib Mahmood", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["Saim Ayub", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["Saad Bin Zafar", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Sajid Khan", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["Sam Curran", "Left-arm", "Pace", "Left-arm pace", "Medium-fast"],
  ["SCJ Broad", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["SC van Schalkwyk", "Left-arm", "Pace", "Left-arm pace", "Medium-fast"],
  ["Shadab Khan", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["Shaheen Shah Afridi", "Left-arm", "Pace", "Left-arm pace", "Fast"],
  ["Shakib Al Hasan", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Shakeel Ahmed", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Shoriful Islam", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["Shoaib Bashir", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["S Lamichhane", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["SM Boland", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["SM Sharif", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["SN Netravalkar", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["Sikandar Raza", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["SP Narine", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["Sompal Kami", "Right-arm", "Pace", "Right-arm pace", "Medium-fast"],
  ["SR Harmer", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["TA Boult", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["Taijul Islam", "Left-arm", "Spin", "Left-arm orthodox spin", "Slow left-arm orthodox"],
  ["Taskin Ahmed", "Right-arm", "Pace", "Right-arm pace", "Fast"],
  ["TG Southee", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["T Lungameni", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
  ["T Murphy", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["TS Mills", "Left-arm", "Pace", "Left-arm pace", "Fast"],
  ["T Shamsi", "Left-arm", "Spin", "Left-arm wrist spin", "Wrist spin"],
  ["Usama Mir", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["W Hasaranga", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["Washington Sundar", "Right-arm", "Spin", "Right-arm off spin", "Off break"],
  ["W O'Rourke", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["YS Chahal", "Right-arm", "Spin", "Right-arm leg spin", "Leg break"],
  ["Zahoor Khan", "Right-arm", "Pace", "Right-arm pace", "Fast-medium"],
  ["Z Khan", "Left-arm", "Pace", "Left-arm pace", "Fast-medium"],
];

const styleByName = new Map(
  STYLE_ENTRIES.map(([name, arm, category, key, detail]) => [
    normalizeName(name),
    { arm, category, key, detail, known: true },
  ]),
);

function cleanName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeName(value) {
  return cleanName(value).toLowerCase().replace(/[.'`-]/g, "");
}

function unknownStyle() {
  return {
    arm: "Unknown arm",
    category: "Unknown style",
    key: "Unknown bowling style",
    detail: "Bowling style not available in source",
    known: false,
  };
}

function styleForBowler(name) {
  const normalized = normalizeName(name);
  return styleByName.get(normalized) || unknownStyle();
}

async function ensureZip(archive) {
  if (fs.existsSync(archive.zipFile)) return;
  console.log(`Downloading ${archive.url}`);
  const response = await fetch(archive.url);
  if (!response.ok) {
    throw new Error(`Cricsheet download failed ${response.status}: ${archive.url}`);
  }
  fs.writeFileSync(archive.zipFile, Buffer.from(await response.arrayBuffer()));
}

function zipEntries(zipFile) {
  return execFileSync("unzip", ["-Z1", zipFile], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter((entry) => entry.endsWith(".json"));
}

function readMatch(zipFile, entry) {
  return JSON.parse(
    execFileSync("unzip", ["-p", zipFile, entry], {
      encoding: "utf8",
      maxBuffer: 12 * 1024 * 1024,
    }),
  );
}

function phaseForFormat(format, overNumber) {
  if (format === "T20I") {
    if (overNumber < 6) return "Powerplay";
    if (overNumber < 16) return "Middle";
    return "Death";
  }
  if (format === "Test") {
    if (overNumber < 20) return "New ball";
    if (overNumber >= 80) return "Old ball";
    return "Middle";
  }
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

function wicketKindFor(delivery) {
  const wicket = (delivery.wickets || []).find((entry) => {
    const kind = cleanName(entry.kind).toLowerCase();
    return kind && !kind.startsWith("retired");
  });
  return cleanName(wicket?.kind || "");
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
    allFormatRows: [],
    matches: new Set(),
    recentMatches: new Set(),
    hostMatches: new Set(),
    allFormatMatches: new Set(),
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
  const knownStyleBalls = rows.filter((row) => row.legal && row.bowlingStyleKnown).length;
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
    knownStyleBalls,
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

function pitchPressureScore(stats) {
  const slowScoring = Math.max(0, (5.25 - stats.runRate) / 5.25);
  const wicketPressure = Math.min(1, stats.wicketRate * 22);
  const boundaryControl = Math.max(0, (0.13 - stats.boundaryRate) / 0.13);
  const raw = stats.dotRate * 0.38 + wicketPressure * 0.34 + slowScoring * 0.18 + boundaryControl * 0.1;
  const confidence = Math.min(1, stats.balls / 360);
  return raw * (0.55 + confidence * 0.45);
}

function pitchRiskLevel(score, balls) {
  if (balls < 90) return "low";
  if (score >= 0.62) return "critical";
  if (score >= 0.5) return "high";
  if (score >= 0.36) return "medium";
  return "low";
}

function pitchStats(rows) {
  const legalRows = rows.filter((row) => row.legal);
  const balls = legalRows.length;
  const totalRuns = rows.reduce((sum, row) => sum + row.totalRuns, 0);
  const wickets = rows.filter((row) => row.anyWicket).length;
  const dots = legalRows.filter((row) => row.totalRuns === 0).length;
  const boundaries = legalRows.filter((row) => row.runs === 4 || row.runs === 6).length;
  const matches = new Set(rows.map((row) => row.matchId)).size;
  const innings = new Set(rows.map((row) => `${row.matchId}:${row.innings}`)).size;
  const runRate = balls ? (totalRuns / balls) * 6 : 0;
  const dotRate = balls ? dots / balls : 0;
  const wicketRate = balls ? wickets / balls : 0;
  const boundaryRate = balls ? boundaries / balls : 0;
  const score = pitchPressureScore({ balls, runRate, dotRate, wicketRate, boundaryRate });

  return {
    balls,
    totalRuns,
    wickets,
    dots,
    boundaries,
    matches,
    innings,
    runRate: Number(runRate.toFixed(2)),
    dotRate: Number(dotRate.toFixed(3)),
    wicketRate: Number(wicketRate.toFixed(3)),
    boundaryRate: Number(boundaryRate.toFixed(3)),
    score: Number(score.toFixed(3)),
    risk: pitchRiskLevel(score, balls),
  };
}

function pitchGroups(rows, getKey, minBalls = 60, limit = 5) {
  const groups = new Map();
  for (const row of rows) {
    const key = cleanName(getKey(row));
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()]
    .map(([key, groupRows]) => ({ key, ...pitchStats(groupRows) }))
    .filter((group) => group.balls >= minBalls)
    .sort((left, right) => right.score - left.score || right.balls - left.balls)
    .slice(0, limit);
}

function pitchDismissals(rows) {
  const groups = new Map();
  for (const row of rows.filter((entry) => entry.anyWicket)) {
    const key = row.wicketKind || row.dismissalKind || "wicket";
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  return [...groups.entries()]
    .map(([key, wickets]) => ({ key, wickets }))
    .sort((left, right) => right.wickets - left.wickets || left.key.localeCompare(right.key))
    .slice(0, 5);
}

function scoringBand(runRate) {
  if (runRate >= 5.85) return "Fast-scoring";
  if (runRate >= 5.15) return "Balanced-scoring";
  return "Slow-scoring";
}

function pressureBand(dotRate) {
  if (dotRate >= 0.54) return "heavy dot-ball pressure";
  if (dotRate >= 0.5) return "steady dot-ball pressure";
  return "lower dot-ball pressure";
}

function wicketBand(wicketRate) {
  if (wicketRate >= 0.033) return "frequent wickets";
  if (wicketRate >= 0.026) return "regular wickets";
  return "lower wicket frequency";
}

function pitchBehaviorLabel(stats) {
  return `${scoringBand(stats.runRate)}, ${pressureBand(stats.dotRate)}, ${wicketBand(stats.wicketRate)}`;
}

function pitchBehaviorSummary(stats, phaseFactors, bowlingTypeFactors) {
  const phase = phaseFactors[0];
  const bowlingType = bowlingTypeFactors.find((group) => !group.key.includes("Unknown")) || bowlingTypeFactors[0];
  const parts = [
    `${scoringBand(stats.runRate)} venue`,
    `${Math.round(stats.dotRate * 100)}% dots`,
    `${Number((stats.wicketRate * 100).toFixed(1))} wickets per 100 balls`,
  ];
  if (phase) parts.push(`${phase.key.toLowerCase()} is the toughest phase`);
  if (bowlingType) parts.push(`${bowlingType.key.toLowerCase()} has the strongest pressure signal`);
  return `${parts.join("; ")}.`;
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
    note: `Host SR ${host.strikeRate} vs ODI SR ${overall.strikeRate}; host dots ${Math.round(
      host.dotRate * 100,
    )}% vs ODI ${Math.round(overall.dotRate * 100)}%.`,
  };
}

function roleFromPhases(phaseGroups, overall) {
  const byKey = new Map(phaseGroups.map((group) => [group.key, group]));
  const powerplayShare = overall.balls ? (byKey.get("Powerplay")?.balls || 0) / overall.balls : 0;
  const deathShare = overall.balls ? (byKey.get("Death")?.balls || 0) / overall.balls : 0;
  if (powerplayShare >= 0.38) return "Top-order ODI batter";
  if (deathShare >= 0.2) return "Finisher / lower-order hitter";
  return "Middle-order ODI batter / anchor";
}

function selectionScore(player, stats) {
  const recency =
    player.latestDate >= "2026-01-01" ? 120 : player.latestDate >= "2025-01-01" ? 90 : 58;
  return recency + Math.min(160, stats.balls / 4) + stats.runs / 7 + stats.matches * 6;
}

function venueProfile(rows, venueKey, country) {
  const stats = pitchStats(rows);
  const minBalls = stats.balls >= 1800 ? 120 : 36;
  const phaseFactors = pitchGroups(rows, (row) => row.phase, minBalls, 4);
  const bowlingTypeFactors = pitchGroups(rows, (row) => row.bowlingType || "Unknown style", minBalls, 4);
  const bowlingArmFactors = pitchGroups(rows, (row) => row.bowlingArm || "Unknown arm", minBalls, 4);
  const bowlingStyleFactors = pitchGroups(rows, (row) => row.bowlingStyle || "Unknown bowling style", minBalls, 5);
  const dismissalModes = pitchDismissals(rows);

  return {
    key: venueKey,
    country,
    ...stats,
    label: pitchBehaviorLabel(stats),
    behaviorSummary: pitchBehaviorSummary(stats, phaseFactors, bowlingTypeFactors),
    phaseFactors,
    bowlingTypeFactors,
    bowlingArmFactors,
    bowlingStyleFactors,
    dismissalModes,
  };
}

function makeRow({ match, archive, entry, innings, inningsIndex, over, delivery }) {
  const info = match.info || {};
  const teams = info.teams || [];
  const matchDate = info.dates?.[0] || "";
  const city = cleanName(info.city);
  const venue = cleanName(info.venue);
  const venueCountry = countryForVenue(city, venue);
  const battingTeam = innings.team;
  const opponent = teams.find((team) => team !== battingTeam) || "";
  const batter = cleanName(delivery.batter);
  const bowler = cleanName(delivery.bowler);
  const people = info.registry?.people || {};
  const playerId = people[batter] || "";
  const bowlerId = people[bowler] || "";
  const legal = isLegalBall(delivery);
  const wicket = wicketForBatter(delivery, batter);
  const wicketKind = wicketKindFor(delivery);
  const phase = phaseForFormat(archive.format, Number(over.over));
  const style = styleForBowler(bowler);
  const isHostCountry = hostCountries.includes(venueCountry);

  return {
    matchId: `${archive.format}:${entry.replace(".json", "")}`,
    rawMatchId: entry.replace(".json", ""),
    matchDate,
    format: archive.format,
    innings: inningsIndex + 1,
    team: battingTeam,
    opponent,
    batter,
    batterId: playerId,
    bowler,
    bowlerId,
    phase,
    stage: `${archive.format} ${phase}`,
    over: Number(over.over),
    runs: Number(delivery.runs?.batter || 0),
    totalRuns: Number(delivery.runs?.total || 0),
    legal,
    dismissal: Boolean(wicket),
    dismissalKind: cleanName(wicket?.kind || ""),
    anyWicket: hasWicket(delivery),
    wicketKind,
    venue,
    city,
    venueCountry,
    hostCountry: isHostCountry ? venueCountry : "",
    bowlingArm: style.arm,
    bowlingType: style.category,
    bowlingStyle: style.key,
    bowlingDetail: style.detail,
    bowlingStyleKnown: style.known,
  };
}

async function ensureArchives() {
  for (const archive of archives) await ensureZip(archive);
}

function isUsableMatch(match, archive, earliestDate) {
  const info = match.info || {};
  const matchDate = info.dates?.[0] || "";
  return (
    info.gender === "male" &&
    info.team_type === "international" &&
    archive.acceptedTypes.has(info.match_type) &&
    matchDate >= earliestDate
  );
}

await ensureArchives();

const odiArchive = archives[0];
const players = new Map();
const venueRows = new Map();
const hostCountryRows = new Map();
const teamMatchDates = new Map();
let scannedMatches = 0;
let recentMatches = 0;
let recentDeliveries = 0;
let hostConditionMatches = 0;

for (const entry of zipEntries(odiArchive.zipFile)) {
  const match = readMatch(odiArchive.zipFile, entry);
  if (!isUsableMatch(match, odiArchive, hostConditionStart)) continue;

  const info = match.info || {};
  const matchDate = info.dates?.[0] || "";
  const city = cleanName(info.city);
  const venue = cleanName(info.venue);
  const venueCountry = countryForVenue(city, venue);
  const isHostCountry = hostCountries.includes(venueCountry);
  const teams = info.teams || [];

  scannedMatches += 1;
  if (matchDate >= recentStart) recentMatches += 1;
  if (isHostCountry) hostConditionMatches += 1;
  for (const team of teams) addToMapSet(teamMatchDates, team, matchDate);

  for (const [inningsIndex, innings] of (match.innings || []).entries()) {
    for (const over of innings.overs || []) {
      for (const delivery of over.deliveries || []) {
        const row = makeRow({ match, archive: odiArchive, entry, innings, inningsIndex, over, delivery });
        if (!row.batter) continue;

        if (isHostCountry) {
          const venueKey = `${venue || city}, ${venueCountry}`;
          if (!venueRows.has(venueKey)) venueRows.set(venueKey, []);
          venueRows.get(venueKey).push(row);
          if (!hostCountryRows.has(venueCountry)) hostCountryRows.set(venueCountry, []);
          hostCountryRows.get(venueCountry).push(row);
        }

        if (matchDate < recentStart && !isHostCountry) continue;

        const playerKey = `${row.team}|${row.batterId || row.batter}`;
        if (!players.has(playerKey)) {
          players.set(playerKey, emptyPlayer(playerKey, row.batter, row.team, row.batterId));
        }
        const player = players.get(playerKey);
        player.name = row.batter;
        player.rows.push(row);
        player.matches.add(row.matchId);
        if (!player.firstDate || matchDate < player.firstDate) player.firstDate = matchDate;
        if (!player.latestDate || matchDate > player.latestDate) player.latestDate = matchDate;

        if (matchDate >= recentStart) {
          player.recentRows.push(row);
          player.recentMatches.add(row.matchId);
          recentDeliveries += 1;
        }
        if (isHostCountry) {
          player.hostRows.push(row);
          player.hostMatches.add(row.matchId);
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

const selectedRecords = [];
for (const [team, candidates] of activeByTeam) {
  const selected = candidates
    .sort((left, right) => right.score - left.score || right.recent.balls - left.recent.balls)
    .slice(0, maxPlayersPerTeam);
  selected.forEach((record, index) => selectedRecords.push({ ...record, rankInTeam: index + 1 }));
}

const selectedById = new Map();
const selectedByTeamName = new Map();
for (const { player } of selectedRecords) {
  if (player.playerId) selectedById.set(player.playerId, player);
  selectedByTeamName.set(`${player.team}|${normalizeName(player.name)}`, player);
}

let allFormatMatches = 0;
let allFormatDeliveries = 0;

for (const archive of archives) {
  for (const entry of zipEntries(archive.zipFile)) {
    const match = readMatch(archive.zipFile, entry);
    if (!isUsableMatch(match, archive, allFormatStart)) continue;
    allFormatMatches += 1;

    for (const [inningsIndex, innings] of (match.innings || []).entries()) {
      for (const over of innings.overs || []) {
        for (const delivery of over.deliveries || []) {
          const row = makeRow({ match, archive, entry, innings, inningsIndex, over, delivery });
          if (!row.batter) continue;
          const player =
            (row.batterId && selectedById.get(row.batterId)) ||
            selectedByTeamName.get(`${row.team}|${normalizeName(row.batter)}`);
          if (!player) continue;
          player.allFormatRows.push(row);
          player.allFormatMatches.add(row.matchId);
          allFormatDeliveries += 1;
        }
      }
    }
  }
}

function weaknessSignalsForRows(rows, includeFormatSplit = true) {
  const minBalls = rows.length >= 600 ? 30 : 18;
  return [
    ...summarizeGroups(rows, (row) => row.bowlingStyle, minBalls, 8).map((group) => ({
      ...group,
      type: "Bowling style",
    })),
    ...summarizeGroups(rows, (row) => row.bowlingType, minBalls, 4).map((group) => ({
      ...group,
      type: "Pace/spin type",
    })),
    ...summarizeGroups(rows, (row) => row.bowlingArm, minBalls, 4).map((group) => ({
      ...group,
      type: "Bowling arm",
    })),
    ...(includeFormatSplit
      ? summarizeGroups(rows, (row) => row.format, minBalls, 3).map((group) => ({
          ...group,
          type: "Format",
        }))
      : []),
    ...summarizeGroups(rows, (row) => row.stage, minBalls, 8).map((group) => ({
      ...group,
      type: "Match stage",
    })),
    ...summarizeGroups(rows, (row) => row.bowler, Math.max(18, minBalls), 8).map((group) => ({
      ...group,
      type: "Bowler matchup",
    })),
  ]
    .filter((group) => group.key !== "Unknown style" && group.key !== "Unknown arm")
    .sort((left, right) => right.score - left.score || right.balls - left.balls)
    .slice(0, 10);
}

function conclusionForPlayer(signals, bowlingStyles, formatLabel = "all formats") {
  const style = bowlingStyles.find((group) => !group.key.includes("Unknown")) || signals[0];
  const top = signals[0];
  const styleText = style
    ? `${style.key}: ${style.dismissals} outs, ${Math.round(style.dotRate * 100)}% dots, SR ${style.strikeRate}`
    : "No bowler-style signal has enough sample yet";
  const topText = top
    ? `${top.type} ${top.key}: ${top.dismissals} outs, ${Math.round(top.dotRate * 100)}% dots, SR ${top.strikeRate}`
    : `No ${formatLabel} weakness signal has enough sample yet`;
  return {
    headline: style ? `Most troubled by ${style.key}` : `${formatLabel} style signal still building`,
    styleText,
    topText,
    lineLengthText:
      "True line and length is not available in Cricsheet scorecards. This app uses real outcome patterns by bowler style, phase, format and matchup instead of guessing line/length.",
  };
}

function formatViewForRows(rows, label) {
  const bowlingStyles = summarizeGroups(rows, (row) => row.bowlingStyle, 18, 8);
  const signals = weaknessSignalsForRows(rows, label === "All formats");
  return {
    label,
    summary: summarize(rows),
    bowlingStyles,
    bowlingTypes: summarizeGroups(rows, (row) => row.bowlingType, 18, 5),
    bowlingArms: summarizeGroups(rows, (row) => row.bowlingArm, 18, 5),
    stages: summarizeGroups(rows, (row) => row.stage, 18, 8),
    dismissals: summarizeDismissals(rows),
    signals,
    conclusion: conclusionForPlayer(signals, bowlingStyles, label),
  };
}

const outputPlayers = selectedRecords.map(({ player, recent, rankInTeam }) => {
  const host = summarize(player.hostRows);
  const allFormat = summarize(player.allFormatRows);
  const phaseGroups = summarizeGroups(player.recentRows, (row) => row.phase, 1, 3);
  const hostCountryGroups = summarizeGroups(player.hostRows, (row) => row.hostCountry, 12, 3);
  const venueGroups = summarizeGroups(player.hostRows, (row) => `${row.venue || row.city}`, 12, 6);
  const bowlerGroups = summarizeGroups(player.recentRows, (row) => row.bowler, 18, 8);
  const opponentGroups = summarizeGroups(player.recentRows, (row) => row.opponent, 18, 8);
  const bowlingStyleGroups = summarizeGroups(player.allFormatRows, (row) => row.bowlingStyle, 18, 8);
  const bowlingTypeGroups = summarizeGroups(player.allFormatRows, (row) => row.bowlingType, 18, 5);
  const bowlingArmGroups = summarizeGroups(player.allFormatRows, (row) => row.bowlingArm, 18, 5);
  const formatGroups = summarizeGroups(player.allFormatRows, (row) => row.format, 18, 3);
  const stageGroups = summarizeGroups(player.allFormatRows, (row) => row.stage, 18, 8);
  const formatViews = {
    "All formats": formatViewForRows(player.allFormatRows, "All formats"),
    ODI: formatViewForRows(
      player.allFormatRows.filter((row) => row.format === "ODI"),
      "ODI",
    ),
    Test: formatViewForRows(
      player.allFormatRows.filter((row) => row.format === "Test"),
      "Test",
    ),
    T20I: formatViewForRows(
      player.allFormatRows.filter((row) => row.format === "T20I"),
      "T20I",
    ),
  };
  const signals = [
    ...phaseGroups.map((group) => ({ ...group, type: "ODI innings phase" })),
    ...hostCountryGroups.map((group) => ({ ...group, type: "Host country" })),
    ...venueGroups.map((group) => ({ ...group, type: "Host venue" })),
    ...bowlerGroups.map((group) => ({ ...group, type: "ODI bowler matchup" })),
    ...opponentGroups.map((group) => ({ ...group, type: "ODI opposition" })),
  ]
    .filter((group) => group.balls >= 12)
    .sort((left, right) => right.score - left.score || right.balls - left.balls)
    .slice(0, 6);
  const combinedSignals = formatViews["All formats"].signals;

  return {
    id: player.key,
    name: player.name,
    team: player.team,
    playerId: player.playerId,
    projectionTier: rankInTeam <= 15 ? "Core squad candidate" : "Extended squad watchlist",
    rankInTeam,
    role: roleFromPhases(phaseGroups, recent),
    firstSeen: player.firstDate,
    lastPlayed: player.latestDate,
    recent,
    host,
    allFormat,
    formatViews,
    conditionFit: conditionFit(recent, host),
    phases: phaseGroups,
    hostCountries: hostCountryGroups,
    hostVenues: venueGroups,
    bowlers: bowlerGroups,
    opponents: opponentGroups,
    bowlingStyles: bowlingStyleGroups,
    bowlingTypes: bowlingTypeGroups,
    bowlingArms: bowlingArmGroups,
    formatSplits: formatGroups,
    stageSplits: stageGroups,
    dismissals: summarizeDismissals(player.recentRows),
    allFormatDismissals: summarizeDismissals(player.allFormatRows),
    signals,
    allFormatSignals: combinedSignals,
    conclusion: formatViews["All formats"].conclusion,
  };
});

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

const pitchBehaviors = hostCountries
  .map((country) => venueProfile(hostCountryRows.get(country) || [], country, country))
  .filter((profile) => profile.matches > 0);

const recentDates = outputPlayers.map((player) => player.lastPlayed).sort();
const styleKnownBalls = outputPlayers.reduce((sum, player) => sum + player.allFormat.knownStyleBalls, 0);
const allStyleBalls = outputPlayers.reduce((sum, player) => sum + player.allFormat.balls, 0);

const result = {
  metadata: {
    source: "Cricsheet men's international JSON archives",
    sourceUrl: "https://cricsheet.org/downloads/",
    cwcOfficialSource:
      "https://www.icc-cricket.com/media-releases/hosts-of-u19-icc-global-events-until-2027-announced",
    generatedOn: new Date().toISOString().slice(0, 10),
    recentStart,
    activeCutoff,
    allFormatStart,
    hostConditionStart,
    hostCountries,
    directHostQualifiers,
    formatsUsed: ["Test", "ODI", "T20I"],
    teamsTracked: teams.length,
    projectedPlayers: outputPlayers.length,
    scannedMatches,
    recentMatches,
    recentDeliveries,
    allFormatMatches,
    allFormatDeliveries,
    hostConditionMatches,
    coverageFrom: recentDates[0] || "",
    coverageThrough: recentDates.at(-1) || "",
    maxPlayersPerTeam,
    styleCoverage: allStyleBalls ? Number((styleKnownBalls / allStyleBalls).toFixed(3)) : 0,
    unavailableNote:
      "Cricsheet withholds Afghanistan men's matches, so Afghanistan player projections are not included in this real-data build.",
    lineLengthNote:
      "Cricsheet scorecards do not include true line/length or delivery tracking. Bowler-style and matchup weaknesses are real outcome patterns, not guessed tracking data.",
    projectionNote:
      "CWC 2027 squads and many qualifiers are not confirmed. This app uses recent ODI appearances as a realistic player-pool projection, not an official squad list.",
  },
  teams,
  players: outputPlayers,
  venueProfiles,
  pitchBehaviors,
  conditionNotes: countryConditionNotes,
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `window.CWC2027_ODI_DATA = ${JSON.stringify(result)};\n`, "utf8");

console.log(
  `Wrote ${outputPlayers.length} CWC player projections with ${allFormatDeliveries} all-format deliveries from ${allFormatMatches} matches.`,
);

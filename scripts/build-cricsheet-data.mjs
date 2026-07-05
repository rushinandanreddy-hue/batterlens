import fs from "node:fs";
import path from "node:path";

const inputDirectory = process.argv[2];
const outputFile = process.argv[3];

if (!inputDirectory || !outputFile) {
  throw new Error("Usage: node scripts/build-cricsheet-data.mjs <json-directory> <output-file>");
}

const playoffTeams = [
  "Royal Challengers Bengaluru",
  "Gujarat Titans",
  "Sunrisers Hyderabad",
  "Rajasthan Royals",
];

const displayNames = {
  "AF Milne": "Adam Milne",
  "B Kumar": "Bhuvneshwar Kumar",
  "B Sai Sudharsan": "Sai Sudharsan",
  "DA Payne": "David Payne",
  "D Padikkal": "Devdutt Padikkal",
  "D Ferreira": "Donovan Ferreira",
  "E Malinga": "Eshan Malinga",
  "GD Phillips": "Glenn Phillips",
  "H Klaasen": "Heinrich Klaasen",
  "HV Patel": "Harshal Patel",
  "JC Archer": "Jofra Archer",
  "JC Buttler": "Jos Buttler",
  "JD Unadkat": "Jaydev Unadkat",
  "JG Bethell": "Jacob Bethell",
  "JM Sharma": "Jitesh Sharma",
  "JO Holder": "Jason Holder",
  "JR Hazlewood": "Josh Hazlewood",
  "K Rabada": "Kagiso Rabada",
  "KH Pandya": "Krunal Pandya",
  "LG Pretorius": "Lhuan-dre Pretorius",
  "LS Livingstone": "Liam Livingstone",
  "MD Shanaka": "Dasun Shanaka",
  "N Burger": "Nandre Burger",
  "N Sindhu": "Nishant Sindhu",
  "PD Salt": "Phil Salt",
  "PJ Cummins": "Pat Cummins",
  "PP Hinge": "Praful Hinge",
  "R Parag": "Riyan Parag",
  "R Tewatia": "Rahul Tewatia",
  "R Smaran": "Smaran Ravichandran",
  "R Shepherd": "Romario Shepherd",
  "RA Jadeja": "Ravindra Jadeja",
  "RM Patidar": "Rajat Patidar",
  "S Arora": "Salil Arora",
  "SB Dubey": "Shubham Dubey",
  "SO Hetmyer": "Shimron Hetmyer",
  "TH David": "Tim David",
  "TM Head": "Travis Head",
  "TU Deshpande": "Tushar Deshpande",
  "V Kohli": "Virat Kohli",
  "V Suryavanshi": "Vaibhav Sooryavanshi",
  "VR Iyer": "Venkatesh Iyer",
  "YBK Jaiswal": "Yashasvi Jaiswal",
  "Nithish Kumar Reddy": "Nitish Kumar Reddy",
};

function nameFor(player) {
  return displayNames[player] || player;
}

function phaseForOver(overNumber) {
  if (overNumber < 6) return "Powerplay";
  if (overNumber < 16) return "Middle";
  return "Death";
}

const files = fs.readdirSync(inputDirectory).filter((file) => file.endsWith(".json"));
const matches = [];

for (const file of files) {
  const match = JSON.parse(fs.readFileSync(path.join(inputDirectory, file), "utf8"));
  if (String(match.info.season) !== "2026") continue;
  matches.push({ id: file.replace(".json", ""), match });
}

matches.sort((left, right) =>
  String(left.match.info.dates[0]).localeCompare(String(right.match.info.dates[0])),
);

const deliveries = [];
for (const { id, match } of matches) {
  const matchDate = String(match.info.dates[0]);
  for (const innings of match.innings) {
    if (!playoffTeams.includes(innings.team)) continue;
    for (const over of innings.overs) {
      for (const delivery of over.deliveries) {
        const batterWicket = (delivery.wickets || []).find(
          (wicket) => wicket.player_out === delivery.batter,
        );
        const extras = delivery.extras || {};
        deliveries.push({
          batter: nameFor(delivery.batter),
          iplTeam: innings.team,
          playoffQualified: true,
          ipl2026Played: true,
          bowler: nameFor(delivery.bowler),
          phase: phaseForOver(over.over),
          runs: delivery.runs.batter,
          dismissal: Boolean(batterWicket),
          dismissalKind: batterWicket?.kind || "",
          countsAsBall: !("wides" in extras) && !("noballs" in extras),
          matchId: id,
          matchDate,
        });
      }
    }
  }
}

const batters = [
  ...new Set(deliveries.map((delivery) => `${delivery.iplTeam}|${delivery.batter}`)),
];

const result = {
  metadata: {
    source: "Cricsheet IPL JSON",
    sourceUrl: "https://cricsheet.org/matches/",
    formatUrl: "https://cricsheet.org/format/json/",
    season: 2026,
    matchesAvailable: matches.length,
    coverageFrom: matches[0]?.match.info.dates[0] || "",
    coverageThrough: matches.at(-1)?.match.info.dates[0] || "",
    playoffTeams,
    qualifiedTeamBatters: batters.length,
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
  `Wrote ${deliveries.length} deliveries for ${batters.length} batters from ${matches.length} IPL 2026 matches.`,
);

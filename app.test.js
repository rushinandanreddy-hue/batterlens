"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class ElementStub {
  constructor() {
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.dataset = {};
    this.innerHTML = "";
    this.textContent = "";
  }

  addEventListener() {}

  querySelectorAll() {
    return [];
  }

  replaceChildren() {}
}

const sandbox = {
  console,
  document: {
    createElement: () => new ElementStub(),
    querySelector: () => new ElementStub(),
  },
  window: {},
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("data/cwc-2027-odi.js", "utf8"), sandbox);
const source = fs.readFileSync("app.js", "utf8");
vm.runInContext(
  `${source}\nthis.analysis = { SOURCE_DATA, HOST_COUNTRIES, state, filteredPlayers, currentPlayer, comparePlayer, teamMeta, confidenceLabel, activeFormatView, dismissalProbabilityModel, winImpactModel, generatedReportText, shotHeatmapZones, playerReadinessScore };`,
  sandbox,
);

const {
  SOURCE_DATA,
  HOST_COUNTRIES,
  state,
  filteredPlayers,
  currentPlayer,
  comparePlayer,
  teamMeta,
  confidenceLabel,
  activeFormatView,
  dismissalProbabilityModel,
  winImpactModel,
  generatedReportText,
  shotHeatmapZones,
  playerReadinessScore,
} =
  sandbox.analysis;
const { metadata, teams, players, venueProfiles, pitchBehaviors } = SOURCE_DATA;

assert.equal(metadata.source, "Cricsheet men's international JSON archives");
assert.equal(metadata.recentStart, "2023-01-01");
assert.equal(metadata.activeCutoff, "2024-01-01");
assert.equal(metadata.allFormatStart, "2021-01-01");
assert.equal(metadata.hostConditionStart, "2020-01-01");
assert.equal(metadata.teamsTracked, 19);
assert.equal(metadata.projectedPlayers, 406);
assert.equal(metadata.recentMatches, 432);
assert.equal(metadata.recentDeliveries, 225155);
assert.equal(metadata.allFormatMatches, 3360);
assert.equal(metadata.allFormatDeliveries, 634823);
assert.equal(metadata.hostConditionMatches, 135);
assert.deepEqual(Array.from(metadata.formatsUsed), ["Test", "ODI", "T20I"]);
assert.ok(metadata.styleCoverage > 0.6);
assert.ok(metadata.lineLengthNote.includes("do not include true line/length"));
assert.deepEqual(Array.from(HOST_COUNTRIES), ["South Africa", "Zimbabwe", "Namibia"]);
assert.ok(metadata.unavailableNote.includes("Afghanistan"));

assert.equal(players.length, metadata.projectedPlayers);
assert.equal(players.every((player) => player.recent.balls >= 12), true);
assert.equal(players.some((player) => player.team === "Afghanistan"), false);
assert.ok(teams.some((team) => team.team === "South Africa" && team.qualifierStatus.includes("Automatic")));
assert.ok(teams.some((team) => team.team === "Namibia" && team.qualifierStatus.includes("must qualify")));

const indiaPlayers = players.filter((player) => player.team === "India");
assert.ok(indiaPlayers.length >= 15);
const kohli = players.find((player) => player.team === "India" && player.name === "V Kohli");
assert.ok(kohli);
assert.ok(kohli.recent.balls > 1000);
assert.ok(kohli.allFormat.balls > kohli.recent.balls);
assert.ok(kohli.host.balls > 0);
assert.ok(kohli.conditionFit.label);
assert.ok(kohli.signals.length > 0);
assert.ok(kohli.allFormatSignals.length > 0);
assert.ok(kohli.bowlingStyles.some((group) => group.key === "Left-arm orthodox spin"));
assert.ok(kohli.conclusion.headline.includes("troubled by"));
assert.ok(kohli.dismissals.length > 0);
assert.ok(kohli.allFormatDismissals.length > 0);
assert.deepEqual(Object.keys(kohli.formatViews), ["All formats", "ODI", "Test", "T20I"]);
assert.equal(kohli.formatViews["All formats"].summary.balls, kohli.allFormat.balls);
assert.ok(kohli.formatViews.ODI.summary.balls > 0);
assert.ok(kohli.formatViews.Test.summary.balls > 0);
assert.ok(kohli.formatViews.T20I.summary.balls > 0);
assert.notEqual(kohli.formatViews.ODI.summary.balls, kohli.formatViews.Test.summary.balls);

assert.ok(venueProfiles.some((venue) => venue.country === "South Africa"));
assert.ok(venueProfiles.some((venue) => venue.key.includes("Windhoek")));
assert.ok(venueProfiles.every((venue) => venue.matches >= 2));
assert.ok(venueProfiles.every((venue) => venue.phaseFactors.length > 0));
assert.ok(venueProfiles.every((venue) => typeof venue.behaviorSummary === "string"));
assert.ok(Array.isArray(pitchBehaviors));
assert.equal(pitchBehaviors.length, 3);
const southAfricaPitch = pitchBehaviors.find((profile) => profile.country === "South Africa");
assert.ok(southAfricaPitch);
assert.ok(southAfricaPitch.phaseFactors.length > 0);
assert.ok(southAfricaPitch.bowlingTypeFactors.length > 0);
assert.ok(southAfricaPitch.bowlingArmFactors.length > 0);
assert.ok(southAfricaPitch.dismissalModes.length > 0);
assert.ok(southAfricaPitch.behaviorSummary.includes("venue"));

state.team = "India";
state.tier = "Core squad candidate";
state.playerId = "";
assert.ok(filteredPlayers().every((player) => player.team === "India"));
assert.ok(filteredPlayers().every((player) => player.projectionTier === "Core squad candidate"));
assert.equal(currentPlayer().team, "India");
assert.equal(teamMeta("South Africa").qualifierStatus, "Automatic host qualifier");
assert.equal(confidenceLabel(400), "Strong sample");
state.playerId = kohli.id;
state.format = "T20I";
assert.equal(activeFormatView(kohli).label, "T20I");
assert.equal(activeFormatView(kohli).summary.balls, kohli.formatViews.T20I.summary.balls);
assert.ok(comparePlayer());
const dismissalModel = dismissalProbabilityModel(kohli);
assert.ok(dismissalModel.nextOver > 0);
assert.ok(dismissalModel.nextThirty > dismissalModel.nextOver);
const winModel = winImpactModel(kohli);
assert.ok(winModel.playerImpact >= 5 && winModel.playerImpact <= 95);
assert.ok(winModel.winReadiness >= 5 && winModel.winReadiness <= 95);
assert.ok(generatedReportText(kohli).some((line) => line.includes("Generated locally")));
assert.ok(shotHeatmapZones(kohli).length > 0);
assert.ok(playerReadinessScore(kohli) >= 5);

console.log("BatterLens CWC 2027 all-format projection tests passed.");

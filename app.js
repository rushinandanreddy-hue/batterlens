"use strict";

const SOURCE_DATA = window.CWC2027_ODI_DATA || {
  metadata: {},
  teams: [],
  players: [],
  venueProfiles: [],
  pitchBehaviors: [],
  conditionNotes: {},
};

const ALL_TEAMS = "All countries";
const ALL_TIERS = "All projected tiers";
const ALL_HOSTS = "All host countries";
const HOST_COUNTRIES = SOURCE_DATA.metadata.hostCountries || ["South Africa", "Zimbabwe", "Namibia"];
const TIER_CHOICES = ["Core squad candidate", "Extended squad watchlist"];
const FORMAT_CHOICES = ["All formats", "ODI", "Test", "T20I"];

const state = {
  team: ALL_TEAMS,
  playerId: "",
  comparePlayerId: "",
  tier: ALL_TIERS,
  hostCountry: ALL_HOSTS,
  format: "All formats",
  selectedSignal: null,
  selectedHostCountry: null,
  selectedBowlingStyle: null,
};

const elements = {
  datasetName: document.querySelector("#dataset-name"),
  datasetNote: document.querySelector("#dataset-note"),
  team: document.querySelector("#team-filter"),
  player: document.querySelector("#batter-filter"),
  comparePlayer: document.querySelector("#compare-player-filter"),
  tier: document.querySelector("#tier-filter"),
  host: document.querySelector("#host-filter"),
  formatButtons: document.querySelector("#format-buttons"),
  playerProfile: document.querySelector("#batter-profile"),
  metrics: document.querySelector("#metrics"),
  roster: document.querySelector("#squad-watchlist"),
  rosterCount: document.querySelector("#roster-count"),
  pressureSignals: document.querySelector("#pressure-signals-list"),
  pressureDetail: document.querySelector("#pressure-detail"),
  bowlingStyleMap: document.querySelector("#bowling-style-map"),
  bowlingStyleDetail: document.querySelector("#bowling-style-detail"),
  hostMap: document.querySelector("#host-condition-map"),
  hostDetail: document.querySelector("#host-condition-detail"),
  venueProfiles: document.querySelector("#venue-profiles"),
  venueDetail: document.querySelector("#venue-detail"),
  signals: document.querySelector("#weakness-signals"),
  dismissalBreakdown: document.querySelector("#dismissal-breakdown"),
  phaseBreakdown: document.querySelector("#phase-breakdown"),
  dismissalProbability: document.querySelector("#dismissal-probability"),
  winProbability: document.querySelector("#win-probability"),
  generatedReport: document.querySelector("#generated-report"),
  playerComparison: document.querySelector("#player-comparison"),
  shotHeatmap: document.querySelector("#shot-heatmap"),
  plan: document.querySelector("#bowling-plan"),
  planConfidence: document.querySelector("#plan-confidence"),
};

function percent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function oneDecimal(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "0.0";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function formatDate(dateValue) {
  if (!dateValue) return "unknown date";
  const [year, month, day] = dateValue.split("-");
  const monthName = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][Number(month) - 1];
  return `${Number(day)} ${monthName} ${year}`;
}

function confidenceLabel(balls) {
  if (balls >= 300) return "Strong sample";
  if (balls >= 120) return "Useful sample";
  if (balls >= 36) return "Early sample";
  return "Tiny sample";
}

function ballCount(count) {
  return `${count} ${count === 1 ? "ball" : "balls"}`;
}

function wicketsPer100(group) {
  return oneDecimal((group?.wicketRate || 0) * 100);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function probabilityFromRate(rate, balls) {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return clamp(1 - (1 - rate) ** balls, 0, 0.99);
}

function probabilityText(value) {
  return `${Math.round(clamp(value, 0, 0.99) * 100)}%`;
}

function dismissalsPer100(summary) {
  return oneDecimal((summary?.dismissalRate || 0) * 100);
}

function boundaryRate(summary) {
  return summary?.balls ? summary.boundaries / summary.balls : 0;
}

function playerReadinessScore(player) {
  const recent = player.recent || {};
  const fit = player.conditionFit || {};
  const hostAdjustment = fit.score === null || fit.score === undefined ? 0 : (fit.score - 50) * 0.22;
  const battingBase =
    52 +
    (recent.strikeRate - 82) * 0.22 +
    (0.5 - recent.dotRate) * 44 -
    recent.dismissalRate * 420 +
    boundaryRate(recent) * 85 +
    hostAdjustment;
  return Math.round(clamp(battingBase, 5, 95));
}

function fitScoreText(fit) {
  return fit?.score === null || fit?.score === undefined ? "Unproven" : `${fit.score}/100`;
}

function activeFormatView(player) {
  return (
    player.formatViews?.[state.format] ||
    player.formatViews?.["All formats"] || {
      label: "All formats",
      summary: player.allFormat || player.recent,
      bowlingStyles: player.bowlingStyles || [],
      signals: player.allFormatSignals || player.signals || [],
      stages: player.stageSplits || player.phases || [],
      dismissals: player.allFormatDismissals || player.dismissals || [],
      conclusion: player.conclusion || {},
    }
  );
}

function formatFootnote(view) {
  if (view.label === "All formats") return "Tests, ODIs and T20Is since 2021";
  if (view.label === "ODI") return "ODIs since 2021";
  if (view.label === "Test") return "Tests since 2021";
  return "T20Is since 2021";
}

function teamMeta(team) {
  return SOURCE_DATA.teams.find((item) => item.team === team) || {};
}

function playerSort(left, right) {
  return (
    left.team.localeCompare(right.team) ||
    left.rankInTeam - right.rankInTeam ||
    left.name.localeCompare(right.name)
  );
}

function filteredPlayers() {
  return SOURCE_DATA.players
    .filter((player) => state.team === ALL_TEAMS || player.team === state.team)
    .filter((player) => state.tier === ALL_TIERS || player.projectionTier === state.tier)
    .sort(playerSort);
}

function currentPlayer() {
  return SOURCE_DATA.players.find((player) => player.id === state.playerId) || filteredPlayers()[0];
}

function comparePlayer() {
  return SOURCE_DATA.players.find((player) => player.id === state.comparePlayerId);
}

function fillSelect(select, choices, selected) {
  select.replaceChildren(
    ...choices.map((choice) => {
      const option = document.createElement("option");
      const value = typeof choice === "string" ? choice : choice.value;
      const label = typeof choice === "string" ? choice : choice.label;
      option.value = value;
      option.textContent = label;
      option.selected = value === selected;
      return option;
    }),
  );
}

function refreshFilters() {
  const teams = SOURCE_DATA.teams.map((team) => team.team).sort();
  if (state.team !== ALL_TEAMS && !teams.includes(state.team)) state.team = ALL_TEAMS;
  if (state.tier !== ALL_TIERS && !TIER_CHOICES.includes(state.tier)) state.tier = ALL_TIERS;
  if (state.hostCountry !== ALL_HOSTS && !HOST_COUNTRIES.includes(state.hostCountry)) {
    state.hostCountry = ALL_HOSTS;
  }

  const players = filteredPlayers();
  if (!players.some((player) => player.id === state.playerId)) {
    state.playerId = players[0]?.id || "";
  }
  const current = SOURCE_DATA.players.find((player) => player.id === state.playerId);
  const compareChoices = SOURCE_DATA.players.filter((player) => player.id !== state.playerId).sort(playerSort);
  if (
    !state.comparePlayerId ||
    state.comparePlayerId === state.playerId ||
    !compareChoices.some((player) => player.id === state.comparePlayerId)
  ) {
    state.comparePlayerId =
      compareChoices.find((player) => player.team === current?.team)?.id || compareChoices[0]?.id || "";
  }

  fillSelect(elements.team, [ALL_TEAMS, ...teams], state.team);
  fillSelect(
    elements.player,
    players.map((player) => ({ value: player.id, label: `${player.name} - ${player.team}` })),
    state.playerId,
  );
  fillSelect(
    elements.comparePlayer,
    compareChoices.map((player) => ({ value: player.id, label: `${player.name} - ${player.team}` })),
    state.comparePlayerId,
  );
  fillSelect(elements.tier, [ALL_TIERS, ...TIER_CHOICES], state.tier);
  fillSelect(elements.host, [ALL_HOSTS, ...HOST_COUNTRIES], state.hostCountry);
}

function renderDatasetNote() {
  const metadata = SOURCE_DATA.metadata;
  elements.datasetName.textContent = metadata.source || "ODI data";
  elements.datasetNote.textContent = `${metadata.projectedPlayers || 0} ODI player projections across ${
    metadata.teamsTracked || 0
  } countries. All-format weakness model: ${(metadata.allFormatDeliveries || 0).toLocaleString()} balls from ${
    metadata.allFormatMatches || 0
  } Test/ODI/T20I matches. Recent ODI form from ${formatDate(metadata.coverageFrom)} to ${formatDate(
    metadata.coverageThrough,
  )}; host-condition model from ${formatDate(metadata.hostConditionStart)}.`;
}

function renderFormatButtons() {
  elements.formatButtons.innerHTML = FORMAT_CHOICES.map(
    (format) => `
      <button type="button" class="format-button${format === state.format ? " selected" : ""}" data-format="${escapeHtml(
        format,
      )}">${escapeHtml(format)}</button>
    `,
  ).join("");

  elements.formatButtons.querySelectorAll("[data-format]").forEach((button) => {
    button.addEventListener("click", () => {
      state.format = button.dataset.format;
      state.selectedSignal = null;
      state.selectedBowlingStyle = null;
      render();
    });
  });
}

function renderProfile(player) {
  const meta = teamMeta(player.team);
  elements.playerProfile.innerHTML = `
    <span class="profile-dot">INTL</span>
    <span>
      <strong>${escapeHtml(player.name)}</strong><br>${escapeHtml(player.team)}
      <br><small class="active-label">${escapeHtml(player.projectionTier)} | ${escapeHtml(
        meta.qualifierStatus || "Qualification not locked yet",
      )}</small>
    </span>
  `;
}

function renderMetrics(player) {
  const recent = player.recent;
  const host = player.host;
  const formatView = activeFormatView(player);
  const formatSummary = formatView.summary || player.allFormat || recent;
  const fit = player.conditionFit;
  const troubleStyle = formatView.bowlingStyles?.find((group) => !group.key.includes("Unknown"));
  const metrics = [
    {
      label: "Recent ODI record",
      value: `${recent.runs} / ${oneDecimal(recent.strikeRate)}`,
      footnote: `${ballCount(recent.balls)} since 2023`,
    },
    {
      label: `${formatView.label} record`,
      value: `${formatSummary.runs} / ${oneDecimal(formatSummary.strikeRate)}`,
      footnote: `${ballCount(formatSummary.balls)} in ${formatFootnote(formatView)}`,
    },
    {
      label: "Trouble type",
      value: troubleStyle ? troubleStyle.key.replace(" spin", "") : "Building",
      footnote: troubleStyle
        ? `${troubleStyle.dismissals} outs | ${percent(troubleStyle.dotRate)} dots`
        : "Needs more known bowler-style balls",
    },
    {
      label: "CWC 2027 fit",
      value: fitScoreText(fit),
      footnote: fit?.label || "Projection unavailable",
    },
  ];

  elements.metrics.innerHTML = metrics
    .map(
      (metric) => `
        <article class="metric">
          <p class="metric-label">${escapeHtml(metric.label)}</p>
          <p class="metric-value">${escapeHtml(metric.value)}</p>
          <p class="metric-footnote">${escapeHtml(metric.footnote)}</p>
        </article>
      `,
    )
    .join("");
}

function renderRoster() {
  const players = filteredPlayers();
  elements.rosterCount.textContent = `${players.length} players`;
  if (!players.length) {
    elements.roster.innerHTML = '<p class="empty-message">No players match these filters.</p>';
    return;
  }

  elements.roster.innerHTML = players
    .map((player) => {
      const selected = player.id === state.playerId ? " selected" : "";
      const fit = player.conditionFit;
      return `
        <button type="button" class="roster-card${selected}" data-player-id="${escapeHtml(
          player.id,
        )}">
          <strong>${escapeHtml(player.name)}</strong>
          <span>${escapeHtml(player.team)} | ${escapeHtml(player.role)}</span>
          <span>${player.recent.runs} runs | SR ${oneDecimal(player.recent.strikeRate)} | ${escapeHtml(
            player.projectionTier,
          )}</span>
          <span class="roster-score">${escapeHtml(player.conclusion?.headline || fit?.label || "No fit label")}</span>
        </button>
      `;
    })
    .join("");

  elements.roster.querySelectorAll("[data-player-id]").forEach((card) => {
    card.addEventListener("click", () => {
      state.playerId = card.dataset.playerId;
      state.selectedSignal = null;
      state.selectedHostCountry = null;
      state.selectedBowlingStyle = null;
      render();
    });
  });
}

function renderPressureDetail(signal) {
  if (!signal) {
    elements.pressureDetail.innerHTML =
      '<p class="empty-message">No pressure signal has enough balls for this player yet.</p>';
    return;
  }

  elements.pressureDetail.innerHTML = `
    <h3>${escapeHtml(signal.type)}: ${escapeHtml(signal.key)}</h3>
    <div class="zone-stats">
      <div class="zone-stat"><span>Balls</span><strong>${signal.balls}</strong></div>
      <div class="zone-stat"><span>Runs</span><strong>${signal.runs}</strong></div>
      <div class="zone-stat"><span>Strike rate</span><strong>${oneDecimal(signal.strikeRate)}</strong></div>
      <div class="zone-stat"><span>Dots</span><strong>${percent(signal.dotRate)}</strong></div>
      <div class="zone-stat"><span>Dismissals</span><strong>${signal.dismissals}</strong></div>
      <div class="zone-stat"><span>Evidence</span><strong>${confidenceLabel(signal.balls)}</strong></div>
    </div>
    <span class="risk-pill ${signal.risk}">${signal.risk} pressure</span>
  `;
}

function renderPressureSignals(player) {
  const signals = activeFormatView(player).signals || [];
  if (!signals.length) {
    elements.pressureSignals.innerHTML =
      '<p class="empty-message">No pressure signal has reached the minimum sample yet.</p>';
    renderPressureDetail(null);
    return;
  }

  if (!state.selectedSignal || !signals.some((signal) => `${signal.type}|${signal.key}` === state.selectedSignal)) {
    state.selectedSignal = `${signals[0].type}|${signals[0].key}`;
  }

  elements.pressureSignals.innerHTML = signals
    .map((signal) => {
      const id = `${signal.type}|${signal.key}`;
      return `
        <button type="button" class="matchup-row${id === state.selectedSignal ? " selected" : ""}" data-signal="${escapeHtml(
          id,
        )}">
          <span>
            <strong>${escapeHtml(signal.type)}</strong>
            <small>${escapeHtml(signal.key)} | ${signal.balls} balls | SR ${oneDecimal(
              signal.strikeRate,
            )}</small>
          </span>
          <span class="risk-pill ${signal.risk}">${Math.round(signal.score * 100)}</span>
        </button>
      `;
    })
    .join("");

  elements.pressureSignals.querySelectorAll("[data-signal]").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedSignal = row.dataset.signal;
      renderPressureSignals(player);
    });
  });

  renderPressureDetail(signals.find((signal) => `${signal.type}|${signal.key}` === state.selectedSignal));
}

function renderBowlingStyleDetail(group, player) {
  if (!group) {
    elements.bowlingStyleDetail.innerHTML =
      '<p class="empty-message">No bowler-style split has enough sample yet.</p>';
    return;
  }

  elements.bowlingStyleDetail.innerHTML = `
    <h3>${escapeHtml(group.key)}</h3>
    <div class="zone-stats">
      <div class="zone-stat"><span>Balls</span><strong>${group.balls}</strong></div>
      <div class="zone-stat"><span>Runs</span><strong>${group.runs}</strong></div>
      <div class="zone-stat"><span>Strike rate</span><strong>${oneDecimal(group.strikeRate)}</strong></div>
      <div class="zone-stat"><span>Dots</span><strong>${percent(group.dotRate)}</strong></div>
      <div class="zone-stat"><span>Dismissals</span><strong>${group.dismissals}</strong></div>
      <div class="zone-stat"><span>Evidence</span><strong>${confidenceLabel(group.balls)}</strong></div>
    </div>
    <p class="helper-text">${escapeHtml(activeFormatView(player).conclusion?.lineLengthText || SOURCE_DATA.metadata.lineLengthNote || "")}</p>
    <span class="risk-pill ${group.risk}">${group.risk} pressure</span>
  `;
}

function renderBowlingStyleTrouble(player) {
  const styles = (activeFormatView(player).bowlingStyles || []).filter(
    (group) => !group.key.includes("Unknown"),
  );
  if (!styles.length) {
    elements.bowlingStyleMap.innerHTML =
      '<p class="empty-message">No known bowler-style sample is available for this player yet.</p>';
    renderBowlingStyleDetail(null, player);
    return;
  }

  if (!state.selectedBowlingStyle || !styles.some((group) => group.key === state.selectedBowlingStyle)) {
    state.selectedBowlingStyle = styles[0].key;
  }

  elements.bowlingStyleMap.innerHTML = styles
    .slice(0, 8)
    .map(
      (group) => `
        <button type="button" class="line-cell${group.key === state.selectedBowlingStyle ? " selected" : ""}" data-bowling-style="${escapeHtml(group.key)}">
          <strong>${escapeHtml(group.key)}</strong>
          <span>${group.balls} balls | SR ${oneDecimal(group.strikeRate)} | ${group.dismissals} outs</span>
          <span>${percent(group.dotRate)} dots | ${group.runs} runs</span>
          <span class="risk-pill ${group.risk}">${Math.round(group.score * 100)}</span>
        </button>
      `,
    )
    .join("");

  elements.bowlingStyleMap.querySelectorAll("[data-bowling-style]").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedBowlingStyle = card.dataset.bowlingStyle;
      renderBowlingStyleTrouble(player);
    });
  });

  renderBowlingStyleDetail(
    styles.find((group) => group.key === state.selectedBowlingStyle),
    player,
  );
}

function hostGroupFor(player, country) {
  return player.hostCountries.find((group) => group.key === country);
}

function renderHostDetail(player, country) {
  const group = hostGroupFor(player, country);
  const note = SOURCE_DATA.conditionNotes[country] || "";

  if (!group) {
    elements.hostDetail.innerHTML = `
      <h3>${escapeHtml(country)}</h3>
      <p class="empty-message">No direct ODI balls for ${escapeHtml(
        player.name,
      )} in this host country inside the source window.</p>
      <p class="helper-text">${escapeHtml(note)}</p>
    `;
    return;
  }

  elements.hostDetail.innerHTML = `
    <h3>${escapeHtml(country)} sample</h3>
    <div class="zone-stats">
      <div class="zone-stat"><span>Balls</span><strong>${group.balls}</strong></div>
      <div class="zone-stat"><span>Runs</span><strong>${group.runs}</strong></div>
      <div class="zone-stat"><span>Strike rate</span><strong>${oneDecimal(group.strikeRate)}</strong></div>
      <div class="zone-stat"><span>Dots</span><strong>${percent(group.dotRate)}</strong></div>
      <div class="zone-stat"><span>Dismissals</span><strong>${group.dismissals}</strong></div>
      <div class="zone-stat"><span>Evidence</span><strong>${confidenceLabel(group.balls)}</strong></div>
    </div>
    <p class="helper-text">${escapeHtml(note)}</p>
    <span class="risk-pill ${group.risk}">${group.risk} pressure</span>
  `;
}

function renderHostMap(player) {
  const countries = state.hostCountry === ALL_HOSTS ? HOST_COUNTRIES : [state.hostCountry];
  if (!state.selectedHostCountry || !countries.includes(state.selectedHostCountry)) {
    state.selectedHostCountry = countries.find((country) => hostGroupFor(player, country)) || countries[0];
  }

  elements.hostMap.innerHTML = countries
    .map((country) => {
      const group = hostGroupFor(player, country);
      const selected = country === state.selectedHostCountry ? " selected" : "";
      return `
        <button type="button" class="line-cell${selected}" data-host-country="${escapeHtml(country)}">
          <strong>${escapeHtml(country)}</strong>
          ${
            group
              ? `<span>${group.balls} balls | SR ${oneDecimal(group.strikeRate)} | ${group.dismissals} outs</span>
                 <span>${percent(group.dotRate)} dots | ${group.runs} runs</span>
                 <span class="risk-pill ${group.risk}">${Math.round(group.score * 100)}</span>`
              : `<span>No direct sample</span><span>Use venue model and overall form</span>`
          }
        </button>
      `;
    })
    .join("");

  elements.hostMap.querySelectorAll("[data-host-country]").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedHostCountry = card.dataset.hostCountry;
      renderHostMap(player);
    });
  });

  renderHostDetail(player, state.selectedHostCountry);
}

function pitchFactorLine(label, group) {
  if (!group) {
    return `
      <div class="pitch-factor-line">
        <span>${escapeHtml(label)}</span>
        <strong>Sample building</strong>
        <small>Not enough balls for this factor yet.</small>
      </div>
    `;
  }

  return `
    <div class="pitch-factor-line">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(group.key)}</strong>
      <small>${group.balls} balls | RR ${oneDecimal(group.runRate)} | dots ${percent(
        group.dotRate,
      )} | wickets ${wicketsPer100(group)}/100 balls</small>
    </div>
  `;
}

function dismissalFactorLine(group) {
  if (!group) {
    return `
      <div class="pitch-factor-line">
        <span>Common dismissal</span>
        <strong>Sample building</strong>
        <small>No clear dismissal pattern yet.</small>
      </div>
    `;
  }

  return `
    <div class="pitch-factor-line">
      <span>Common dismissal</span>
      <strong>${escapeHtml(group.key)}</strong>
      <small>${group.wickets} wickets in host-country ODIs.</small>
    </div>
  `;
}

function renderPitchBehaviorCard(model) {
  const phase = model.phaseFactors?.[0];
  const bowlingType =
    model.bowlingTypeFactors?.find((group) => !group.key.includes("Unknown")) ||
    model.bowlingTypeFactors?.[0];
  const bowlingArm =
    model.bowlingArmFactors?.find((group) => !group.key.includes("Unknown")) ||
    model.bowlingArmFactors?.[0];
  const dismissal = model.dismissalModes?.[0];

  return `
    <article class="pitch-behavior-card">
      <div class="pitch-behavior-top">
        <strong>${escapeHtml(model.country)}</strong>
        <span class="risk-pill ${model.risk}">${Math.round((model.score || 0) * 100)}</span>
      </div>
      <p>${escapeHtml(model.behaviorSummary || model.label)}</p>
      <div class="pitch-metrics">
        <div><span>Run rate</span><strong>${oneDecimal(model.runRate)}</strong></div>
        <div><span>Dots</span><strong>${percent(model.dotRate)}</strong></div>
        <div><span>Wickets</span><strong>${wicketsPer100(model)}/100</strong></div>
        <div><span>Boundaries</span><strong>${percent(model.boundaryRate)}</strong></div>
      </div>
      <div class="pitch-factor-list">
        ${pitchFactorLine("Toughest phase", phase)}
        ${pitchFactorLine("Bowler type help", bowlingType)}
        ${pitchFactorLine("Bowling arm help", bowlingArm)}
        ${dismissalFactorLine(dismissal)}
      </div>
    </article>
  `;
}

function renderVenueProfiles(player) {
  const profiles = SOURCE_DATA.venueProfiles.filter(
    (profile) => state.hostCountry === ALL_HOSTS || profile.country === state.hostCountry,
  );
  const pitchBehaviors = (SOURCE_DATA.pitchBehaviors || []).filter(
    (profile) => state.hostCountry === ALL_HOSTS || profile.country === state.hostCountry,
  );
  const playerVenues = player.hostVenues || [];
  const totalMatches = profiles.reduce((sum, profile) => sum + profile.matches, 0);

  if (!profiles.length) {
    elements.venueProfiles.innerHTML =
      '<p class="empty-message">No host venue profiles are available for this filter.</p>';
    elements.venueDetail.innerHTML = "";
    return;
  }

  elements.venueProfiles.innerHTML = profiles
    .slice(0, 12)
    .map(
      (profile) => `
        <article class="venue-card">
          <strong>${escapeHtml(profile.key.replace(`, ${profile.country}`, ""))}</strong>
          <span>${escapeHtml(profile.country)} | ${profile.matches} matches</span>
          <span>RR ${oneDecimal(profile.runRate)} | Dots ${percent(profile.dotRate)} | Wkts ${wicketsPer100(
            profile,
          )}/100</span>
          <span>Boundaries ${percent(profile.boundaryRate)} | ${profile.balls.toLocaleString()} balls</span>
          <small>${escapeHtml(profile.behaviorSummary || profile.label)}</small>
        </article>
      `,
    )
    .join("");

  elements.venueDetail.innerHTML = `
    <h3>How host pitches behave</h3>
    <p>
      This model uses ${totalMatches} men's ODIs at CWC host-country venues from
      ${formatDate(SOURCE_DATA.metadata.hostConditionStart)} onward. It combines run rate, dot-ball
      pressure, wicket rate, boundary rate, innings phase, bowler type, bowling arm, and dismissal
      mode. It is still a scorecard-based conditions proxy, not ball-tracking data.
    </p>
    <div class="pitch-behavior-grid">
      ${pitchBehaviors.map(renderPitchBehaviorCard).join("")}
    </div>
    <p class="helper-text">
      ${playerVenues.length
        ? `${escapeHtml(player.name)} has direct samples at: ${playerVenues
            .slice(0, 4)
            .map((venue) => `${escapeHtml(venue.key)} (${venue.balls} balls)`)
            .join(", ")}.`
        : `${escapeHtml(player.name)} has no direct venue-level host sample in this data.`}
    </p>
  `;
}

function renderSignals(player) {
  const signals = (activeFormatView(player).signals || []).slice(0, 4);
  if (!signals.length) {
    elements.signals.innerHTML =
      '<p class="empty-message">No weakness signal has enough balls yet.</p>';
    return;
  }

  elements.signals.innerHTML = signals
    .map(
      (signal) => `
        <article class="signal">
          <p class="signal-type">${escapeHtml(signal.type)}</p>
          <div class="signal-top">
            <h3>${escapeHtml(signal.key)}</h3>
            <span class="signal-score">${Math.round(signal.score * 100)}</span>
          </div>
          <p>${signal.dismissals} outs, ${percent(signal.dotRate)} dots, SR ${oneDecimal(
            signal.strikeRate,
          )} across ${ballCount(signal.balls)}. ${confidenceLabel(signal.balls)}.</p>
        </article>
      `,
    )
    .join("");
}

function renderDismissals(player) {
  const groups = activeFormatView(player).dismissals || [];
  const total = groups.reduce((sum, group) => sum + group.dismissals, 0);
  if (!groups.length) {
    elements.dismissalBreakdown.innerHTML =
      '<p class="empty-message">No dismissals recorded for this player in the all-format window.</p>';
    return;
  }

  elements.dismissalBreakdown.innerHTML = groups
    .map(
      (group) => `
        <div class="breakdown-row">
          <strong>${escapeHtml(group.key)}</strong>
          <small>${group.dismissals} ${group.dismissals === 1 ? "out" : "outs"}</small>
          <div class="track"><span class="high" style="width: ${
            total ? (group.dismissals / total) * 100 : 0
          }%"></span></div>
        </div>
      `,
    )
    .join("");
}

function renderPhaseBreakdown(player) {
  const phases = activeFormatView(player).stages || [];
  if (!phases.length) {
    elements.phaseBreakdown.innerHTML = '<p class="empty-message">No phase split is available.</p>';
    return;
  }

  elements.phaseBreakdown.innerHTML = phases
    .map(
      (phase) => `
        <div class="breakdown-row">
          <strong>${escapeHtml(phase.key)}</strong>
          <small>${phase.runs} runs | ${phase.balls} balls | SR ${oneDecimal(
            phase.strikeRate,
          )} | ${phase.dismissals} outs</small>
          <div class="track"><span class="${phase.risk}" style="width: ${Math.max(
            4,
            phase.score * 100,
          )}%"></span></div>
        </div>
      `,
    )
    .join("");
}

function dismissalProbabilityModel(player) {
  const formatView = activeFormatView(player);
  const summary = formatView.summary || player.allFormat || player.recent;
  const troubleStyle = formatView.bowlingStyles?.find((group) => !group.key.includes("Unknown"));
  const baseRate = summary.balls ? summary.dismissals / summary.balls : 0;
  const styleRate = troubleStyle?.balls ? troubleStyle.dismissals / troubleStyle.balls : 0;

  return {
    formatLabel: formatView.label,
    baseRate,
    nextOver: probabilityFromRate(baseRate, 6),
    nextSpell: probabilityFromRate(baseRate, 18),
    nextThirty: probabilityFromRate(baseRate, 30),
    troubleStyle,
    troubleSpell: probabilityFromRate(styleRate, 18),
    evidence: confidenceLabel(summary.balls),
  };
}

function renderDismissalProbability(player) {
  const model = dismissalProbabilityModel(player);
  const troubleText = model.troubleStyle
    ? `${model.troubleStyle.key}: ${probabilityText(model.troubleSpell)} in an 18-ball spell`
    : "No known bowler-style sample yet";

  elements.dismissalProbability.innerHTML = `
    <div class="probability-grid">
      <article class="probability-card">
        <span>Next over</span>
        <strong>${probabilityText(model.nextOver)}</strong>
        <small>${escapeHtml(model.formatLabel)} baseline</small>
      </article>
      <article class="probability-card">
        <span>18-ball spell</span>
        <strong>${probabilityText(model.nextSpell)}</strong>
        <small>${escapeHtml(model.evidence)}</small>
      </article>
      <article class="probability-card">
        <span>30-ball stay</span>
        <strong>${probabilityText(model.nextThirty)}</strong>
        <small>${dismissalsPer100({ dismissalRate: model.baseRate })} outs per 100 balls</small>
      </article>
    </div>
    <p class="helper-text">
      Trouble matchup estimate: ${escapeHtml(troubleText)}. This is a probability model from recorded
      dismissal rate and sample size, not a guarantee.
    </p>
  `;
}

function winImpactModel(player) {
  const teamPlayers = SOURCE_DATA.players.filter(
    (candidate) => candidate.team === player.team && candidate.projectionTier === "Core squad candidate",
  );
  const playerImpact = playerReadinessScore(player);
  const teamAverage = teamPlayers.length
    ? teamPlayers.reduce((sum, candidate) => sum + playerReadinessScore(candidate), 0) / teamPlayers.length
    : playerImpact;
  const hostBoost = player.conditionFit?.score === null || player.conditionFit?.score === undefined
    ? 0
    : (player.conditionFit.score - 50) * 0.12;
  const teamMetaRecord = teamMeta(player.team);
  const qualifierBoost = teamMetaRecord.qualifierStatus?.includes("Automatic") ? 3 : 0;
  const winReadiness = Math.round(clamp(teamAverage * 0.55 + playerImpact * 0.35 + hostBoost + qualifierBoost, 5, 95));
  const chaseStability = Math.round(
    clamp(55 + (0.48 - player.recent.dotRate) * 55 - player.recent.dismissalRate * 430, 5, 95),
  );
  const battingFirstUpside = Math.round(
    clamp(48 + (player.recent.strikeRate - 82) * 0.32 + boundaryRate(player.recent) * 120, 5, 95),
  );

  return {
    playerImpact,
    winReadiness,
    chaseStability,
    battingFirstUpside,
    note:
      "This is a role-impact probability from batting form, host fit and team pool strength. It is not live match win probability.",
  };
}

function renderWinProbability(player) {
  const model = winImpactModel(player);
  elements.winProbability.innerHTML = `
    <div class="win-grid">
      <article>
        <span>Team win-readiness</span>
        <strong>${model.winReadiness}%</strong>
        <small>${escapeHtml(player.team)} projected pool</small>
      </article>
      <article>
        <span>${escapeHtml(player.name)} impact</span>
        <strong>${model.playerImpact}%</strong>
        <small>Role value in CWC conditions</small>
      </article>
      <article>
        <span>Chase stability</span>
        <strong>${model.chaseStability}%</strong>
        <small>Dot control + wicket risk</small>
      </article>
      <article>
        <span>Bat-first upside</span>
        <strong>${model.battingFirstUpside}%</strong>
        <small>SR + boundary rate</small>
      </article>
    </div>
    <p class="helper-text">${escapeHtml(model.note)}</p>
  `;
}

function generatedReportText(player) {
  const formatView = activeFormatView(player);
  const summary = formatView.summary || player.allFormat || player.recent;
  const topSignal = formatView.signals?.[0];
  const troubleStyle = formatView.bowlingStyles?.find((group) => !group.key.includes("Unknown"));
  const dismissal = formatView.dismissals?.[0];
  const pitch =
    state.hostCountry !== ALL_HOSTS
      ? (SOURCE_DATA.pitchBehaviors || []).find((profile) => profile.country === state.hostCountry)
      : (SOURCE_DATA.pitchBehaviors || []).find((profile) => profile.country === player.team) ||
        (SOURCE_DATA.pitchBehaviors || [])[0];

  const lines = [
    `${player.name} profiles as a ${player.role.toLowerCase()} for ${player.team}, with ${player.recent.runs} recent ODI runs at SR ${oneDecimal(
      player.recent.strikeRate,
    )}.`,
    `${formatView.label} evidence shows ${summary.runs} runs from ${summary.balls} balls, ${percent(
      summary.dotRate,
    )} dots and ${summary.dismissals} dismissals.`,
  ];

  if (troubleStyle) {
    lines.push(
      `Main bowling concern: ${troubleStyle.key}, where the record is ${troubleStyle.dismissals} outs, ${percent(
        troubleStyle.dotRate,
      )} dots and SR ${oneDecimal(troubleStyle.strikeRate)}.`,
    );
  }
  if (topSignal) {
    lines.push(
      `Highest pressure signal: ${topSignal.type.toLowerCase()} ${topSignal.key}, score ${Math.round(
        topSignal.score * 100,
      )}.`,
    );
  }
  if (dismissal) lines.push(`Most common dismissal mode in this view: ${dismissal.key}.`);
  if (pitch) lines.push(`Host pitch read: ${pitch.behaviorSummary}`);
  lines.push("Generated locally from the dataset; no external AI service or hidden data is used.");
  return lines;
}

function renderGeneratedReport(player) {
  elements.generatedReport.innerHTML = `
    <p class="report-kicker">AI-style report generated from real scorecard aggregates</p>
    ${generatedReportText(player).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
  `;
}

function comparisonRows(player, opponent) {
  const leftView = activeFormatView(player);
  const rightView = activeFormatView(opponent);
  const leftSummary = leftView.summary || player.allFormat || player.recent;
  const rightSummary = rightView.summary || opponent.allFormat || opponent.recent;
  const leftTrouble = leftView.bowlingStyles?.find((group) => !group.key.includes("Unknown"));
  const rightTrouble = rightView.bowlingStyles?.find((group) => !group.key.includes("Unknown"));

  return [
    ["Recent ODI runs", player.recent.runs, opponent.recent.runs],
    ["Recent ODI SR", oneDecimal(player.recent.strikeRate), oneDecimal(opponent.recent.strikeRate)],
    [`${leftView.label} balls`, leftSummary.balls, rightSummary.balls],
    ["Dot rate", percent(leftSummary.dotRate), percent(rightSummary.dotRate)],
    ["Dismissals / 100", dismissalsPer100(leftSummary), dismissalsPer100(rightSummary)],
    ["Host fit", fitScoreText(player.conditionFit), fitScoreText(opponent.conditionFit)],
    ["Win impact", `${playerReadinessScore(player)}%`, `${playerReadinessScore(opponent)}%`],
    ["Trouble type", leftTrouble?.key || "Building", rightTrouble?.key || "Building"],
  ];
}

function renderPlayerComparison(player) {
  const opponent = comparePlayer();
  if (!opponent) {
    elements.playerComparison.innerHTML = '<p class="empty-message">Choose another player to compare.</p>';
    return;
  }

  const leftScore = playerReadinessScore(player);
  const rightScore = playerReadinessScore(opponent);
  const verdict =
    leftScore === rightScore
      ? "Even profile on current model"
      : leftScore > rightScore
        ? `${player.name} has the stronger current CWC role-impact model`
        : `${opponent.name} has the stronger current CWC role-impact model`;

  elements.playerComparison.innerHTML = `
    <div class="comparison-head">
      <div><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.team)}</span></div>
      <div><strong>${escapeHtml(opponent.name)}</strong><span>${escapeHtml(opponent.team)}</span></div>
    </div>
    <div class="comparison-verdict">${escapeHtml(verdict)}</div>
    <div class="comparison-table">
      ${comparisonRows(player, opponent)
        .map(
          ([label, left, right]) => `
            <div class="comparison-row">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(left)}</strong>
              <strong>${escapeHtml(right)}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function heatLevel(value, max) {
  if (!max) return 0;
  const ratio = value / max;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

function shotHeatmapZones(player) {
  const formatView = activeFormatView(player);
  const stages = (formatView.stages || []).map((group) => ({ ...group, type: "Phase" }));
  const styles = (formatView.bowlingStyles || [])
    .filter((group) => !group.key.includes("Unknown"))
    .map((group) => ({ ...group, type: "Bowler style" }));
  return [...stages, ...styles].sort((left, right) => right.runs - left.runs).slice(0, 10);
}

function renderShotHeatmap(player) {
  const zones = shotHeatmapZones(player);
  if (!zones.length) {
    elements.shotHeatmap.innerHTML = '<p class="empty-message">No scoring zones are available yet.</p>';
    return;
  }

  const maxRuns = Math.max(...zones.map((zone) => zone.runs));
  elements.shotHeatmap.innerHTML = `
    <div class="heatmap-grid">
      ${zones
        .map(
          (zone) => `
            <article class="heat-tile heat-${heatLevel(zone.runs, maxRuns)}">
              <span>${escapeHtml(zone.type)}</span>
              <strong>${escapeHtml(zone.key)}</strong>
              <small>${zone.runs} runs | SR ${oneDecimal(zone.strikeRate)} | ${percent(
                zone.dotRate,
              )} dots | ${zone.dismissals} outs</small>
            </article>
          `,
        )
        .join("")}
    </div>
    <p class="helper-text">
      Cricsheet does not provide shot direction, wagon-wheel coordinates or bat-contact location.
      This is a scorecard heatmap proxy showing where runs cluster by phase and bowler type.
    </p>
  `;
}

function renderEvidenceSummary(player) {
  const fit = player.conditionFit;
  const formatView = activeFormatView(player);
  const strongest = formatView.signals?.[0];
  const formatSummary = formatView.summary || player.allFormat || player.recent;
  elements.planConfidence.textContent = confidenceLabel(formatSummary.balls);

  const hostSentence =
    player.host.balls >= 36
      ? `${player.name}'s host-country sample is ${player.host.runs} runs from ${player.host.balls} balls at SR ${oneDecimal(
          player.host.strikeRate,
        )}.`
      : `${player.name} has only ${player.host.balls} recorded host-country balls, so the pitch read is still mostly projection.`;

  const signalSentence = strongest
    ? `Biggest caution: ${strongest.type.toLowerCase()} "${strongest.key}" has produced ${percent(
        strongest.dotRate,
      )} dots, ${strongest.dismissals} outs and SR ${oneDecimal(strongest.strikeRate)}.`
    : "No individual weakness signal has enough sample yet.";

  elements.plan.innerHTML = `
    <p>
      <strong>${escapeHtml(player.name)}</strong> is tagged as a ${escapeHtml(
        player.role,
      )} for ${escapeHtml(player.team)} and currently sits in the ${escapeHtml(
        player.projectionTier.toLowerCase(),
      )} pool.
    </p>
    <p>${escapeHtml(hostSentence)}</p>
    <p>${escapeHtml(formatView.conclusion?.styleText || "")}</p>
    <p>${escapeHtml(fit?.label || "No fit label")}: ${escapeHtml(fit?.note || "")}</p>
    <p>${escapeHtml(signalSentence)}</p>
    <p class="helper-text">
      This is a realistic player-pool projection from recent ODI scorecards, while the selected
      weakness view uses ${escapeHtml(formatView.label)} outcomes from ${formatDate(SOURCE_DATA.metadata.allFormatStart)} onward.
      True line and length is not available in the Cricsheet source.
    </p>
  `;
}

function render() {
  refreshFilters();
  renderDatasetNote();
  renderFormatButtons();
  const player = currentPlayer();

  if (!player) {
    elements.metrics.innerHTML = '<p class="empty-message">No ODI players are available.</p>';
    return;
  }

  state.playerId = player.id;
  renderProfile(player);
  renderMetrics(player);
  renderRoster();
  renderPressureSignals(player);
  renderBowlingStyleTrouble(player);
  renderHostMap(player);
  renderVenueProfiles(player);
  renderSignals(player);
  renderDismissals(player);
  renderPhaseBreakdown(player);
  renderDismissalProbability(player);
  renderWinProbability(player);
  renderGeneratedReport(player);
  renderPlayerComparison(player);
  renderShotHeatmap(player);
  renderEvidenceSummary(player);
}

function init() {
  elements.team.addEventListener("change", (event) => {
    state.team = event.target.value;
    state.playerId = "";
    state.comparePlayerId = "";
    state.selectedSignal = null;
    state.selectedHostCountry = null;
    state.selectedBowlingStyle = null;
    render();
  });

  elements.player.addEventListener("change", (event) => {
    state.playerId = event.target.value;
    state.comparePlayerId = "";
    state.selectedSignal = null;
    state.selectedHostCountry = null;
    state.selectedBowlingStyle = null;
    render();
  });

  elements.comparePlayer.addEventListener("change", (event) => {
    state.comparePlayerId = event.target.value;
    render();
  });

  elements.tier.addEventListener("change", (event) => {
    state.tier = event.target.value;
    state.playerId = "";
    state.comparePlayerId = "";
    state.selectedSignal = null;
    state.selectedHostCountry = null;
    state.selectedBowlingStyle = null;
    render();
  });

  elements.host.addEventListener("change", (event) => {
    state.hostCountry = event.target.value;
    state.selectedHostCountry = null;
    render();
  });

  render();
}

init();

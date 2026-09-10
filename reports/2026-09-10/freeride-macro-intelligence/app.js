(() => {
  "use strict";

  const EVENTS = [
    { id: "us-ism-mfg", date: "2026-09-01", time: "22:00", country: "US", impact: "MEDIUM", status: "released", name: "ISM Manufacturing", period: "August", actual: "49.4", consensus: "49.0", previous: "48.0", surprise: "+0.4", unit: "index", source: "ISM", sample: 31, theme: "Growth", lead: "The headline cleared consensus, but the signal remained consistent with a shallow manufacturing contraction rather than a clean growth re-acceleration." },
    { id: "us-cpi-aug", date: "2026-09-03", time: "20:30", country: "US", impact: "HIGH", status: "released", name: "Consumer Price Index", period: "August", actual: "3.1%", consensus: "3.0%", previous: "2.9%", surprise: "+0.1 pct", unit: "YoY", source: "Bureau of Labor Statistics", sample: 42, theme: "Inflation", lead: "The print was modestly above consensus, but the more informative signal was its composition: shelter and core services ran firmer than the median house assumption." },
    { id: "us-payrolls-aug", date: "2026-09-04", time: "20:30", country: "US", impact: "HIGH", status: "released", name: "Nonfarm Payrolls", period: "August", actual: "156k", consensus: "145k", previous: "128k", surprise: "+11k", unit: "change", source: "Bureau of Labor Statistics", sample: 39, theme: "Labor", lead: "Hiring exceeded the median forecast, while softer hours worked kept the report from reading as an unambiguously hawkish labor shock." },
    { id: "cn-trade-aug", date: "2026-09-07", time: "11:00", country: "CN", impact: "MEDIUM", status: "released", name: "Trade Balance", period: "August", actual: "$96.2bn", consensus: "$92.0bn", previous: "$89.7bn", surprise: "+$4.2bn", unit: "USD", source: "General Administration of Customs", sample: 28, theme: "Trade", lead: "The wider surplus reflected resilient exports more than domestic-demand strength, leaving the growth read-through uneven across assets." },
    { id: "cn-cpi-aug", date: "2026-09-09", time: "09:30", country: "CN", impact: "HIGH", status: "released", name: "Consumer Price Index", period: "August", actual: "0.2%", consensus: "0.3%", previous: "0.4%", surprise: "-0.1 pct", unit: "YoY", source: "National Bureau of Statistics", sample: 35, theme: "Inflation", lead: "Inflation undershot expectations as food-price support faded. The mix points to limited household pricing power rather than a renewed deflation shock." },
    { id: "us-ppi-aug", date: "2026-09-10", time: "20:30", country: "US", impact: "MEDIUM", status: "upcoming", name: "Producer Price Index", period: "August", actual: "?", consensus: "2.7%", previous: "2.6%", surprise: "Pending", unit: "YoY", source: "Bureau of Labor Statistics", sample: 37, theme: "Inflation", lead: "The key question is whether pipeline services prices validate the CPI composition. Goods alone would be a weaker policy signal." },
    { id: "us-retail-aug", date: "2026-09-15", time: "20:30", country: "US", impact: "MEDIUM", status: "upcoming", name: "Retail Sales", period: "August", actual: "?", consensus: "0.3%", previous: "0.5%", surprise: "Pending", unit: "MoM", source: "US Census Bureau", sample: 34, theme: "Growth", lead: "Control-group spending is the cleaner signal for consumption momentum; autos and gasoline may make the headline unusually noisy." },
    { id: "us-fomc-sep", date: "2026-09-17", time: "02:00", country: "US", impact: "HIGH", status: "upcoming", name: "FOMC Rate Decision", period: "September", actual: "?", consensus: "4.75%", previous: "4.75%", surprise: "Pending", unit: "upper bound", source: "Federal Reserve", sample: 24, theme: "Policy", lead: "A hold is widely expected. The distribution of 2027 dots and the Chair's reaction function should carry more information than the decision itself." },
    { id: "cn-lpr-sep", date: "2026-09-21", time: "09:15", country: "CN", impact: "HIGH", status: "upcoming", name: "Loan Prime Rate", period: "September", actual: "?", consensus: "3.00%", previous: "3.00%", surprise: "Pending", unit: "1Y", source: "National Interbank Funding Center", sample: 22, theme: "Policy", lead: "The base case is unchanged LPR settings; any asymmetric five-year cut would be read primarily through housing support." },
    { id: "us-pce-aug", date: "2026-09-25", time: "20:30", country: "US", impact: "HIGH", status: "upcoming", name: "Core PCE Price Index", period: "August", actual: "?", consensus: "2.9%", previous: "2.9%", surprise: "Pending", unit: "YoY", source: "Bureau of Economic Analysis", sample: 40, theme: "Inflation", lead: "Known CPI and PPI components narrow the forecast range, but portfolio risk remains concentrated in core services and revisions." },
    { id: "cn-pmi-sep", date: "2026-09-30", time: "09:30", country: "CN", impact: "MEDIUM", status: "tentative", name: "Official Manufacturing PMI", period: "September", actual: "?", consensus: "49.8", previous: "49.6", surprise: "Pending", unit: "index", source: "National Bureau of Statistics", sample: 30, theme: "Growth", lead: "A move toward 50 would improve the sequential signal, though new orders and employment must confirm the headline." }
  ];

  const NEWS = {
    Inflation: [
      ["08:30", "Official", "Release", "Headline and core inflation data published; first-vintage values locked."],
      ["08:34", "Wire", "Market", "Front-end yields lead the immediate rates move as traders reprice the policy path."],
      ["08:42", "Northstar", "Flash", "Services composition supports the preview thesis; conviction raised."],
      ["08:47", "Harbor", "Flash", "Headline miss acknowledged, but analysts caution against extrapolating one print."]
    ],
    Labor: [
      ["08:30", "Official", "Release", "Payrolls, unemployment and earnings details published."],
      ["08:35", "Wire", "Market", "Rates sell off initially; equity reaction is muted by softer hours worked."],
      ["08:44", "Northstar", "Flash", "Hiring breadth improved, but the household survey remains a cross-check."],
      ["09:05", "Harbor", "Comment", "The report does not close the door on easing if inflation continues to cool."]
    ],
    Policy: [
      ["T-2d", "Northstar", "Preview", "Base case unchanged; focus is on forward guidance and vote dispersion."],
      ["T-1d", "Harbor", "Preview", "Risk is a more restrictive projected path rather than an unexpected decision."],
      ["T-4h", "Wire", "Positioning", "Rates options imply elevated event volatility into the announcement."],
      ["T+0", "Official", "Scheduled", "Statement, projections and press conference will be linked here."]
    ],
    default: [
      ["T+0", "Official", "Release", "Primary-source data captured with timestamp and first-vintage status."],
      ["T+3m", "Wire", "Market", "Initial cross-asset reaction normalized to the event timestamp."],
      ["T+12m", "Northstar", "Flash", "Analyst note maps the surprise to the house macro view."],
      ["T+20m", "Harbor", "Flash", "Alternative interpretation highlights the weakest component."]
    ]
  };

  const STUDIES = {
    upside: {
      "30m": { n: 42, hit: "67%", gap: "0.08?", stability: "Mixed", assets: [["UST 2Y", "yield", 5.2, 76], ["USD index", "return", 0.25, 67], ["S&P futures", "return", -0.40, 64], ["Gold", "return", -0.31, 60]], bars: [18,26,34,47,62,78,92,80,63,49,34,22] },
      "1d": { n: 41, hit: "63%", gap: "0.12?", stability: "Mixed", assets: [["UST 2Y", "yield", 7.8, 71], ["USD index", "return", 0.36, 63], ["S&P futures", "return", -0.58, 61], ["Gold", "return", -0.44, 58]], bars: [14,21,29,43,57,71,87,93,71,50,31,18] },
      "5d": { n: 39, hit: "56%", gap: "0.21?", stability: "Low", assets: [["UST 2Y", "yield", 9.4, 59], ["USD index", "return", 0.42, 56], ["S&P futures", "return", -0.22, 52], ["Gold", "return", -0.61, 55]], bars: [23,29,38,55,69,84,91,77,65,53,41,30] }
    },
    inline: {
      "30m": { n: 51, hit: "51%", gap: "0.03?", stability: "Stable", assets: [["UST 2Y", "yield", 0.4, 51], ["USD index", "return", 0.02, 49], ["S&P futures", "return", 0.08, 53], ["Gold", "return", 0.04, 50]], bars: [11,18,31,49,72,94,90,69,47,29,17,9] },
      "1d": { n: 50, hit: "50%", gap: "0.05?", stability: "Stable", assets: [["UST 2Y", "yield", -0.2, 50], ["USD index", "return", -0.01, 48], ["S&P futures", "return", 0.12, 54], ["Gold", "return", 0.06, 51]], bars: [9,16,27,44,70,92,95,73,50,30,18,10] },
      "5d": { n: 47, hit: "49%", gap: "0.09?", stability: "Mixed", assets: [["UST 2Y", "yield", -1.1, 48], ["USD index", "return", -0.05, 46], ["S&P futures", "return", 0.31, 52], ["Gold", "return", 0.18, 50]], bars: [13,19,28,42,61,83,91,80,59,41,27,16] }
    },
    downside: {
      "30m": { n: 38, hit: "66%", gap: "0.10?", stability: "Mixed", assets: [["UST 2Y", "yield", -4.8, 74], ["USD index", "return", -0.22, 65], ["S&P futures", "return", 0.46, 63], ["Gold", "return", 0.29, 59]], bars: [20,29,42,58,76,91,82,65,48,33,22,14] },
      "1d": { n: 37, hit: "62%", gap: "0.14?", stability: "Mixed", assets: [["UST 2Y", "yield", -7.1, 69], ["USD index", "return", -0.31, 62], ["S&P futures", "return", 0.63, 60], ["Gold", "return", 0.41, 57]], bars: [17,25,37,54,74,89,86,67,49,34,23,15] },
      "5d": { n: 35, hit: "55%", gap: "0.24?", stability: "Low", assets: [["UST 2Y", "yield", -8.6, 58], ["USD index", "return", -0.38, 55], ["S&P futures", "return", 0.35, 51], ["Gold", "return", 0.52, 54]], bars: [26,34,45,61,78,90,83,70,58,46,35,24] }
    }
  };

  const SCENARIOS = {
    upside: { label: "CPI upside", shocks: { "US equities": -0.40, "UST 2Y duration": -0.18, "USD cash": 0.05, "Gold": -0.31, "China equities": -0.16, "Credit": -0.12 } },
    "large-upside": { label: "Large CPI upside", shocks: { "US equities": -0.88, "UST 2Y duration": -0.44, "USD cash": 0.12, "Gold": -0.67, "China equities": -0.31, "Credit": -0.26 } },
    downside: { label: "CPI downside", shocks: { "US equities": 0.46, "UST 2Y duration": 0.21, "USD cash": -0.05, "Gold": 0.29, "China equities": 0.18, "Credit": 0.15 } }
  };

  let state = { year: 2026, month: 8, country: "ALL", impact: "ALL", currentEvent: EVENTS[1], bucket: "upside", horizon: "30m", watched: false };
  let holdings = [
    { asset: "US equities", weight: 55, beta: 1.00 },
    { asset: "UST 2Y duration", weight: 20, beta: 0.75 },
    { asset: "USD cash", weight: 15, beta: 0.30 },
    { asset: "Gold", weight: 10, beta: 0.50 }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

  function createIcons() {
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }

  function filteredEvents() {
    return EVENTS.filter(event =>
      (state.country === "ALL" || event.country === state.country) &&
      (state.impact === "ALL" || event.impact === state.impact)
    );
  }

  function renderCalendar() {
    const monthStart = new Date(state.year, state.month, 1);
    const mondayOffset = (monthStart.getDay() + 6) % 7;
    const gridStart = new Date(state.year, state.month, 1 - mondayOffset);
    const monthName = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(monthStart);
    $("#monthLabel").textContent = monthName;
    const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(day => `<div class="weekday">${day}</div>`).join("");
    const visible = filteredEvents();
    let days = "";
    for (let i = 0; i < 42; i += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const dayEvents = visible.filter(event => event.date === iso);
      const classes = ["calendar-day", date.getMonth() !== state.month ? "outside-month" : "", iso === "2026-09-09" ? "is-today" : ""].filter(Boolean).join(" ");
      days += `<div class="${classes}"><span class="day-number">${date.getDate()}</span><div class="day-events">${dayEvents.map(eventButton).join("")}</div></div>`;
    }
    $("#calendarGrid").innerHTML = weekdays + days;
    renderAgenda(visible);
  }

  function eventButton(event) {
    return `<button type="button" class="calendar-event ${event.status}" data-event-open="${event.id}" title="${esc(event.name)}"><span class="event-time">${event.time}</span><span class="event-name">${esc(event.name)}</span><i class="impact-dot ${event.impact.toLowerCase()}"></i></button>`;
  }

  function renderAgenda(events) {
    const inMonth = events.filter(event => {
      const date = new Date(`${event.date}T00:00:00`);
      return date.getFullYear() === state.year && date.getMonth() === state.month;
    });
    const groups = Object.groupBy ? Object.groupBy(inMonth, event => event.date) : inMonth.reduce((acc, event) => ((acc[event.date] ||= []).push(event), acc), {});
    $("#mobileAgenda").innerHTML = Object.entries(groups).map(([date, dayEvents]) => {
      const formatted = new Intl.DateTimeFormat("en", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${date}T00:00:00`));
      return `<section class="agenda-day"><div class="agenda-date"><strong>${formatted}</strong><span>${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}</span></div>${dayEvents.map(event => `<button type="button" class="agenda-event ${event.status}" data-event-open="${event.id}"><span>${event.time}</span><span><strong>${esc(event.name)}</strong><small>${event.country} ? ${event.impact.toLowerCase()} impact</small></span><span class="agenda-surprise">${esc(event.surprise)}</span></button>`).join("")}</section>`;
    }).join("") || `<section class="agenda-day"><div class="agenda-date"><strong>No matching events</strong><span>Adjust filters</span></div></section>`;
  }

  function showDetail(eventId, tab = "overview") {
    const event = EVENTS.find(item => item.id === eventId) || EVENTS[1];
    state.currentEvent = event;
    $("#calendarView").hidden = true;
    $("#detailView").hidden = false;
    $("#eventCountry").textContent = event.country;
    $("#eventCountry").className = `country-badge ${event.country.toLowerCase()}`;
    $("#eventStatus").textContent = event.status[0].toUpperCase() + event.status.slice(1);
    $("#eventStatus").className = `status-badge ${event.status}`;
    $("#eventImpact").innerHTML = `<i data-lucide="zap"></i> ${event.impact[0] + event.impact.slice(1).toLowerCase()} impact`;
    $("#eventImpact").className = `impact-badge ${event.impact.toLowerCase()}`;
    $("#eventTitle").textContent = `${event.country} ${event.name} ? ${event.period}`;
    const formatted = new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${event.date}T00:00:00`));
    $("#eventSubtitle").textContent = `${formatted} ? ${event.time} SGT ? ${event.source}`;
    $("#actualValue").textContent = event.actual;
    $("#consensusValue").textContent = event.consensus;
    $("#previousValue").textContent = event.previous;
    $("#surpriseValue").textContent = event.surprise;
    $(".lead-take").textContent = event.lead;
    updateNarrative(event);
    renderNews(event);
    updateStudyLabels(event);
    setTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
    createIcons();
  }

  function updateNarrative(event) {
    const points = $$(".commentary-points > div");
    const released = event.status === "released";
    const copy = released ? [
      ["Read the composition, not only the headline", `${event.theme} details determine whether the surprise is likely to persist beyond the first market window.`],
      ["Street dispersion adds information", `Northstar was closer to the central outcome; Harbor assigned more weight to the principal downside driver.`],
      ["Separate reaction from causation", `The event window controls timing, but simultaneous news, positioning and liquidity can still explain part of the move.`]
    ] : [
      ["Consensus hides the distribution", `The median is ${event.consensus}; house-level drivers reveal where the forecast is fragile.`],
      ["Define the market-relevant miss", `A material surprise must be assessed against both the point estimate and the priced policy or growth path.`],
      ["Pre-register the event window", `Sensitivity scenarios use fixed horizons so the analysis does not select the most favorable post-release move.`]
    ];
    points.forEach((point, index) => {
      $("strong", point).textContent = copy[index][0];
      $("p", point).textContent = copy[index][1];
    });

    const rows = $$(".comparison-table tbody tr");
    if (rows.length >= 3) {
      rows[0].children[1].textContent = event.consensus;
      rows[0].children[3].textContent = `Median ${event.theme.toLowerCase()} view`;
      rows[1].children[1].textContent = event.actual === "?" ? event.consensus : event.actual;
      rows[1].children[3].textContent = `Higher-conviction ${event.theme.toLowerCase()} signal`;
      rows[2].children[1].textContent = event.previous;
      rows[2].children[3].textContent = `More cautious ${event.theme.toLowerCase()} path`;
    }
  }

  function renderNews(event) {
    const items = NEWS[event.theme] || NEWS.default;
    $("#newsTimeline").innerHTML = items.map(([time, source, type, headline], index) => `<article class="news-item"><time>${time}</time><span class="timeline-node ${index === 0 ? "primary" : ""}"></span><div><div class="news-meta"><strong>${esc(source)}</strong><span>${esc(type)}</span></div><p>${esc(headline)}</p></div></article>`).join("");
  }

  function setTab(tab) {
    $$("[data-tab]").forEach(button => button.classList.toggle("is-active", button.dataset.tab === tab));
    $$("[data-panel]").forEach(panel => panel.classList.toggle("is-active", panel.dataset.panel === tab));
    if (tab === "history") renderStudy();
    if (tab === "portfolio") renderHoldings();
    if (!$("#detailView").hidden) history.replaceState(null, "", `#${state.currentEvent.id}/${tab}`);
  }

  function updateStudyLabels(event) {
    const heading = $("#historyTab .event-study-header h2");
    if (heading) heading.textContent = `How assets behaved after comparable ${event.name} surprises`;
    const firstMeta = $("#historyTab .study-meta span");
    if (firstMeta) firstMeta.innerHTML = `<i data-lucide="database"></i> ${event.country} ${esc(event.name)} ? Jan 2016?Aug 2026`;
  }

  function renderStudy() {
    const study = STUDIES[state.bucket][state.horizon];
    $("#sampleMeta").innerHTML = `<i data-lucide="list-filter"></i> n = ${study.n} releases`;
    $("#sampleBadge").textContent = `n=${study.n} ? ${study.n >= 40 ? "usable" : "limited"}`;
    $("#hitRate").textContent = study.hit;
    $("#meanGap").textContent = study.gap;
    $("#regimeStability").textContent = study.stability;
    $("#impactRows").innerHTML = study.assets.map(([asset, kind, value, hit]) => {
      const isYield = kind === "yield";
      const label = `${value > 0 ? "+" : ""}${value.toFixed(isYield ? 1 : 2)}${isYield ? " bp" : "%"}`;
      const center = 50;
      const marker = Math.max(6, Math.min(94, center + value * (isYield ? 4 : 45)));
      const width = Math.min(32, 12 + Math.abs(value) * (isYield ? 1.2 : 25));
      return `<div class="impact-row"><span class="asset-label"><strong>${asset}</strong><small>${kind}</small></span><span class="impact-value ${value < 0 ? "negative" : "positive"}">${label}</span><span class="range-track"><i class="range-band" style="left:${Math.max(2, marker - width / 2)}%;width:${width}%"></i><i class="range-marker" style="left:${marker}%"></i></span><span class="hit-rate">${hit}% hit</span></div>`;
    }).join("");
    $("#distributionChart").innerHTML = study.bars.map((height, index) => `<span class="${index < 6 ? "negative-bar" : ""}" style="height:${height}%" title="Synthetic observation density"></span>`).join("");
    createIcons();
  }

  function renderHoldings() {
    const scenario = SCENARIOS[$("#portfolioScenario").value];
    $("#holdingsBody").innerHTML = holdings.map((holding, index) => {
      const shock = scenario.shocks[holding.asset] ?? 0;
      const contribution = holding.weight * holding.beta * shock;
      return `<tr data-holding="${index}"><td><select data-field="asset">${Object.keys(scenario.shocks).map(asset => `<option ${asset === holding.asset ? "selected" : ""}>${asset}</option>`).join("")}</select></td><td><input class="numeric-input" data-field="weight" type="number" min="0" max="100" step="1" value="${holding.weight}" aria-label="Weight"><span class="input-suffix">%</span></td><td><input class="numeric-input" data-field="beta" type="number" min="-3" max="3" step="0.05" value="${holding.beta.toFixed(2)}" aria-label="Event beta"></td><td>${shock > 0 ? "+" : ""}${shock.toFixed(2)}%</td><td class="${contribution < 0 ? "negative" : "positive"}">${contribution > 0 ? "+" : ""}${contribution.toFixed(1)} bp</td><td><button class="remove-holding" type="button" data-remove-holding="${index}" title="Remove exposure" aria-label="Remove exposure"><i data-lucide="trash-2"></i></button></td></tr>`;
    }).join("");
    calculatePortfolio();
    createIcons();
  }

  function syncHoldingInputs() {
    $$("#holdingsBody tr").forEach((row, index) => {
      holdings[index].asset = $("[data-field='asset']", row).value;
      holdings[index].weight = Number($("[data-field='weight']", row).value) || 0;
      holdings[index].beta = Number($("[data-field='beta']", row).value) || 0;
    });
  }

  function calculatePortfolio() {
    syncHoldingInputs();
    const scenario = SCENARIOS[$("#portfolioScenario").value];
    const results = holdings.map(holding => ({ ...holding, contribution: holding.weight * holding.beta * (scenario.shocks[holding.asset] ?? 0) }));
    const totalWeight = holdings.reduce((sum, holding) => sum + holding.weight, 0);
    const total = results.reduce((sum, result) => sum + result.contribution, 0);
    const sorted = [...results].sort((a, b) => a.contribution - b.contribution);
    const detractor = sorted[0] || { asset: "None", contribution: 0 };
    const offset = [...results].sort((a, b) => b.contribution - a.contribution)[0] || { asset: "None", contribution: 0 };
    $("#portfolioImpact").textContent = `${total > 0 ? "+" : ""}${Math.round(total)}`;
    $("#largestDetractor").textContent = `${detractor.asset} ? ${detractor.contribution.toFixed(1)} bp`;
    $("#largestOffset").textContent = `${offset.asset} ? ${offset.contribution > 0 ? "+" : ""}${offset.contribution.toFixed(1)} bp`;
    $("#portfolioRange").textContent = `${Math.round(total * 0.55)} to ${Math.round(total * 1.8)} bp`;
    const magnitude = Math.min(48, Math.abs(total) / 1.3);
    const bar = $("#portfolioImpactBar span");
    const marker = $("#portfolioImpactBar i");
    bar.style.width = `${magnitude}%`;
    bar.style.right = total <= 0 ? "50%" : "auto";
    bar.style.left = total > 0 ? "50%" : "auto";
    marker.style.right = total <= 0 ? `calc(50% + ${magnitude}% - 2px)` : "auto";
    marker.style.left = total > 0 ? `calc(50% + ${magnitude}% - 2px)` : "auto";
    const weightCheck = $("#weightCheck");
    weightCheck.classList.toggle("invalid", Math.abs(totalWeight - 100) > 0.01);
    weightCheck.innerHTML = `<i data-lucide="${Math.abs(totalWeight - 100) <= 0.01 ? "circle-check" : "circle-alert"}"></i> Weights total ${totalWeight.toFixed(0)}%`;
    $("#portfolioComment").textContent = `${scenario.label}: ${detractor.asset} is the largest modeled detractor. This result is linear and excludes covariance, liquidity, convexity and second-order macro effects.`;
    createIcons();
  }

  let toastTimer;
  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("is-visible"), 2400);
  }

  function dialog(title, body) {
    $("#dialogTitle").textContent = title;
    $("#dialogBody").innerHTML = body;
    $("#infoDialog").showModal();
  }

  document.addEventListener("click", event => {
    const open = event.target.closest("[data-event-open]");
    if (open) return showDetail(open.dataset.eventOpen);
    const tab = event.target.closest("[data-tab]");
    if (tab) return setTab(tab.dataset.tab);
    const targetTab = event.target.closest("[data-tab-target]");
    if (targetTab) return setTab(targetTab.dataset.tabTarget);
    const country = event.target.closest("[data-country]");
    if (country) {
      state.country = country.dataset.country;
      $$('[data-country]').forEach(button => button.classList.toggle("is-selected", button === country));
      renderCalendar();
      return;
    }
    const bucket = event.target.closest("[data-surprise-bucket]");
    if (bucket) {
      state.bucket = bucket.dataset.surpriseBucket;
      $$('[data-surprise-bucket]').forEach(button => button.classList.toggle("is-selected", button === bucket));
      return renderStudy();
    }
    const horizon = event.target.closest("[data-horizon]");
    if (horizon) {
      state.horizon = horizon.dataset.horizon;
      $$('[data-horizon]').forEach(button => button.classList.toggle("is-selected", button === horizon));
      return renderStudy();
    }
    const remove = event.target.closest("[data-remove-holding]");
    if (remove) {
      syncHoldingInputs();
      holdings.splice(Number(remove.dataset.removeHolding), 1);
      return renderHoldings();
    }
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      const route = nav.dataset.nav;
      if (route === "calendar") {
        $("#detailView").hidden = true;
        $("#calendarView").hidden = false;
      } else if (route === "news") showDetail("us-cpi-aug", "overview");
      else if (route === "impact") showDetail("us-cpi-aug", "history");
      else if (route === "portfolio") showDetail("us-cpi-aug", "portfolio");
      $$("[data-nav]").forEach(button => button.classList.toggle("is-active", button === nav));
      return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (["home", "back-to-calendar"].includes(action)) {
      $("#detailView").hidden = true;
      $("#calendarView").hidden = false;
      $$("[data-nav]").forEach(button => button.classList.toggle("is-active", button.dataset.nav === "calendar"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (action === "previous-month" || action === "next-month") {
      state.month += action === "previous-month" ? -1 : 1;
      if (state.month < 0) { state.month = 11; state.year -= 1; }
      if (state.month > 11) { state.month = 0; state.year += 1; }
      renderCalendar();
    } else if (action === "today") {
      state.year = 2026; state.month = 8; renderCalendar();
    } else if (action === "toggle-watch") {
      state.watched = !state.watched;
      $("#watchButton span").textContent = state.watched ? "Watching" : "Watch event";
      toast(state.watched ? "Event added to watchlist" : "Event removed from watchlist");
    } else if (action === "copy-link") {
      const activeTab = $("[data-tab].is-active")?.dataset.tab || "overview";
      navigator.clipboard?.writeText(`${location.href.split("#")[0]}#${state.currentEvent.id}/${activeTab}`);
      toast("Prototype event link copied");
    } else if (action === "export") toast("Synthetic demo export prepared");
    else if (action === "create-alert") dialog("Create event alert", "<p>Alert rules would combine event time, consensus changes, research updates and portfolio thresholds.</p><p><strong>Prototype only:</strong> no notification is sent.</p>");
    else if (action === "show-sources") dialog("Planned source map", "<p><strong>Calendar and consensus:</strong> licensed point-in-time market data.</p><p><strong>Official releases:</strong> agency primary sources.</p><p><strong>Research:</strong> entitled full-text documents with publication timestamps.</p><p><strong>Market reaction:</strong> point-in-time intraday prices with event-window quality checks.</p>");
    else if (action === "show-method") dialog("Event-study method", "<p>Compare first-release actual with the last eligible point-in-time consensus before release. Include every qualifying observation in the bucket and use fixed 30-minute, one-day and five-day windows.</p><p>Median response, dispersion and regime stability are shown. This is association, not causal evidence or a trading backtest.</p>");
    else if (action === "view-all-news") dialog("News monitor", "<p>The production view would de-duplicate wires, official statements and entitled research; align each item to the event clock; and tag whether it changes facts, forecasts or interpretation.</p>");
    else if (action === "add-holding") {
      syncHoldingInputs(); holdings.push({ asset: "Credit", weight: 0, beta: 1 }); renderHoldings();
    } else if (action === "recalculate") {
      calculatePortfolio(); renderHoldings(); toast("Sensitivity recalculated from current inputs");
    }
  });

  $("#impactFilter").addEventListener("change", event => { state.impact = event.target.value; renderCalendar(); });
  $("#portfolioScenario").addEventListener("change", renderHoldings);
  $("#holdingsBody").addEventListener("change", calculatePortfolio);
  $("#holdingsBody").addEventListener("input", calculatePortfolio);

  renderCalendar();
  renderNews(state.currentEvent);
  renderStudy();
  renderHoldings();
  createIcons();
  const [deepEvent, deepTab = "overview"] = location.hash.slice(1).split("/");
  if (EVENTS.some(event => event.id === deepEvent)) showDetail(deepEvent, ["overview", "institutions", "history", "portfolio"].includes(deepTab) ? deepTab : "overview");
})();

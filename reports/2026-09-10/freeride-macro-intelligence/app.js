(() => {
  "use strict";

  const EVENTS = [
    { id: "us-fomc-jul", date: "2026-07-29", time: "02:00", country: "US", impact: "HIGH", status: "released", name: "FOMC Rate Decision", period: "July", actual: "Hold", consensus: "Hold", previous: "Hold", surprise: "3 hawkish dissents", unit: "decision", source: "Federal Reserve", sample: 24, theme: "Policy", lead: "The committee held rates, as both GS and JPM expected, but three dissents for tightening made committee dispersion the central signal.", researchKey: "us-fomc-jul" },
    { id: "us-payrolls-jul", date: "2026-08-07", time: "20:30", country: "US", impact: "HIGH", status: "released", name: "Nonfarm Payrolls", period: "July", actual: "21k revised", consensus: "80k", previous: "20k", surprise: "Below consensus", unit: "change", source: "Bureau of Labor Statistics", sample: 39, theme: "Labor", lead: "The July report extended the deceleration in hiring and set up an unusually wide forecast distribution for August." },
    { id: "us-cpi-jul", date: "2026-08-12", time: "20:30", country: "US", impact: "HIGH", status: "released", name: "Core CPI", period: "July", actual: "0.22%", consensus: "0.20%", previous: "-0.02%", surprise: "+0.02 pct", unit: "MoM", source: "Bureau of Labor Statistics", sample: 42, theme: "Inflation", lead: "Core CPI rose 0.22% month-on-month, matching JPM and landing 3bp above the GS forecast.", researchKey: "us-cpi-jul" },
    { id: "us-ism-mfg", date: "2026-09-01", time: "22:00", country: "US", impact: "MEDIUM", status: "released", name: "ISM Manufacturing", period: "August", actual: "49.4", consensus: "49.0", previous: "48.0", surprise: "+0.4", unit: "index", source: "ISM", sample: 31, theme: "Growth", lead: "The headline cleared consensus, but the signal remained consistent with a shallow manufacturing contraction rather than a clean growth re-acceleration." },
    { id: "us-payrolls-aug", date: "2026-09-04", time: "20:30", country: "US", impact: "HIGH", status: "released", name: "Nonfarm Payrolls", period: "August", actual: "162k", consensus: "55k", previous: "21k revised", surprise: "+107k", unit: "change", source: "Bureau of Labor Statistics", sample: 39, theme: "Labor", lead: "August payrolls delivered a large upside surprise and forced both GS and JPM to reassess the sector rebound.", researchKey: "us-payrolls-aug" },
    { id: "cn-trade-aug", date: "2026-09-07", time: "11:00", country: "CN", impact: "MEDIUM", status: "released", name: "Trade Balance", period: "August", actual: "$96.2bn", consensus: "$92.0bn", previous: "$89.7bn", surprise: "+$4.2bn", unit: "USD", source: "General Administration of Customs", sample: 28, theme: "Trade", lead: "The wider surplus reflected resilient exports more than domestic-demand strength, leaving the growth read-through uneven across assets." },
    { id: "cn-cpi-aug", date: "2026-09-09", time: "09:30", country: "CN", impact: "HIGH", status: "released", name: "Consumer Price Index", period: "August", actual: "0.2%", consensus: "0.3%", previous: "0.4%", surprise: "-0.1 pct", unit: "YoY", source: "National Bureau of Statistics", sample: 35, theme: "Inflation", lead: "Inflation undershot expectations as food-price support faded. The mix points to limited household pricing power rather than a renewed deflation shock." },
    { id: "us-cpi-aug", date: "2026-09-11", time: "20:30", country: "US", impact: "HIGH", status: "released", name: "Core CPI", period: "August", actual: "0.29%", consensus: "0.20%", previous: "0.22%", surprise: "+0.09 pct", unit: "MoM", source: "Bureau of Labor Statistics", sourceTimestamp: "2026-09-11T08:30:00-04:00", displayTimeZone: "Asia/Hong_Kong", sample: 42, theme: "Inflation", lead: "Core CPI beat consensus, but wireless services contributed about 10bp and travel was also firm; the signal beneath those volatile components was materially softer than the headline.", researchKey: "us-cpi-aug" },
    { id: "us-ppi-aug", date: "2026-09-10", time: "20:30", country: "US", impact: "MEDIUM", status: "upcoming", name: "Producer Price Index", period: "August", actual: "?", consensus: "2.7%", previous: "2.6%", surprise: "Pending", unit: "YoY", source: "Bureau of Labor Statistics", sample: 37, theme: "Inflation", lead: "The key question is whether pipeline services prices validate the CPI composition. Goods alone would be a weaker policy signal." },
    { id: "us-retail-aug", date: "2026-09-15", time: "20:30", country: "US", impact: "MEDIUM", status: "upcoming", name: "Retail Sales", period: "August", actual: "?", consensus: "0.3%", previous: "0.5%", surprise: "Pending", unit: "MoM", source: "US Census Bureau", sample: 34, theme: "Growth", lead: "Control-group spending is the cleaner signal for consumption momentum; autos and gasoline may make the headline unusually noisy." },
    { id: "us-fomc-sep", date: "2026-09-17", time: "02:00", country: "US", impact: "HIGH", status: "upcoming", name: "FOMC Rate Decision", period: "September", actual: "?", consensus: "Hold focus", previous: "Hold", surprise: "Pending", unit: "decision", source: "Federal Reserve", sample: 24, theme: "Policy", lead: "The supplied research points to a data-dependent hold, with disagreement concentrated in the later policy path rather than the September decision.", researchKey: "us-fomc-sep" },
    { id: "cn-lpr-sep", date: "2026-09-21", time: "09:15", country: "CN", impact: "HIGH", status: "upcoming", name: "Loan Prime Rate", period: "September", actual: "?", consensus: "3.00%", previous: "3.00%", surprise: "Pending", unit: "1Y", source: "National Interbank Funding Center", sample: 22, theme: "Policy", lead: "The base case is unchanged LPR settings; any asymmetric five-year cut would be read primarily through housing support." },
    { id: "us-pce-aug", date: "2026-09-25", time: "20:30", country: "US", impact: "HIGH", status: "upcoming", name: "Core PCE Price Index", period: "August", actual: "?", consensus: "2.9%", previous: "2.9%", surprise: "Pending", unit: "YoY", source: "Bureau of Economic Analysis", sample: 40, theme: "Inflation", lead: "Known CPI and PPI components narrow the forecast range, but portfolio risk remains concentrated in core services and revisions." },
    { id: "cn-pmi-sep", date: "2026-09-30", time: "09:30", country: "CN", impact: "MEDIUM", status: "tentative", name: "Official Manufacturing PMI", period: "September", actual: "?", consensus: "49.8", previous: "49.6", surprise: "Pending", unit: "index", source: "National Bureau of Statistics", sample: 30, theme: "Growth", lead: "A move toward 50 would improve the sequential signal, though new orders and employment must confirm the headline." }
  ];

  const NEWS = {
    Inflation: [
      ["20:30", "Official", "Release", "Headline and core inflation data published; first-vintage values locked."],
      ["20:34", "Wire", "Market", "Front-end yields lead the immediate rates move as traders reprice the policy path."],
      ["20:42", "Research desk", "Flash", "Services composition supports the preview thesis; conviction raised."],
      ["20:47", "Research desk", "Flash", "Headline miss acknowledged, but analysts caution against extrapolating one print."]
    ],
    Labor: [
      ["20:30", "Official", "Release", "Payrolls, unemployment and earnings details published."],
      ["20:35", "Wire", "Market", "Rates sell off initially; equity reaction is muted by softer hours worked."],
      ["20:44", "Research desk", "Flash", "Hiring breadth improved, but the household survey remains a cross-check."],
      ["21:05", "Research desk", "Comment", "The report does not close the door on easing if inflation continues to cool."]
    ],
    Policy: [
      ["T-2d", "Research desk", "Preview", "Base case unchanged; focus is on forward guidance and vote dispersion."],
      ["T-1d", "Research desk", "Preview", "Risk is a more restrictive projected path rather than an unexpected decision."],
      ["T-4h", "Wire", "Positioning", "Rates options imply elevated event volatility into the announcement."],
      ["T+0", "Official", "Scheduled", "Statement, projections and press conference will be linked here."]
    ],
    default: [
      ["T+0", "Official", "Release", "Primary-source data captured with timestamp and first-vintage status."],
      ["T+3m", "Wire", "Market", "Initial cross-asset reaction normalized to the event timestamp."],
      ["T+12m", "Research desk", "Flash", "Analyst note maps the surprise to the house macro view."],
      ["T+20m", "Research desk", "Flash", "Alternative interpretation highlights the weakest component."]
    ]
  };

  const STUDIES = {
    upside: {
      "30m": { n: 42, hit: "67%", gap: "0.08 SD", stability: "Mixed", assets: [["UST 2Y", "yield", 5.2, 76], ["USD index", "return", 0.25, 67], ["S&P futures", "return", -0.40, 64], ["Gold", "return", -0.31, 60]], bars: [18,26,34,47,62,78,92,80,63,49,34,22] },
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

  const MARKET = window.FREERIDE_DATA || { rates: [], catalysts: [], research: {}, homeContext: [] };
  let state = { year: 2026, month: 8, country: "ALL", impact: "ALL", currentEvent: EVENTS.find(event => event.id === "us-cpi-aug"), bucket: "upside", horizon: "30m", watched: false, catalystFilter: "ALL", contextFilter: "ALL", contextItems: [...(MARKET.homeContext || [])], feedGeneratedAt: null, feedStatus: "Loading automatic feed", tenors: new Set(["DGS2", "DGS10", "DGS30"]) };
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
      const classes = ["calendar-day", date.getMonth() !== state.month ? "outside-month" : "", iso === "2026-09-12" ? "is-today" : ""].filter(Boolean).join(" ");
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
    }).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    const groups = Object.groupBy ? Object.groupBy(inMonth, event => event.date) : inMonth.reduce((acc, event) => ((acc[event.date] ||= []).push(event), acc), {});
    $("#mobileAgenda").innerHTML = Object.entries(groups).map(([date, dayEvents]) => {
      const formatted = new Intl.DateTimeFormat("en", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${date}T00:00:00`));
      return `<section class="agenda-day"><div class="agenda-date"><strong>${formatted}</strong><span>${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}</span></div>${dayEvents.map(event => `<button type="button" class="agenda-event ${event.status}" data-event-open="${event.id}"><span>${event.time}</span><span><strong>${esc(event.name)}</strong><small>${event.country} | ${event.impact.toLowerCase()} impact</small></span><span class="agenda-surprise">${esc(event.surprise)}</span></button>`).join("")}</section>`;
    }).join("") || `<section class="agenda-day"><div class="agenda-date"><strong>No matching events</strong><span>Adjust filters</span></div></section>`;
  }

  function showDetail(eventId, tab = "overview") {
    const event = EVENTS.find(item => item.id === eventId) || state.currentEvent;
    state.currentEvent = event;
    $("#calendarView").hidden = true;
    $("#detailView").hidden = false;
    $("#eventCountry").textContent = event.country;
    $("#eventCountry").className = `country-badge ${event.country.toLowerCase()}`;
    $("#eventStatus").textContent = event.status[0].toUpperCase() + event.status.slice(1);
    $("#eventStatus").className = `status-badge ${event.status}`;
    $("#eventImpact").innerHTML = `<i data-lucide="zap"></i> ${event.impact[0] + event.impact.slice(1).toLowerCase()} impact`;
    $("#eventImpact").className = `impact-badge ${event.impact.toLowerCase()}`;
    $("#eventTitle").textContent = `${event.country} ${event.name} / ${event.period}`;
    const formatted = new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${event.date}T00:00:00`));
    $("#eventSubtitle").textContent = `${formatted} | ${event.time} HKT | ${event.source}`;
    $("#actualValue").textContent = event.actual;
    $("#consensusValue").textContent = event.consensus;
    $("#previousValue").textContent = event.previous;
    $("#surpriseValue").textContent = event.surprise;
    $(".lead-take").textContent = event.lead;
    updateNarrative(event);
    renderNews(event);
    renderResearch(event);
    renderRates();
    updateStudyLabels(event);
    setTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
    createIcons();
  }

  function updateNarrative(event) {
    const points = $$(".commentary-points > div");
    const researchCase = MARKET.research[event.researchKey];
    const released = event.status === "released";
    const copy = researchCase?.points || (released ? [
      ["Read the composition, not only the headline", `${event.theme} details determine whether the surprise is likely to persist beyond the first market window.`],
      ["Street dispersion adds information", "Compare eligible point-in-time house views before drawing a conclusion from the consensus median."],
      ["Separate reaction from causation", `The event window controls timing, but simultaneous news, positioning and liquidity can still explain part of the move.`]
    ] : [
      ["Consensus hides the distribution", `The median is ${event.consensus}; house-level drivers reveal where the forecast is fragile.`],
      ["Define the market-relevant miss", `A material surprise must be assessed against both the point estimate and the priced policy or growth path.`],
      ["Pre-register the event window", `Sensitivity scenarios use fixed horizons so the analysis does not select the most favorable post-release move.`]
    ]);
    $(".lead-take").textContent = researchCase?.lead || event.lead;
    points.forEach((point, index) => {
      $("strong", point).textContent = copy[index][0];
      $("p", point).textContent = copy[index][1];
    });
  }

  function renderNews(event) {
    const items = MARKET.research[event.researchKey]?.timeline || NEWS[event.theme] || NEWS.default;
    $("#newsTimeline").innerHTML = items.map(([time, source, type, headline], index) => `<article class="news-item"><time>${time}</time><span class="timeline-node ${index === 0 ? "primary" : ""}"></span><div><div class="news-meta"><strong>${esc(source)}</strong><span>${esc(type)}</span></div><p>${esc(headline)}</p></div></article>`).join("");
  }

  function renderResearch(event) {
    const researchCase = MARKET.research[event.researchKey];
    const body = $("#researchComparisonBody");
    const chart = $("#researchForecastChart");
    const documents = $("#researchDocuments");
    if (!researchCase) {
      body.innerHTML = `<tr><td colspan="6">No eligible GS/JPM document is linked to this event in the supplied research set.</td></tr>`;
      chart.innerHTML = `<p class="research-empty">Research coverage unavailable for this event.</p>`;
      documents.innerHTML = `<p class="research-empty">No entitled documents linked.</p>`;
      $("#researchPattern").textContent = "The coverage gap is shown explicitly; no house view is inferred.";
      $("#researchCutoff").innerHTML = `<i data-lucide="clock-3"></i> No eligible documents`;
      return;
    }
    $("#researchCutoff").innerHTML = `<i data-lucide="clock-3"></i> ${esc(researchCase.cutoff)}`;
    $("#researchPathTitle").textContent = event.theme === "Policy" ? (event.status === "released" ? "Expected vs actual hawkish dissents" : "Relative policy-path stance") : "Forecast-to-outturn comparison";
    body.innerHTML = researchCase.rows.map((row, index) => `<tr class="${index === 0 ? "consensus-row" : ""}"><td><strong>${esc(row.source)}</strong><small>${esc(row.meta)}</small></td><td>${esc(row.forecast)}</td><td>${esc(row.vs)}</td><td>${esc(row.thesis)}</td><td>${esc(row.risk)}</td><td><span class="result-chip ${row.result}">${esc(row.gap)}</span></td></tr>`).join("");
    const max = Math.max(...researchCase.bars.map(item => item.value), 0.01);
    chart.innerHTML = researchCase.bars.map(item => `<div class="forecast-column ${item.className}"><div class="forecast-bar-wrap"><div class="forecast-bar" style="height:${Math.max(8, item.value / max * 100)}%"><em>${item.value < 1 ? item.value.toFixed(2) + "%" : item.value}</em></div></div><strong>${esc(item.label)}</strong><small>${esc(item.meta)}</small></div>`).join("");
    $("#researchPattern").textContent = researchCase.pattern;
    documents.innerHTML = researchCase.documents.map(doc => `<article><header><span class="institution-mark ${doc.mark === "GS" ? "northstar" : "harbor"}">${doc.mark}</span><div><strong>${esc(doc.institution)}</strong><small>${esc(doc.date)}</small></div><span class="stance-tag ${doc.tone}">${esc(doc.stance)}</span></header><p>${esc(doc.text)}</p><footer><i data-lucide="file-text"></i><span class="source-page">${esc(doc.ref)}</span></footer></article>`).join("");
    const researchCount = researchCase.documents.length;
    const researchTrace = $(".source-section li:nth-child(3) span");
    if (researchTrace) researchTrace.innerHTML = `<strong>Licensed research</strong>${researchCount} linked documents`;
    createIcons();
  }

  function catalystView(item) {
    if (item.commentary) return item.commentary;
    const title = item.title.toLowerCase();
    if (item.type === "DATA") {
      if (title.includes("cpi")) return title.includes("august") ? "August core CPI printed 0.29% MoM versus 0.20% consensus; wireless and travel drove much of the upside." : "July core CPI printed 0.22% MoM, in line with JPM and 3bp above the GS call.";
      if (title.includes("employment")) return title.includes("august") ? "August payrolls printed 162k versus a 55k median, a large upside surprise." : "July payrolls were revised lower and kept the labor-softening debate alive.";
      return "Official data release; use the linked event for the first-vintage result and surprise.";
    }
    if (item.type === "FED") return title.includes("decision") ? "Decision day: the market focus is the reaction function, projections and vote dispersion." : "Fed communication: the key question is whether the policy path is becoming more or less restrictive.";
    if (title.includes("cpi")) return "GS/JPM focus on the inflation mix: core services and shelter versus goods and energy risks.";
    if (title.includes("payroll") || title.includes("employment")) return "Labor view: the forecast is sensitive to benchmark revisions, breadth and whether hiring momentum is re-accelerating.";
    if (title.includes("waller")) return "GS links a hold to continued disinflation, with hotter CPI/PPI as the hike-tail risk.";
    if (title.includes("fomc") || title.includes("minutes") || title.includes("jackson")) return "Policy view: near-term hold is the base case; the debate is the later path and hawkish-dissent risk.";
    return "Sell-side research marker; open the event for the cited house view and source page.";
  }

  function renderHomeContext() {
    const items = state.contextItems.filter(item => state.contextFilter === "ALL" || item.kind === state.contextFilter);
    $("#contextCount").textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;
    const status = $("#contextFeedStatus");
    if (status) status.textContent = state.feedGeneratedAt ? `Feed content updated ${new Intl.DateTimeFormat("en", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit", hour12:false, timeZone:"Asia/Hong_Kong" }).format(new Date(state.feedGeneratedAt))} HKT` : state.feedStatus;
    $("#homeContextFeed").innerHTML = items.map(item => {
      const content = `<span class="context-date">${esc(item.date)}<small>${esc(item.time)}</small></span><span class="context-copy"><span class="context-meta"><b class="context-kind ${item.kind.toLowerCase()}">${esc(item.kind)}</b><strong>${esc(item.source)}</strong></span><b class="context-title">${esc(item.title)}</b><small>${esc(item.summary)}</small><em>${esc(item.access)}</em></span><i data-lucide="arrow-up-right"></i>`;
      return item.url ? `<a class="context-item" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${content}</a>` : `<button class="context-item" type="button" data-event-open="${item.eventId}">${content}</button>`;
    }).join("") || `<p class="context-empty">No context items match this filter.</p>`;
    createIcons();
  }

  async function loadAutoNews() {
    try {
      const feedUrls = [
        "https://raw.githubusercontent.com/Lancewang1/stock-research-public/main/reports/2026-09-10/freeride-macro-intelligence/news-feed.json",
        "news-feed.json"
      ];
      let payload;
      for (const url of feedUrls) {
        try {
          const separator = url.includes("?") ? "&" : "?";
          const response = await fetch(`${url}${separator}v=${Date.now()}`, { cache: "no-store" });
          if (!response.ok) continue;
          payload = await response.json();
          break;
        } catch (error) {
          // Try the bundled Pages snapshot when the live branch feed is unavailable.
        }
      }
      if (!payload) throw new Error("No feed source available");
      const merged = [...(payload.items || []), ...(MARKET.homeContext || [])];
      const seen = new Set();
      state.contextItems = merged.filter(item => {
        const key = String(item.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
      state.feedGeneratedAt = payload.generatedAt;
      state.feedStatus = "Automatic feed live";
    } catch (error) {
      state.feedStatus = "Automatic feed unavailable | showing licensed research cache";
    }
    renderHomeContext();
  }

  function renderRates() {
    const svg = $("#ratesChart");
    if (!svg || !MARKET.rates.length) return;
    const W = 1120, H = 390, left = 48, right = 26, top = 82, bottom = 38;
    const plotW = W - left - right, plotH = H - top - bottom;
    const domainStart = new Date("2026-07-01T00:00:00Z").getTime();
    const domainEnd = new Date("2026-09-16T00:00:00Z").getTime();
    const yMin = 4.0, yMax = 5.4;
    const x = date => left + (new Date(`${date}T00:00:00Z`).getTime() - domainStart) / (domainEnd - domainStart) * plotW;
    const y = value => top + (yMax - value) / (yMax - yMin) * plotH;
    const tenorMeta = { DGS2:{index:1,label:"2Y",color:"#0d8790"}, DGS10:{index:2,label:"10Y",color:"#386b9e"}, DGS30:{index:3,label:"30Y",color:"#7256a4"} };
    const formatDate = date => new Intl.DateTimeFormat("en", { day:"2-digit", month:"short" }).format(new Date(`${date}T00:00:00Z`));
    const grid = [];
    for (let value = 4.0; value <= 5.401; value += .2) grid.push(`<line class="grid" x1="${left}" y1="${y(value)}" x2="${W-right}" y2="${y(value)}"/><text class="axis-label" x="${left-9}" y="${y(value)+3}" text-anchor="end">${value.toFixed(1)}%</text>`);
    const ticks = ["2026-07-01","2026-07-15","2026-07-29","2026-08-12","2026-08-26","2026-09-09","2026-09-16"];
    const tickMarkup = ticks.map(date => `<line class="grid" x1="${x(date)}" y1="${top}" x2="${x(date)}" y2="${H-bottom}"/><text class="axis-label" x="${x(date)}" y="${H-14}" text-anchor="middle">${formatDate(date)}</text>`).join("");
    const series = [...state.tenors].map(tenor => {
      const meta = tenorMeta[tenor];
      const points = MARKET.rates.map(row => `${x(row[0]).toFixed(1)},${y(row[meta.index]).toFixed(1)}`).join(" ");
      return `<polyline class="series ${tenor}" points="${points}"/>`;
    }).join("");
    const visibleCatalysts = MARKET.catalysts.filter(item => state.catalystFilter === "ALL" || item.type === state.catalystFilter);
    const grouped = visibleCatalysts.reduce((acc, item) => ((acc[item.date] ||= []).push(item), acc), {});
    const markers = Object.entries(grouped).map(([date, items], index) => {
      const cx = x(date);
      const type = items.some(item => item.type === "DATA") ? "DATA" : items.some(item => item.type === "FED") ? "FED" : "RESEARCH";
      const label = items.length > 1 ? `${items[0].institution} +${items.length-1}` : items[0].institution;
      const lane = index % 3;
      return `<line class="catalyst-line ${type}" x1="${cx}" y1="${top-7}" x2="${cx}" y2="${H-bottom}"/><circle class="catalyst-dot ${type}" data-catalyst-date="${date}" cx="${cx}" cy="${top-13-lane*16}" r="5" tabindex="0"/><text class="catalyst-label" data-catalyst-date="${date}" x="${cx}" y="${top-23-lane*16}" text-anchor="middle">${esc(label)}</text>`;
    }).join("");
    const futureX = x("2026-09-12");
    const hits = MARKET.rates.map((row, index) => {
      const nextX = index === MARKET.rates.length - 1 ? x("2026-09-10") : x(MARKET.rates[index + 1][0]);
      const startX = index === 0 ? left : (x(MARKET.rates[index - 1][0]) + x(row[0])) / 2;
      return `<rect class="hover-hit" data-rate-index="${index}" x="${startX}" y="${top}" width="${Math.max(4,nextX-startX)}" height="${plotH}"/>`;
    }).join("");
    svg.innerHTML = `<rect x="${futureX}" y="${top}" width="${W-right-futureX}" height="${plotH}" fill="#f5f1f8"/><text class="axis-label" x="${futureX+8}" y="${top+16}">NO OBSERVED YIELD DATA</text>${grid.join("")}${tickMarkup}${markers}${series}<g id="rateHover"></g>${hits}`;
    svg.onpointermove = event => {
      const hit = event.target.closest("[data-rate-index]");
      const catalystTarget = event.target.closest("[data-catalyst-date]");
      if (!hit && !catalystTarget) return;
      const catalystDate = catalystTarget?.dataset.catalystDate;
      const row = hit ? MARKET.rates[Number(hit.dataset.rateIndex)] : MARKET.rates.find(item => item[0] === catalystDate);
      const date = catalystDate || row[0];
      const cx = x(date);
      if (row) $("#rateHover").innerHTML = `<line class="hover-line" x1="${cx}" y1="${top}" x2="${cx}" y2="${H-bottom}"/>${[1,2,3].map(i => `<circle cx="${cx}" cy="${y(row[i])}" r="4" fill="${Object.values(tenorMeta)[i-1].color}" stroke="#fff" stroke-width="1.5"/>`).join("")}`;
      const tooltip = $("#ratesTooltip");
      const catalysts = MARKET.catalysts.filter(item => item.date === date);
      tooltip.innerHTML = `<strong>${formatDate(date)} HKT</strong>${row ? `<span><em>2Y</em><b>${row[1].toFixed(2)}%</b></span><span><em>10Y</em><b>${row[2].toFixed(2)}%</b></span><span><em>30Y</em><b>${row[3].toFixed(2)}%</b></span>` : ""}${catalysts.map(item => `<div class="catalyst-tooltip"><b>${esc(item.institution)} · ${esc(item.type.toLowerCase())}</b><strong>${esc(item.title)}</strong><p>${esc(catalystView(item))}</p></div>`).join("")}`;
      tooltip.hidden = false;
      const shell = $(".rates-chart-shell").getBoundingClientRect();
      tooltip.style.left = `${Math.min(shell.width - 190, Math.max(8, event.clientX - shell.left + 12))}px`;
      tooltip.style.top = `${Math.max(8, event.clientY - shell.top - 25)}px`;
    };
    svg.onpointerleave = () => { $("#ratesTooltip").hidden = true; $("#rateHover").innerHTML = ""; };
    $("#catalystRail").innerHTML = visibleCatalysts.map(item => `<button class="catalyst-card ${item.type}" type="button" data-event-open="${item.eventId}"><time>${formatDate(item.date)}</time><span><strong>${esc(item.title)}</strong><small>${item.institution} | ${item.type.toLowerCase()}${item.upcoming ? " | upcoming" : ""}</small></span></button>`).join("");
    const first = MARKET.rates[0], latest = MARKET.rates[MARKET.rates.length - 1];
    [["2Y",1],["10Y",2],["30Y",3]].forEach(([label,index]) => {
      $(`#latest${label}`).textContent = `${latest[index].toFixed(2)}%`;
      const change = Math.round((latest[index] - first[index]) * 100);
      $(`#change${label}`).textContent = `${change >= 0 ? "+" : ""}${change} bp since 01 Jul`;
    });
    $("#latestCurve").textContent = `+${Math.round((latest[2]-latest[1])*100)} bp`;
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
    if (firstMeta) firstMeta.innerHTML = `<i data-lucide="database"></i> ${event.country} ${esc(event.name)} | Jan 2016-Aug 2026`;
  }

  function renderStudy() {
    const study = STUDIES[state.bucket][state.horizon];
    $("#sampleMeta").innerHTML = `<i data-lucide="list-filter"></i> n = ${study.n} releases`;
    $("#sampleBadge").textContent = `n=${study.n} | ${study.n >= 40 ? "usable" : "limited"}`;
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
    const unitFor = kind => kind === "yield" ? "bp" : "%";
    const formatResponse = (value, kind) => `${value > 0 ? "+" : ""}${value.toFixed(kind === "yield" ? 1 : 2)}${unitFor(kind)}`;
    $("#distributionChart").innerHTML = study.assets.map(([asset, kind, value, hit]) => {
      const scale = kind === "yield" ? Math.max(12, Math.ceil(Math.abs(value) * 2.2 + 6)) : Math.max(.8, Math.ceil(Math.abs(value) * 2.2 * 10) / 10);
      const center = 5.5 + (value / scale) * 5.1;
      const bars = Array.from({ length: 12 }, (_, index) => {
        const distance = (index - center) / 2.2;
        const height = Math.max(15, Math.round(92 * Math.exp(-(distance * distance) / 2)));
        return `<span class="${index < 6 ? "negative-bar" : "positive-bar"}" style="height:${height}%" title="${formatResponse(-scale + (index + .5) * (scale * 2 / 12), kind)} outcome band"></span>`;
      }).join("");
      const marker = Math.max(3, Math.min(97, 50 + value / scale * 50));
      return `<article class="asset-distribution"><header><strong>${esc(asset)} <small>(${unitFor(kind)})</small></strong><span>Median ${formatResponse(value, kind)} · ${hit}% directional hit</span></header><div class="asset-density"><div class="asset-density-bars">${bars}</div><i class="asset-median-marker" style="left:${marker}%" title="Median ${formatResponse(value, kind)}"></i></div><div class="asset-density-axis"><span>${formatResponse(-scale, kind)}</span><span>0</span><span>${formatResponse(scale, kind)}</span></div></article>`;
    }).join("");
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
    $("#largestDetractor").textContent = `${detractor.asset} | ${detractor.contribution.toFixed(1)} bp`;
    $("#largestOffset").textContent = `${offset.asset} | ${offset.contribution > 0 ? "+" : ""}${offset.contribution.toFixed(1)} bp`;
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
    const contextFilter = event.target.closest("[data-context-filter]");
    if (contextFilter) {
      state.contextFilter = contextFilter.dataset.contextFilter;
      $$('[data-context-filter]').forEach(button => button.classList.toggle("is-active", button === contextFilter));
      return renderHomeContext();
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
    } else if (action === "refresh-context") {
      state.feedGeneratedAt = null;
      state.feedStatus = "Refreshing automatic feed";
      renderHomeContext();
      loadAutoNews();
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
    } else if (action === "export") toast("Demo brief prepared with source classifications");
    else if (action === "create-alert") dialog("Create event alert", "<p>Alert rules would combine event time, consensus changes, research updates and portfolio thresholds.</p><p><strong>Prototype only:</strong> no notification is sent.</p>");
    else if (action === "show-sources") dialog("Source map", "<p><strong>Official releases:</strong> BLS and Federal Reserve event facts.</p><p><strong>Research layer:</strong> 22 whitelisted GS/JPM/Barclays documents supplied by the owner; only short attributed derivatives and page citations are published.</p><p><strong>News layer:</strong> publisher-labelled public headlines refresh twice hourly and preserve links to the original article.</p><p><strong>Rates layer:</strong> FRED daily constant-maturity series DGS2, DGS10 and DGS30 through 08 Sep 2026.</p><p><strong>Illustrative modules:</strong> cross-asset event study and portfolio sensitivity are clearly separated from observed data.</p>");
    else if (action === "show-method") dialog("Event-study method", "<p>Compare first-release actual with the last eligible point-in-time consensus before release. Include every qualifying observation in the bucket and use fixed 30-minute, one-day and five-day windows.</p><p>Median response, dispersion and regime stability are shown. This is association, not causal evidence or a trading backtest.</p>");
    else if (action === "view-all-news") dialog("News monitor", "<p>The production view would de-duplicate wires, official statements and entitled research; align each item to the event clock; and tag whether it changes facts, forecasts or interpretation.</p>");
    else if (action === "add-holding") {
      syncHoldingInputs(); holdings.push({ asset: "Credit", weight: 0, beta: 1 }); renderHoldings();
    } else if (action === "recalculate") {
      calculatePortfolio(); renderHoldings(); toast("Sensitivity recalculated from current inputs");
    }
  });

  $("#impactFilter").addEventListener("change", event => { state.impact = event.target.value; renderCalendar(); });
  $("#catalystFilter").addEventListener("change", event => { state.catalystFilter = event.target.value; renderRates(); });
  $$("[data-tenor]").forEach(input => input.addEventListener("change", event => {
    if (event.target.checked) state.tenors.add(event.target.dataset.tenor);
    else state.tenors.delete(event.target.dataset.tenor);
    if (!state.tenors.size) {
      state.tenors.add(event.target.dataset.tenor);
      event.target.checked = true;
      toast("Keep at least one Treasury tenor visible");
    }
    renderRates();
  }));
  $("#portfolioScenario").addEventListener("change", renderHoldings);
  $("#holdingsBody").addEventListener("change", calculatePortfolio);
  $("#holdingsBody").addEventListener("input", calculatePortfolio);

  renderCalendar();
  renderHomeContext();
  loadAutoNews();
  renderNews(state.currentEvent);
  renderResearch(state.currentEvent);
  renderRates();
  renderStudy();
  renderHoldings();
  createIcons();
  const [deepEvent, deepTab = "overview"] = location.hash.slice(1).split("/");
  if (EVENTS.some(event => event.id === deepEvent)) showDetail(deepEvent, ["overview", "institutions", "history", "portfolio"].includes(deepTab) ? deepTab : "overview");
})();

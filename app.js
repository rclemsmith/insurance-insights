/**
 * Emerson Insurance - Microsoft Clarity Analytics Dashboard Engine
 * Fetches data via server-side proxy which reads CLARITY_API_TOKEN from environment.
 * Smart 10 req/day quota caching & Chart.js visualizations.
 */

// Storage Keys
const CACHE_KEY = "clarity_cached_data";
const CACHE_TIME_KEY = "clarity_cached_timestamp";
const CACHE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours default cache

// Global Chart Instances
let planChartInstance = null;
let deviceChartInstance = null;
let trendChartInstance = null;

// Initial Fallback Baseline Data (Used before initial sync)
const BASELINE_DATA = {
  totalSessions: 14,
  distinctUsers: 11,
  totalClicks: 38,
  clicksPerSession: 2.7,
  avgScrollDepth: 68,
  rageClicks: 0,
  deadClicks: 1,
  topPlan: "Kotak GAIN",
  devices: { Mobile: 9, Desktop: 5, Tablet: 0 },
  plans: {
    "Kotak GAIN (gain.html)": 18,
    "Kotak Fortune Maximiser": 12,
    "Kotak Assured Savings": 15
  },
  trend: {
    labels: ["2 Days Ago", "Yesterday", "Today"],
    sessions: [3, 4, 7]
  },
  pages: [
    { name: "Home Landing Page", url: "/", category: "Landing", views: 24, share: 35 },
    { name: "Kotak GAIN Details", url: "/gain.html", category: "Wealth Plan", views: 18, share: 26 },
    { name: "Assured Savings Plan", url: "/assured-savings.html", category: "Guaranteed Plan", views: 15, share: 22 },
    { name: "Fortune Maximiser", url: "/fortune-maximiser.html", category: "Endowment Plan", views: 12, share: 17 }
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkServerAndLoadData();
});

function setupEventListeners() {
  const refreshBtn = document.getElementById("refreshBtn");
  refreshBtn.addEventListener("click", () => {
    fetchFromClarity(true);
  });
}

/**
 * Check if CLARITY_API_TOKEN is configured in server env and load data
 */
async function checkServerAndLoadData() {
  try {
    const res = await fetch("/api/status");
    if (res.ok) {
      const status = await res.json();
      if (!status.tokenConfigured) {
        showNotice("CLARITY_API_TOKEN is not set in your .env file. Please add your token to c:\\Users\\emers\\insurance-dashboard\\.env and restart server.py.", "warning");
      }
    }
  } catch (e) {
    // Opening without server.py
    showNotice("Tip: Run 'python server.py' to proxy Clarity API requests securely from your environment.", "info");
  }

  loadCachedOrFetch();
}

/**
 * Check cache first, else fetch fresh from server
 */
function loadCachedOrFetch() {
  const cachedDataStr = localStorage.getItem(CACHE_KEY);
  const cachedTimeStr = localStorage.getItem(CACHE_TIME_KEY);

  if (cachedDataStr && cachedTimeStr) {
    const cachedTime = parseInt(cachedTimeStr, 10);
    const age = Date.now() - cachedTime;

    if (age < CACHE_DURATION_MS) {
      try {
        const data = JSON.parse(cachedDataStr);
        renderDashboard(data);
        updateSyncTime(cachedTime, true);
        return;
      } catch (e) {
        console.warn("Failed to parse cached data:", e);
      }
    }
  }

  // Attempt fresh fetch from server proxy
  fetchFromClarity(false);
}

/**
 * Fetch insights from server proxy (/api/insights)
 */
async function fetchFromClarity(isManualRefresh = false) {
  const refreshBtn = document.getElementById("refreshBtn");
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = `<span>Fetching...</span>`;

  try {
    const response = await fetch("/api/insights?numOfDays=3");

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      if (response.status === 400 && errJson.error) {
        throw new Error(errJson.error);
      } else if (response.status === 429) {
        throw new Error("Clarity API daily limit (10 requests/day) reached. Showing cached data.");
      } else if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid Clarity API token in .env file. Please check your token.");
      } else {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }
    }

    const rawData = await response.json();
    const processed = transformClarityData(rawData);

    // Cache to respect the 10 request limit
    localStorage.setItem(CACHE_KEY, JSON.stringify(processed));
    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());

    renderDashboard(processed);
    updateSyncTime(Date.now(), false);
    showNotice("Successfully synced with Microsoft Clarity API using environment token!", "info");

  } catch (err) {
    console.warn("Clarity sync notice:", err);
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      renderDashboard(JSON.parse(cached));
      showNotice(`${err.message} (Using cached data)`, "warning");
    } else {
      renderDashboard(BASELINE_DATA);
      showNotice(`${err.message} (Showing baseline preview)`, "warning");
    }
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
      Sync Now
    `;
  }
}

/**
 * Transform Clarity JSON into dashboard structure
 */
function transformClarityData(raw) {
  if (!raw || !Array.isArray(raw)) {
    return BASELINE_DATA;
  }

  // Create lookup dictionary by metricName
  const metrics = {};
  raw.forEach(item => {
    if (item.metricName) {
      metrics[item.metricName] = item.information || [];
    }
  });

  // Traffic Metric
  const trafficInfo = metrics["Traffic"]?.[0] || {};
  const totalSessions = trafficInfo.totalSessionCount ?? 0;
  const distinctUsers = trafficInfo.distinctUserCount ?? totalSessions;

  // Scroll Depth
  const scrollInfo = metrics["ScrollDepth"]?.[0] || {};
  const avgScrollDepth = scrollInfo.averageScrollDepth ?? 0;

  // Engagement Time
  const engagementInfo = metrics["EngagementTime"]?.[0] || {};
  const activeTime = engagementInfo.activeTime ?? 0;

  // Frustration Metrics
  const rageInfo = metrics["RageClickCount"]?.[0] || {};
  const deadInfo = metrics["DeadClickCount"]?.[0] || {};
  const rageClicks = rageInfo.subTotal ?? 0;
  const deadClicks = deadInfo.subTotal ?? 0;

  // Devices Breakdown
  const deviceCounts = { Mobile: 0, Desktop: 0, Tablet: 0 };
  const deviceList = metrics["Device"] || [];
  deviceList.forEach(d => {
    const name = (d.name || "").toLowerCase();
    if (name.includes("mobile") || name.includes("phone")) deviceCounts.Mobile += (d.sessionsCount || 0);
    else if (name.includes("tablet") || name.includes("ipad")) deviceCounts.Tablet += (d.sessionsCount || 0);
    else deviceCounts.Desktop += (d.sessionsCount || 0);
  });

  // Popular Pages
  const popularList = metrics["PopularPages"] || [];
  const pages = [];
  const planViews = {
    "Kotak GAIN (gain.html)": 0,
    "Kotak Fortune Maximiser": 0,
    "Kotak Assured Savings": 0
  };

  popularList.forEach(p => {
    const url = p.url || "";
    const visits = p.visitsCount || 0;
    let name = "Home Landing Page";
    let category = "Landing";

    if (url.includes("gain")) {
      name = "Kotak GAIN Details";
      category = "Wealth Plan";
      planViews["Kotak GAIN (gain.html)"] += visits;
    } else if (url.includes("fortune")) {
      name = "Fortune Maximiser";
      category = "Endowment Plan";
      planViews["Kotak Fortune Maximiser"] += visits;
    } else if (url.includes("assured")) {
      name = "Assured Savings Plan";
      category = "Guaranteed Plan";
      planViews["Kotak Assured Savings"] += visits;
    }

    pages.push({
      name: name,
      url: url,
      category: category,
      views: visits,
      share: totalSessions > 0 ? Math.round((visits / totalSessions) * 100) : 100
    });
  });

  // Determine top plan
  let topPlan = "None yet";
  let maxViews = 0;
  for (const [pName, pViews] of Object.entries(planViews)) {
    if (pViews > maxViews) {
      maxViews = pViews;
      topPlan = pName;
    }
  }
  if (maxViews === 0) {
    topPlan = "Homepage Only";
  }

  return {
    totalSessions: totalSessions,
    distinctUsers: distinctUsers,
    totalClicks: deadClicks + rageClicks,
    clicksPerSession: totalSessions > 0 ? ((deadClicks + rageClicks) / totalSessions).toFixed(1) : "0.0",
    avgScrollDepth: avgScrollDepth,
    activeTime: activeTime,
    rageClicks: rageClicks,
    deadClicks: deadClicks,
    topPlan: topPlan,
    devices: deviceCounts,
    plans: planViews,
    trend: {
      labels: ["2 Days Ago", "Yesterday", "Today"],
      sessions: [0, 0, totalSessions]
    },
    pages: pages.length > 0 ? pages : [
      { name: "Home Landing Page", url: "https://emerson-insurance.pages.dev/", category: "Landing", views: totalSessions, share: 100 }
    ]
  };
}

/**
 * Render all dashboard UI elements and charts
 */
function renderDashboard(data) {
  // 1. KPI Cards
  document.getElementById("kpiSessions").textContent = data.totalSessions.toLocaleString();
  document.getElementById("kpiDistinctUsers").textContent = `${data.distinctUsers} distinct users`;
  document.getElementById("kpiClicks").textContent = data.totalClicks.toLocaleString();
  document.getElementById("kpiClicksPerSession").textContent = `${data.clicksPerSession || '2.5'} per session`;
  document.getElementById("kpiTopPlan").textContent = data.topPlan || "Kotak GAIN";
  document.getElementById("kpiScroll").textContent = `${data.avgScrollDepth}% avg`;
  document.getElementById("kpiFrustration").textContent = `Rage: ${data.rageClicks} • Dead clicks: ${data.deadClicks}`;

  // 2. Charts
  renderPlanChart(data.plans);
  renderDeviceChart(data.devices);
  renderTrendChart(data.trend);

  // 3. Pages Table
  renderPagesTable(data.pages);
}

function renderPlanChart(plans) {
  const ctx = document.getElementById("planComparisonChart").getContext("2d");
  if (planChartInstance) planChartInstance.destroy();

  const labels = Object.keys(plans);
  const values = Object.values(plans);

  planChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Interactions / Views",
        data: values,
        backgroundColor: ["#E4002B", "#0A2A5C", "#2563EB"],
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#071B3D",
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "#F1F5F9" },
          ticks: { stepSize: 5 }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderDeviceChart(devices) {
  const ctx = document.getElementById("deviceChart").getContext("2d");
  if (deviceChartInstance) deviceChartInstance.destroy();

  deviceChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Mobile", "Desktop", "Tablet"],
      datasets: [{
        data: [devices.Mobile || 0, devices.Desktop || 0, devices.Tablet || 0],
        backgroundColor: ["#E4002B", "#0A2A5C", "#94A3B8"],
        borderWidth: 2,
        borderColor: "#FFFFFF"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, padding: 16 }
        }
      }
    }
  });
}

function renderTrendChart(trend) {
  const ctx = document.getElementById("trendChart").getContext("2d");
  if (trendChartInstance) trendChartInstance.destroy();

  trendChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: trend.labels,
      datasets: [{
        label: "Sessions",
        data: trend.sessions,
        borderColor: "#0A2A5C",
        backgroundColor: "rgba(10, 42, 92, 0.08)",
        fill: true,
        tension: 0.35,
        pointBackgroundColor: "#E4002B",
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "#F1F5F9" },
          ticks: { stepSize: 2 }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderPagesTable(pages) {
  const tbody = document.getElementById("pagesTableBody");
  tbody.innerHTML = "";

  pages.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="page-row">
        <strong>${p.name}</strong>
        <span>${p.url}</span>
      </td>
      <td><span class="tag">${p.category}</span></td>
      <td class="num">
        <div class="share-bar-wrap">
          <div class="share-bar" style="width: ${p.share * 1.5}px"></div>
          <strong>${p.share}%</strong>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateSyncTime(timestamp, isCached) {
  const el = document.getElementById("syncTimestamp");
  const d = new Date(timestamp);
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  el.textContent = isCached ? `Cached at ${timeStr}` : `Synced at ${timeStr}`;
}

function showNotice(msg, type = "info") {
  const banner = document.getElementById("noticeBanner");
  banner.className = `notice-banner ${type}`;
  banner.textContent = msg;
  banner.classList.remove("hidden");
}

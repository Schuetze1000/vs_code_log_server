const vscode = acquireVsCodeApi();

// Add event listener to open search on Ctrl+F or Cmd+F and Ctrl+d or Cmd+d to open device selector
document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("keydown", (e) => {
    const isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl && e.key === "f") {
      e.preventDefault(); // Prevent vscode from opening its search
      e.stopPropagation(); // just in case

      if (
        document
          .getElementById("search-container")
          .classList.contains("expanded")
      ) {
        // Close search if it's already open
        const container = document.getElementById("search-container");
        container.classList.remove("expanded");
        container.classList.add("collapsed");

        // De-focus input
        const input = document.getElementById("search-input");
        input.blur();
      } else {
        // Expand search container and focus input
        const container = document.getElementById("search-container");
        container.classList.remove("collapsed");
        container.classList.add("expanded");

        const input = document.getElementById("search-input");
        input.focus();
      }
    } else if (isCtrl && e.key === "d") {
      vscode.postMessage({ command: "openDeviceSelector" });
    }
  });
});

// Search input HTML
const searchInputHTML = `
  <div id="search-container" class="collapsed">
  <div class="search-icon" onclick="toggleSearch()"></div>
  <input
    type="text"
    id="search-input"
    placeholder="Search logs..."
    oninput="filterLogs()"
    onkeydown="closeOnEnterEsc(event)"
  />
</div>`;

function toggleSearch() {
  const container = document.getElementById("search-container");
  // Toggle between collapsed and expanded
  if (container.classList.contains("collapsed")) {
    container.classList.remove("collapsed");
    container.classList.add("expanded");
  } else {
    container.classList.remove("expanded");
    container.classList.add("collapsed");
  }
}

function closeOnEnterEsc(event) {
  if (event.key === "Enter" || event.key === "Escape") {
    // Close search on Enter
    const container = document.getElementById("search-container");
    container.classList.remove("expanded");
    container.classList.add("collapsed");

    if (event.key === "Escape") {
      // Clear search on Escape
      sessionStorage.removeItem("currentFilter");

      // De-focus input on Escape
      searchInput = document.getElementById("search-input");
      searchInput.value = "";
      searchInput.blur();
      filterLogs();
    }
  }
}

function filterLogs() {
  const logs = document.querySelectorAll(".log");
  const query = document.getElementById("search-input").value.toLowerCase();
  sessionStorage.setItem("currentFilter", query);

  // Filter by level
  const splitQuery = query.split(":");

  if (
    splitQuery.length > 1 &&
    ["info", "warn", "error"].includes(splitQuery[0].toLowerCase())
  ) {
    const level = splitQuery[0].toLowerCase();
    const search_query = splitQuery[splitQuery.length - 1];

    logs.forEach((log) => {
      const logLevel = log
        .getElementsByClassName("level")[0]
        ?.textContent.toLowerCase();

      log.style.display =
        log.textContent.toLowerCase().includes(search_query) &&
        logLevel?.substring(1, logLevel.length - 1) === level
          ? "block"
          : "none";
    });
  } else {
    logs.forEach((log) => {
      log.style.display = log.textContent.toLowerCase().includes(query)
        ? "block"
        : "none";
    });
  } // end of filter by level

  // Add glow effect to search container if there is a filter
  const search_container = document.getElementById("search-container");
  if (query.trim().length > 0) {
    search_container.classList.add("filtered");
  } else {
    search_container.classList.remove("filtered");
  }
}

function initLogs(logs) {
  const logsContainer = document.getElementById("logs-container");
  logs.forEach((log) => {
    const logDiv = document.createElement("div");
    logDiv.classList.add("log", log.level.toLowerCase());
    logDiv.innerHTML = `
      <div class="time">[${log.timestamp}]</div>
      <div class="level">[${log.level.toUpperCase()}]</div>
      <div class="message">${log.message.replace(/\n/g, "<br>")}</div>
    `;
    logsContainer.appendChild(logDiv);
  });

  // Load scroll position from sessionStorage
  let wasAtBottom = sessionStorage.getItem("wasAtBottom") === "true";
  let previousScrollTop = sessionStorage.getItem("previousScrollTop");
  if (previousScrollTop && !wasAtBottom) {
    logsContainer.scrollTop = parseFloat(previousScrollTop);
  }

  if (wasAtBottom) {
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  // Load filter from sessionStorage
  const currentFilter = sessionStorage.getItem("currentFilter");
  if (currentFilter) {
    document.getElementById("search-input").value = currentFilter;
    filterLogs();
  }
}

function addLogs(logs) {
  const container = document.getElementById("logs-container");
  logs.forEach((log) => {
    const logDiv = document.createElement("div");
    logDiv.classList.add("log", log.level.toLowerCase());
    logDiv.innerHTML = `
      <div class="time">[${log.timestamp}]</div>
      <div class="level">[${log.level.toUpperCase()}]</div>
      <div class="message">${log.message.replace(/\n/g, "<br>")}</div>
    `;
    container.appendChild(logDiv);
  });
  filterLogs();
}

function clear(clearSearch = true) {
  sessionStorage.removeItem("wasAtBottom");
  sessionStorage.removeItem("previousScrollTop");

  if (clearSearch) {
    sessionStorage.removeItem("currentFilter");
    searchInput = document.getElementById("search-input");
    searchInput.value = "";
  } else {
    searchInput = document.getElementById("search-input");
    searchInput.value = sessionStorage.getItem("currentFilter");
  }
}

function clearLogs() {
  const container = document.getElementById("logs-container");
  // Clear innerHTML and add search input
  container.innerHTML = searchInputHTML;
  clear(false);
}

function startLogServer() {
  vscode.postMessage({ command: "startLogServer" });
}

function onLoad() {
  const logsContainer = document.getElementById("logs-container");
  if (!logsContainer) {
    return;
  }
  logsContainer.innerHTML = searchInputHTML;

  vscode.postMessage({ command: "requestLogs" });

  logsContainer.addEventListener("scroll", () => {
    const nearBottom =
      logsContainer.scrollTop + logsContainer.clientHeight >=
      logsContainer.scrollHeight - 2;

    // Save scroll position
    if (!nearBottom) {
      sessionStorage.setItem("wasAtBottom", "false");
      sessionStorage.setItem("previousScrollTop", logsContainer.scrollTop);
    } else {
      sessionStorage.setItem("wasAtBottom", "true");
    }
  });

  // Observe new logs and autoscroll if still at the bottom
  new MutationObserver(() => {
    if (sessionStorage.getItem("wasAtBottom") === "true") {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }
  }).observe(logsContainer, { childList: true, subtree: true });
}

function handleMessage(message) {
  const { command, logs } = message;
  switch (command) {
    case "addLogs":
      addLogs(logs);
      break;
    case "clear":
      clear();
      break;
    case "initLogs":
      initLogs(logs);
      break;
    case "clearLogs":
      clearLogs();
      break;
    default:
      console.warn(`Unknown command: ${command}`);
  }
}

window.addEventListener("message", (event) => handleMessage(event.data));

window.onload = onLoad;

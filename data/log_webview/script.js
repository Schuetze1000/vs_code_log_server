 // Auto-scrolling logic for the log webview.
// 1. We use localStorage to store whether we are at the bottom (wasAtBottom).
// 2. After loading, we only scroll if wasAtBottom = true.
// 3. If the user scrolls up, wasAtBottom = false.

const vscode = acquireVsCodeApi();

function onLoad() {
  const logsContainer = document.getElementById("logs-container");
  if (!logsContainer) {
    return;
  }

  // Load scroll position from localStorage
  let wasAtBottom = localStorage.getItem("wasAtBottom") === "true";
  let previousScrollTop = localStorage.getItem("previousScrollTop");
  if (previousScrollTop && !wasAtBottom) {
    logsContainer.scrollTop = parseFloat(previousScrollTop);
  }

  if (wasAtBottom) {
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  logsContainer.addEventListener("scroll", () => {
    const nearBottom =
      logsContainer.scrollTop + logsContainer.clientHeight >=
      logsContainer.scrollHeight - 2;

    // Save scroll position
    if (!nearBottom) {
      localStorage.setItem("wasAtBottom", "false");
      localStorage.setItem("previousScrollTop", logsContainer.scrollTop);
    } else {
      localStorage.setItem("wasAtBottom", "true");
    }
  });

  // Observe new logs and autoscroll if still at the bottom
  new MutationObserver(() => {
    if (localStorage.getItem("wasAtBottom") === "true") {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }
  }).observe(logsContainer, { childList: true, subtree: true });
}

function startLogServer() {
  vscode.postMessage({ command: "startLogServer" });
}

window.onload = onLoad;

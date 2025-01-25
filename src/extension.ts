import * as vscode from "vscode";
import * as http from "http";

import { LogServerContext } from "./context";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unescapeHtml(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function activate(context: vscode.ExtensionContext) {
  let logs: LogPayload[] = [];
  let devices: Set<string> = new Set();
  let selectedDevice: string | null = null;
  let server: http.Server | null = null;
  const extensionUri = vscode.Uri.joinPath(context.extensionUri, "data");
  const logServerContext = new LogServerContext();
  const maxPortRetries = 10;

  // Status bar button for device selection
  const deviceSelector = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  deviceSelector.command = "extension.selectDevice";
  deviceSelector.tooltip = "Select a device to filter logs";
  deviceSelector.text = "Log-Device: None";
  deviceSelector.hide(); // Only visible when the server is running

  // Register the Webview-Provider (in your "logpanel-webview" panel)
  const provider = new LogWebviewProvider(
    () => logServerContext.isServerRunning,
    logs,
    () => selectedDevice,
    extensionUri
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("logpanel-webview", provider)
  );

  // Command: Start Log Server
  const startLogServerCommand = vscode.commands.registerCommand(
    "extension.startLogServer",
    async () => {
      if (logServerContext.isServerRunning) {
        vscode.window.showWarningMessage("Log Server is already running.");
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Starting Log Server...",
          cancellable: false,
        },
        async () => {
          return new Promise<void>((resolve, reject) => {
            try {
              // Create HTTP server
              server = http.createServer((req, res) => {
                if (req.method === "POST" && req.url === "/logs") {
                  let body = "";
                  req.on("data", (chunk) => (body += chunk.toString()));
                  req.on("end", () => {
                    try {
                      const log: LogPayload = JSON.parse(body);

                      if (
                        log.level !== "Info" &&
                        log.level !== "Warn" &&
                        log.level !== "Error"
                      ) {
                        throw new Error(
                          "Invalid log level. Must be Info, Warn, or Error."
                        );
                      }

                      if (
                        !log.device_name ||
                        !log.platform ||
                        !log.level ||
                        !log.message
                      ) {
                        throw new Error(
                          "Invalid log format. Missing device_name, platform, level, or message."
                        );
                      }

                      // Escape HTML and format the timestamp
                      log.message = escapeHtml(log.message);
                      log.timestamp = formatTime(
                        log.timestamp ? new Date(log.timestamp) : new Date()
                      );

                      // Save the log to the global array, add the platform-device and update the Webview
                      logs.push(log);
                      devices.add(`${log.platform} - ${log.device_name}`);
                      provider.addLog(log);
                      res.writeHead(200, {
                        "Content-Type": "application/json",
                      });
                      res.end(JSON.stringify({ status: "success" }));
                    } catch (error) {
                      res.writeHead(400, {
                        "Content-Type": "application/json",
                      });
                      res.end(JSON.stringify({ error: "Invalid log format" }));
                    }
                  });
                } else if (req.method === "GET" && req.url === "/ping") {
                  res.writeHead(200, { "Content-Type": "text/plain" });
                  res.end("Pong");
                } else {
                  res.writeHead(404, { "Content-Type": "text/plain" });
                  res.end("Not Found");
                } // End of server request handling
              }); // End of server creation

              let currentPort = 19000;
              let retryCount = 0;

              function logServerStarted() {
                logServerContext.isServerRunning = true;
                deviceSelector.show(); // Make the status bar button visible
                provider.refresh(); // Refresh the Webview
                resolve();
              }

              server.on("error", (err: NodeJS.ErrnoException) => {
                if (err.code === "EADDRINUSE") {
                  retryCount++;
                  if (retryCount > maxPortRetries) {
                    vscode.window.showErrorMessage(
                      `Failed to start the server after ${maxPortRetries} attempts. All ports are in use.`
                    );
                    reject(err);
                    return;
                  }

                  vscode.window.showWarningMessage(
                    `Port ${currentPort} is in use. Trying port ${
                      currentPort + 1
                    }...`
                  );

                  // Inkrementiere den Port und versuche es erneut
                  currentPort++;
                  server?.listen(currentPort, () => logServerStarted());
                } else {
                  vscode.window.showErrorMessage(
                    `Server error: ${err.message}`
                  );
                  reject(err);
                }
              }); // End of server error handling

              // Start the server
              server.listen(19000, () => logServerStarted());

              context.subscriptions.push({
                dispose: () => {
                  server?.close();
                  logServerContext.isServerRunning = false;
                  deviceSelector.hide();
                  provider.refresh();
                },
              });
              vscode.window.setStatusBarMessage(
                "Log Server is running on port 19000",
                5000
              );
            } catch (error) {
              vscode.window.showErrorMessage("Failed to start Log Server.");
              reject(error); // Error during startup
            } // End of try-catching server startup
          }); // End of Promise
        } // End of Progress
      ); // End of withProgress
    } // End of startLogServerCommand
  ); // End of registerCommand

  // Command: Stop Log Server
  const stopLogServerCommand = vscode.commands.registerCommand(
    "extension.stopLogServer",
    async () => {
      if (!logServerContext.isServerRunning) {
        vscode.window.showWarningMessage("Log Server is not running.");
        return;
      }

      server?.close();
      logServerContext.isServerRunning = false;
      deviceSelector.hide();

      // Clear logs and devices
      logs.splice(0, logs.length);
      devices.clear();

      // Clear the webview
      provider.clear();

      provider.refresh(); // Refresh the Webview
    }
  );

  // Command: Clear Logs
  const clearLogsCommand = vscode.commands.registerCommand(
    "extension.clearLogs",
    async () => {
      // If device is selected, only clear logs of that device
      if (selectedDevice) {
        for (let i = logs.length - 1; i >= 0; i--) {
          if (`${logs[i].platform} - ${logs[i].device_name}` === selectedDevice) {
            logs[i] = logs[logs.length - 1];
            logs.pop();
          }
        }
        devices.delete(selectedDevice);
      } else {
        logs.splice(0, logs.length);
      }
      provider.clearLogs();
      provider.refreshLogs();
    }
  );

  // Command: Select a device
  const selectDeviceCommand = vscode.commands.registerCommand(
    "extension.selectDevice",
    async () => {
      if (!logServerContext.isServerRunning) {
        vscode.window.showErrorMessage(
          "Log Server is not running. Start the server first."
        );
        return;
      }

      const deviceList = Array.from(devices);
      deviceList.unshift("None"); // Option for all devices

      const selection = await vscode.window.showQuickPick(deviceList, {
        placeHolder: "Select a device to filter logs (None for all)",
      });

      if (selection !== undefined) {
        selectedDevice = selection === "None" ? null : selection;
        deviceSelector.text = `Log-Device: ${selection}`;
        provider.clearLogs();
        provider.refreshLogs();
      }
    }
  );

  context.subscriptions.push(
    startLogServerCommand,
    selectDeviceCommand,
    deviceSelector
  );

  // Command: Copy Logs
  const copyLogsCommand = vscode.commands.registerCommand(
    "extension.copyLogs",
    async () => {
      // Copy only the Logs of the selected device as json
      const filteredLogs = selectedDevice
        ? logs.filter(
            (log) => `${log.platform} - ${log.device_name}` === selectedDevice
          )
        : logs;

      // Convert the logs to JSON and copy to clipboard
      const logsJson = JSON.stringify(
        filteredLogs,
        (key, value) => {
          if (typeof value === "string") {
            return unescapeHtml(value);
          }
          return value;
        },
        2
      );
      await vscode.env.clipboard.writeText(logsJson);
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Logs copied to clipboard",
          cancellable: false, 
        },
        async (progress) => {
          progress.report({ increment: 100 });
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      );
    }
  );
}

export function deactivate() {}

// Webview-Provider for the panel
class LogWebviewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private isServerRunning: () => boolean,
    private logs: LogPayload[],
    private getSelectedDevice: () => string | null,
    private extensionUri: vscode.Uri
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "log_webview"),
      ],
    };
    // Load initial HTML content
    webviewView.webview.html = this.getHtmlContent();

    // Receive messages from the Webview
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === "startLogServer") {
        // Start button in the Webview
        vscode.commands.executeCommand("extension.startLogServer");
      }
    });

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === "requestLogs") {
        const filteredLogs = this.getFiltredLogs();
        webviewView.webview.postMessage({
          command: "initLogs",
          logs: filteredLogs,
        });
      } else if (message.command === "openDeviceSelector") {
        vscode.commands.executeCommand("extension.selectDevice");
      }

    });
  }

  getFiltredLogs(): LogPayload[] {
    const selectedDevice = this.getSelectedDevice();
    return selectedDevice
      ? this.logs.filter(
          (log) => `${log.platform} - ${log.device_name}` === selectedDevice
        )
      : this.logs;
  }

  refresh(): void {
    if (this._view) {
      // Set new HTML each time
      this._view.webview.html = this.getHtmlContent();
    }
  }

  addLog(log: LogPayload): void {
    this._view?.webview.postMessage({
      command: "addLogs",
      logs: [log],
    });
  }

  refreshLogs(): void {
    const filteredLogs = this.getFiltredLogs();
    this._view?.webview.postMessage({
      command: "addLogs",
      logs: filteredLogs,
    });
  }

  clearLogs(): void {
    this._view?.webview.postMessage({ command: "clearLogs" });
  }

  clear(): void {
    this._view?.webview.postMessage({ command: "clear" });
  }

  private getHtmlContent(): string {
    const isRunning = this.isServerRunning();

    // Resolve paths to external files
    const onDiskStylesPath = vscode.Uri.joinPath(
      this.extensionUri,
      "log_webview",
      "styles.css"
    );
    const onDiskScriptPath = vscode.Uri.joinPath(
      this.extensionUri,
      "log_webview",
      "script.js"
    );

    const stylesUri = this._view?.webview.asWebviewUri(onDiskStylesPath);
    const scriptUri = this._view?.webview.asWebviewUri(onDiskScriptPath);

    return `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link rel="stylesheet" type="text/css" href="${stylesUri}">
            </head>
            <body>
                ${
                  isRunning
                    ? `
                      <div id="logs-container">
                        
                       
                      </div>
                        `
                    : `
                        <div class="button-container">
                            <button class="start-button" onclick="startLogServer()">🚀 Start Log Server</button>
                        </div>`
                }
                <script src="${scriptUri}"></script>
            </body>
        </html>`;
  }
}

// Data types for logs
interface LogPayload {
  level: "Info" | "Warn" | "Error";
  message: string;
  platform: string;
  device_name: string;
  timestamp: string;
}

// Time formatting
function formatTime(date: Date): string {
  return date.toTimeString().split(" ")[0]; // HH:mm:ss
}

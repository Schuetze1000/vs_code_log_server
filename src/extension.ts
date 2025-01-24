import * as vscode from "vscode";
import * as http from "http";

import { LogServerContext } from "./context";

export function activate(context: vscode.ExtensionContext) {
  let logs: LogPayload[] = [];
  let devices: Set<string> = new Set();
  let selectedDevice: string | null = null;
  let server: http.Server | null = null;
  const extensionUri = vscode.Uri.joinPath(context.extensionUri, "src");
  const logServerContext = new LogServerContext();

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
        async (progress) => {
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

                      if (!log.timestamp) {
                        log.timestamp = new Date().toISOString();
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

                      logs.push(log);
                      devices.add(`${log.platform} - ${log.device_name}`);
                      provider.refresh(); // Refresh the Webview
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
                }
              });

              // Start the server
              server.listen(19000, () => {
                logServerContext.isServerRunning = true;
                deviceSelector.show(); // Make the status bar button visible
                provider.refresh(); // Refresh the Webview
                resolve();
              });

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
            }
          });
        }
      );
    }
  );

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

      provider.refresh(); // Refresh the Webview
    }
  );

  // Command: Clear Logs
  const clearLogsCommand = vscode.commands.registerCommand(
    "extension.clearLogs",
    async () => {
      logs.splice(0, logs.length);
      provider.refresh(); // Refresh the Webview
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
        provider.refresh(); // Refresh the Webview
      }
    }
  );

  context.subscriptions.push(
    startLogServerCommand,
    selectDeviceCommand,
    deviceSelector
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
  }

  refresh(): void {
    if (this._view) {
      // Set new HTML each time (including autoscroll logic)
      this._view.webview.html = this.getHtmlContent();
    }
  }

  private getHtmlContent(): string {
    const isRunning = this.isServerRunning();
    const selectedDevice = this.getSelectedDevice();
    const filteredLogs = selectedDevice
      ? this.logs.filter(
          (log) => `${log.platform} - ${log.device_name}` === selectedDevice
        )
      : this.logs;

    // Generate logs as HTML
    const logEntries = filteredLogs
      .map(
        (log) => `
            <div class="log ${log.level.toLowerCase()}">
                <div class="time">[${formatTime(new Date(log.timestamp))}]</div>
                <div class="level">[${log.level.toUpperCase()}]</div>
                <div class="message">${log.message.replace(/\n/g, "<br>")}</div>
            </div>`
      )
      .join("\n");

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

    console.log("stylesUri", stylesUri);

   
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
                            ${logEntries}
                        </div>`
                    : `
                        <div class="button-container">
                            <button class="start-button" onclick="startLogServer()">🚀 Start Log Server</button>
                        </div>`
                }
                <script src="${scriptUri}"></script>
            </body>
        </html>`
    ;
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

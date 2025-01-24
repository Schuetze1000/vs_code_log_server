import * as vscode from 'vscode';
import * as http from 'http';

export function activate(context: vscode.ExtensionContext) {
    let logs: LogPayload[] = [];
    let devices: Set<string> = new Set();
    let selectedDevice: string | null = null;
    let server: http.Server | null = null;
    let isServerRunning = false;

    // Status bar button for device selection
    const deviceSelector = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    deviceSelector.command = 'extension.selectDevice';
    deviceSelector.tooltip = 'Select a device to filter logs';
    deviceSelector.text = 'Log-Device: None';
    deviceSelector.hide(); // Only visible when the server is running

    // Register the Webview-Provider (in your "logpanel-webview" panel)
    const provider = new LogWebviewProvider(() => isServerRunning, logs, () => selectedDevice);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('logpanel-webview', provider)
    );

    // Command: Start Log Server
    const startLogServerCommand = vscode.commands.registerCommand('extension.startLogServer', async () => {
        if (isServerRunning) {
            vscode.window.showWarningMessage('Log Server is already running.');
            return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Starting Log Server...',
                cancellable: false,
            },
            async (progress) => {
                return new Promise<void>((resolve, reject) => {
                    try {
                        // Create HTTP server
                        server = http.createServer((req, res) => {
                            if (req.method === 'POST' && req.url === '/logs') {
                                let body = '';
                                req.on('data', chunk => (body += chunk.toString()));
                                req.on('end', () => {
                                    try {
                                        const log: LogPayload = JSON.parse(body);
                                        logs.push(log);
                                        devices.add(`${log.platform} - ${log.device_name}`);
                                        provider.refresh(); // Refresh the Webview
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ status: 'success' }));
                                    } catch (error) {
                                        res.writeHead(400, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ error: 'Invalid log format' }));
                                    }
                                });
                            } else if (req.method === 'GET' && req.url === '/ping') {
                                res.writeHead(200, { 'Content-Type': 'text/plain' });
                                res.end('Pong');
                            } else {
                                res.writeHead(404, { 'Content-Type': 'text/plain' });
                                res.end('Not Found');
                            }
                        });

                        // Start the server
                        server.listen(19000, () => {
                            isServerRunning = true;
                            deviceSelector.show(); // Make the status bar button visible
                            provider.refresh(); // Refresh the Webview
							resolve();
                        });

                        context.subscriptions.push({
                            dispose: () => {
                                server?.close();
                                isServerRunning = false;
                                deviceSelector.hide();
                                provider.refresh();
                            },
                        });
						vscode.window.setStatusBarMessage('Log Server is running on port 19000', 5000);
                    } catch (error) {
                        vscode.window.showErrorMessage('Failed to start Log Server.');
                        reject(error); // Error during startup
                    }
                });
            }
        );
    });

	// Command: Stop Log Server
	const stopLogServerCommand = vscode.commands.registerCommand('extension.stopLogServer', async () => {
		if (!isServerRunning) {
			vscode.window.showWarningMessage('Log Server is not running.');
			return;
		}

		server?.close();
		isServerRunning = false;
		deviceSelector.hide();
		provider.refresh(); // Refresh the Webview
	});

    // Command: Select a device
    const selectDeviceCommand = vscode.commands.registerCommand('extension.selectDevice', async () => {
        if (!isServerRunning) {
            vscode.window.showErrorMessage('Log Server is not running. Start the server first.');
            return;
        }

        const deviceList = Array.from(devices);
        deviceList.unshift('None'); // Option for all devices

        const selection = await vscode.window.showQuickPick(deviceList, {
            placeHolder: 'Select a device to filter logs (None for all)',
        });

        if (selection !== undefined) {
            selectedDevice = selection === 'None' ? null : selection;
            deviceSelector.text = `Log-Device: ${selection}`;
            provider.refresh(); // Refresh the Webview
        }
    });

    context.subscriptions.push(startLogServerCommand, selectDeviceCommand, deviceSelector);
}

export function deactivate() {}

// Webview-Provider for the panel
class LogWebviewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private isServerRunning: () => boolean,
        private logs: LogPayload[],
        private getSelectedDevice: () => string | null
    ) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
        };

        // Set initial HTML
        webviewView.webview.html = this.getHtmlContent();

        // Receive messages from the Webview
        webviewView.webview.onDidReceiveMessage(message => {
            if (message.command === 'startLogServer') {
                // Start button in the Webview
                vscode.commands.executeCommand('extension.startLogServer');
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
            ? this.logs.filter(log => `${log.platform} - ${log.device_name}` === selectedDevice)
            : this.logs;

        // Generate logs as HTML
        const logEntries = filteredLogs
            .map(
                log => `
            <div class="log ${log.level.toLowerCase()}">
                <div class="time">[${formatTime(new Date(log.timestamp))}]</div>
                <div class="level">[${log.level.toUpperCase()}]</div>
                <div class="message">${log.message.replace(/\n/g, '<br>')}</div>
            </div>`
            )
            .join('\n');

        // HTML with autoscroll logic:
        // 1. We use localStorage to store whether we are at the bottom (wasAtBottom).
        // 2. After loading, we only scroll if wasAtBottom = true.
        // 3. If the user scrolls up, wasAtBottom = false.
        return `
        <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #d4d4d4;
            overflow: hidden; /* No scrolling on body */
            height: 100vh;
        }
        #logs-container {
            height: 100%; /* Takes the entire available height */
            overflow-y: auto; /* Scrollbar only here */
            padding: 10px;
        }
        .log {
            margin-bottom: 10px;
            padding: 5px;
            border-left: 4px solid;
            border-radius: 3px;
        }
        .log.info {
            border-color: #007acc;
        }
        .log.warn {
            border-color: #dcdcaa;
        }
        .log.error {
            border-color: #f44747;
        }
        .time, .level {
            font-weight: bold;
        }
        .message {
            white-space: pre-wrap; /* Enable word wrap */
			word-wrap: break-word;
			overflow-wrap: break-word;
        }
        .button-container {
            text-align: center;
            margin-top: 20px;
        }
        .start-button {
            padding: 10px 20px;
            background-color: #007acc;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        }
        .start-button:hover {
            background-color: #005f9e;
        }
    </style>
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
    <script>
        const vscode = acquireVsCodeApi();

        function onLoad() {
            const logsContainer = document.getElementById('logs-container');
            if (!logsContainer) return;

            // Load scroll position from localStorage
            let wasAtBottom = localStorage.getItem('wasAtBottom') === 'true';
            let previousScrollTop = localStorage.getItem('previousScrollTop');
            if (previousScrollTop && !wasAtBottom) {
                logsContainer.scrollTop = parseFloat(previousScrollTop);
            }

            if (wasAtBottom) {
                logsContainer.scrollTop = logsContainer.scrollHeight;
            }

            logsContainer.addEventListener('scroll', () => {
                const nearBottom =
                    logsContainer.scrollTop + logsContainer.clientHeight >= logsContainer.scrollHeight - 2;

                // Save scroll position
                if (!nearBottom) {
                    localStorage.setItem('wasAtBottom', 'false');
                    localStorage.setItem('previousScrollTop', logsContainer.scrollTop);
                } else {
                    localStorage.setItem('wasAtBottom', 'true');
                }
            });

            // Observe new logs and autoscroll if still at the bottom
            new MutationObserver(() => {
                if (localStorage.getItem('wasAtBottom') === 'true') {
                    logsContainer.scrollTop = logsContainer.scrollHeight;
                }
            }).observe(logsContainer, { childList: true, subtree: true });
        }

        function startLogServer() {
            vscode.postMessage({ command: 'startLogServer' });
        }

        window.onload = onLoad;
    </script>
</body>
</html>
`;
    }
}

// Data types for logs
interface LogPayload {
    level: 'Info' | 'Warn' | 'Error';
    message: string;
    platform: string;
    device_name: string;
    timestamp: string;
}

// Time formatting
function formatTime(date: Date): string {
    return date.toTimeString().split(' ')[0]; // HH:mm:ss
}

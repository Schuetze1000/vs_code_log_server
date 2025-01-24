# log-server

`log-server` is a Visual Studio Code extension that provides a lightweight HTTP server to receive and display logs from a React Native app (or any other source that can send requests via HTTP) directly within VS Code. This extension is designed to streamline debugging and improve development efficiency by centralizing logs in a dedicated view.

> Icon credit: [svgrepo](https://www.svgrepo.com/svg/279075/log-wood)

---

## Features

- **Log Server:** Start an HTTP server to receive logs from your React Native app.
- **Device Filtering:** Filter logs by platform and device name.
- **Webview Log Display:** Logs are displayed in a clean, scrollable Webview with:
  - Word wrap for long messages.
  - Color-coded log levels (Info, Warn, Error).
- **Autoscroll:** Automatically scroll to new logs unless the user has manually scrolled up.
- **Quick Device Selection:** Choose a device from the status bar for filtering logs.

---

## Requirements

To use this extension:
1. Ensure your app can send logs as structured JSON payloads via HTTP POST requests.
   - Logs should be sent as a POST request to `http://<server_ip/localhost>:19000/logs`.
2. The log payload format must include:
   ```json
   {
       "level": "Info|Warn|Error",
       "message": "Log message here",
       "platform": "iOS|Android",
       "device_name": "Device Name",
       "timestamp": "2023-01-01T12:00:00.000Z"
   }
   ```

Note: To check if the server is running send a GET request to `http://<server_ip/localhost:19000/ping`.

---

## Extension Settings

This extension currently does not expose any configurable settings. Future releases may include additional customization options.

---

## Known Issues

None

---

## Release Notes

### 0.0.1

- Initial release of `log-server`.
- Features:
  - Start and stop log server.
  - Display logs in a Webview with device filtering and autoscroll.
  - Status bar integration for quick device selection.

### 0.0.2

- Enhancements:
  - Added more space after the last log entry.
- Features:
  - Added to view/title two buttons to start/stop the server and clear the logs.
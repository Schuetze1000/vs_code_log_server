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
1. Ensure your React Native app can send logs via HTTP.
   - Logs should be sent as a POST request to `http://localhost:19000/logs`.
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

---

## Extension Settings

This extension currently does not expose any configurable settings. Future releases may include additional customization options.

---

## Known Issues

None

---

## Release Notes

### 1.0.0

- Initial release of `log-server`.
- Features:
  - Start and stop log server.
  - Display logs in a Webview with device filtering and autoscroll.
  - Status bar integration for quick device selection.

---

## Icon Usage

This extension uses the following icon:

![Icon](https://img.freepik.com/free-icon/log_318-17669676.jpg)

Icon source: [Freepik](https://www.freepik.com/icon/log_17669676#fromView=keyword&page=1&position=0&uuid=c0c044aa-5c3d-4c12-bae0-2cfd224e438b)
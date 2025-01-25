## [0.0.1] - 2024-01-24

### Added
- Initial release of `Log Server`.
- Ability to start and stop an HTTP log server.
- Logs displayed in a dedicated Webview with:
  - Word wrapping for long messages.
  - Color-coded log levels (`Info`, `Warn`, `Error`).
  - Autoscroll functionality.
- Status bar integration for quick device selection.
- Device filtering to view logs for a specific platform and device.
- Support for HTTP POST requests with a structured log payload.

## [0.0.2] - 2024-01-25

### Added
- Two buttons to start/stop the server and clear the logs.

### Changed
- Adjusted spacing after the last log entry.

## [0.0.3] - 2024-01-25

### Added
- Support for filtering logs by search query and log level.
- Support for copying log messages to the clipboard in json format.
- If the port is already in use, the extension will check the next 10 ports.
- Hotkeys inside the webview to select the device and toggle the toolbar.

### Changed
- Removed the clear logs button if the server is not running.
- The colors of the webview now adapt to the selected theme.
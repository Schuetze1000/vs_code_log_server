# 🌐 Log Server 🚀

Log Server is a Visual Studio Code extension that provides a lightweight 🌟 HTTP server to receive and display logs 📜 from a React Native app (or any other source that can send requests via HTTP) directly within VS Code. This extension is designed to streamline debugging 🔍 and improve development efficiency by centralizing logs in a dedicated view. 🎯

> 🎨 Icon credit: [svgrepo](https://www.svgrepo.com/svg/279075/log-wood)

---

## ✨ Features

- **🖥️ Log Server:** Start an HTTP server to receive logs from your React Native app.
- **📱 Device Filtering:** Filter logs by platform and device name.
- **🔍 Webview Log Display:** Logs are displayed in a clean, scrollable Webview with:
  - 📜 Word wrap for long messages.
  - 🎨 Color-coded log levels (Info, Warn, Error).
  - 🔄 Autoscroll functionality if you are at the end of the log list.
- **⚡ Quick Device Selection:** Choose a device from the status bar for filtering logs.
- **🔍 Search and Filter:** Search logs by query and filter by log level.
- **📋 Copy Logs:** Copy log messages to the clipboard in JSON format.

---

## 📋 Requirements

To use this extension:

1. ✅ Ensure your app can send logs as structured JSON payloads via HTTP POST requests.
   - Logs should be sent as a POST request to `http://<server_ip/localhost>:19000/logs`.
2. 📝 The log payload format must include:
   
```json
{
    "level": "Info|Warn|Error",
    "message": "Log message here",
    "platform": "iOS|Android",
    "device_name": "Device Name",
    "timestamp": "2023-01-01T12:00:00.000Z"
}
```

🛠️ Note: To check if the server is running, send a GET request to `http://<server_ip/localhost:19000/ping`.

---

## 🚀 Usage

### 🔍 Search / Filter
The syntax for searching and filtering logs is as follows:
- **Normal search:** Enter a search query to filter logs by message content.
- **Log level filter:** Use `Info:<query>`, `Warn:<query>`, or `Error:<query>` to filter logs by level and message content.

Inside the search input:
- `Enter` to keep the filter and close the search input.
- `Esc` to clear the filter and close the search input.

### ⌨️ Hotkeys
- **Webview/Panel:**
  - `Ctrl + F` to toggle the search input (Note: The filter will not be cleared).
  - `Ctrl + D` to select the device.

---

## ⚙️ Extension Settings

This extension currently does not expose any configurable settings. Future releases may include additional customization options. 🔧

---

## ⚠️ Known Issues

🚫 None

---

## 📝 Release Notes

### 🆕 0.0.1

- Initial release of Log Server. 🎉
- **Features:**
  - Start and stop log server. 🛑▶️
  - Display logs in a Webview with device filtering and autoscroll. 🔄
  - Status bar integration for quick device selection. 🖱️

### 🔧 0.0.2

- **Features:**
  - Added to view/title two buttons to start/stop the server and clear the logs. 🧹⏹️

- **Enhancements:**
  - Added more space after the last log entry. 📏

### 🆕 0.0.3

- **Features:**
  - Added support for filtering logs by search query and log level. 🔍
  - Added support for copying log messages to the clipboard in JSON format. 📋
  - If the port is already in use, the extension will check the next 10 ports before giving up. 🛑
  - New hotkeys inside the webview/panel.⚡
    - `Ctrl + F` to toggle search input.
    - `Ctrl + D` to select the device.
  - Hotkeys when the search input is focused. ⌨️
    - `Enter` to keep the filter and close the search input.
    - `Esc` to clear the filter and close the search input.
- **Enhancements:**
  - Removed the clear logs button if the server is not running. 🚫🧹
  - Improved visual styling of the webview/panel. The colors now adapt to the theme. 🎨
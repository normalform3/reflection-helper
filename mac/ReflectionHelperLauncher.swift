import AppKit
import UserNotifications
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
  private var window: NSWindow?
  private var webView: WKWebView?

  func applicationDidFinishLaunching(_ notification: Notification) {
    // Set app icon
    if let iconURL = Bundle.main.url(forResource: "AppIcon", withExtension: "icns"),
       let icon = NSImage(contentsOf: iconURL) {
      NSApplication.shared.applicationIconImage = icon
    }

    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .default()
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
    configuration.userContentController.add(self, name: "reflectionReminders")
    configuration.userContentController.add(self, name: "reflectionStorage")
    configuration.userContentController.addUserScript(NativeStorage.bootstrapScript())

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = self

    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
      styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
      backing: .buffered,
      defer: false
    )
    window.title = "Reflection Helper"
    window.titlebarAppearsTransparent = true
    window.isReleasedWhenClosed = false
    window.center()
    window.contentView = webView
    window.makeKeyAndOrderFront(nil)

    self.window = window
    self.webView = webView

    loadWebApp()
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    switch message.name {
    case "reflectionReminders":
      guard let reminders = message.body as? [String: [String: Any]] else { return }
      ReminderScheduler.sync(reminders: reminders)
    case "reflectionStorage":
      guard let json = message.body as? String else { return }
      do {
        try NativeStorage.save(json: json)
      } catch {
        notifyStorageFailure(error)
      }
    default:
      return
    }
  }

  private func loadWebApp() {
    guard let webView else { return }
    let fileManager = FileManager.default
    let resourceURL = Bundle.main.resourceURL?.appendingPathComponent("Web/index.html")
    let developmentURL = URL(fileURLWithPath: fileManager.currentDirectoryPath).appendingPathComponent("index.html")
    let indexURL = [resourceURL, developmentURL].compactMap { $0 }.first { fileManager.fileExists(atPath: $0.path) }

    guard let indexURL else {
      let html = "<main style='font:16px -apple-system;padding:32px'>Reflection Helper resources were not found.</main>"
      webView.loadHTMLString(html, baseURL: nil)
      return
    }

    webView.loadFileURL(indexURL, allowingReadAccessTo: indexURL.deletingLastPathComponent())
  }

  private func notifyStorageFailure(_ error: Error) {
    guard let webView else { return }
    let message = NativeStorage.javascriptLiteral("本地文件保存失败：\(error.localizedDescription)")
    let script = """
    window.dispatchEvent(new CustomEvent("reflection-storage-error", { detail: { message: \(message) } }));
    """
    DispatchQueue.main.async {
      webView.evaluateJavaScript(script)
    }
  }
}

enum NativeStorage {
  private static let appFolderName = "Reflection Helper"
  private static let fileName = "state.json"

  static func bootstrapScript() -> WKUserScript {
    let state = readStateJSON() ?? "null"
    let source = """
    window.__REFLECTION_HELPER_NATIVE_STORAGE__ = true;
    window.__REFLECTION_HELPER_NATIVE_STATE__ = \(state);
    """
    return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
  }

  static func save(json: String) throws {
    guard let data = json.data(using: .utf8) else {
      throw NativeStorageError.invalidEncoding
    }

    _ = try JSONSerialization.jsonObject(with: data)
    let directory = try storageDirectory()
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    try data.write(to: directory.appendingPathComponent(fileName), options: [.atomic])
  }

  static func javascriptLiteral(_ value: String) -> String {
    guard
      let data = try? JSONSerialization.data(withJSONObject: value),
      let literal = String(data: data, encoding: .utf8)
    else {
      return "\"\""
    }
    return literal
  }

  private static func readStateJSON() -> String? {
    guard
      let data = try? Data(contentsOf: storageFileURL()),
      (try? JSONSerialization.jsonObject(with: data)) != nil
    else {
      return nil
    }
    return String(data: data, encoding: .utf8)
  }

  private static func storageFileURL() -> URL {
    (try? storageDirectory().appendingPathComponent(fileName))
      ?? URL(fileURLWithPath: NSHomeDirectory())
        .appendingPathComponent("Library/Application Support")
        .appendingPathComponent(appFolderName)
        .appendingPathComponent(fileName)
  }

  private static func storageDirectory() throws -> URL {
    guard let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
      throw NativeStorageError.missingApplicationSupport
    }
    return applicationSupport.appendingPathComponent(appFolderName, isDirectory: true)
  }
}

enum NativeStorageError: LocalizedError {
  case missingApplicationSupport
  case invalidEncoding

  var errorDescription: String? {
    switch self {
    case .missingApplicationSupport:
      return "无法定位 Application Support 目录"
    case .invalidEncoding:
      return "状态数据不是有效的 UTF-8 文本"
    }
  }
}

enum ReminderScheduler {
  private static let prefix = "reflection-helper-reminder-"

  static func sync(reminders: [String: [String: Any]]) {
    let center = UNUserNotificationCenter.current()
    center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
      guard granted else { return }

      center.getPendingNotificationRequests { requests in
        let identifiers = requests.map(\.identifier).filter { $0.hasPrefix(prefix) }
        center.removePendingNotificationRequests(withIdentifiers: identifiers)

        reminders.forEach { type, reminder in
          guard (reminder["enabled"] as? Bool) == true,
            let time = reminder["time"] as? String
          else { return }

          schedule(type: type, time: time, day: reminder["day"] as? String, center: center)
        }
      }
    }
  }

  private static func schedule(type: String, time: String, day: String?, center: UNUserNotificationCenter) {
    let parts = time.split(separator: ":").compactMap { Int($0) }
    guard parts.count == 2 else { return }

    var components = DateComponents()
    components.hour = parts[0]
    components.minute = parts[1]

    switch type {
    case "weekly":
      components.weekday = (Int(day ?? "5") ?? 5) + 1
      addRequest(type: type, components: components, repeats: true, center: center)
    case "monthly":
      if day == "last" {
        let next = nextLastDay(hour: parts[0], minute: parts[1])
        addRequest(type: type, components: Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: next), repeats: false, center: center)
      } else {
        components.day = Int(day ?? "1") ?? 1
        addRequest(type: type, components: components, repeats: true, center: center)
      }
    default:
      addRequest(type: type, components: components, repeats: true, center: center)
    }
  }

  private static func addRequest(type: String, components: DateComponents, repeats: Bool, center: UNUserNotificationCenter) {
    let content = UNMutableNotificationContent()
    content.title = "该写\(label(for: type))了"
    content.body = "花几分钟给未来的自己留一点材料。"
    content.sound = .default

    let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: repeats)
    let request = UNNotificationRequest(identifier: "\(prefix)\(type)", content: content, trigger: trigger)
    center.add(request)
  }

  private static func nextLastDay(hour: Int, minute: Int) -> Date {
    let calendar = Calendar.current
    let now = Date()
    var components = calendar.dateComponents([.year, .month], from: now)
    components.month = (components.month ?? 1) + 1
    components.day = 0
    components.hour = hour
    components.minute = minute
    components.second = 0

    let candidate = calendar.date(from: components) ?? now
    if candidate > now { return candidate }

    var nextComponents = calendar.dateComponents([.year, .month], from: now)
    nextComponents.month = (nextComponents.month ?? 1) + 2
    nextComponents.day = 0
    nextComponents.hour = hour
    nextComponents.minute = minute
    nextComponents.second = 0
    return calendar.date(from: nextComponents) ?? now
  }

  private static func label(for type: String) -> String {
    switch type {
    case "weekly": return "周报"
    case "monthly": return "月报"
    default: return "日报"
    }
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.setActivationPolicy(.regular)
app.delegate = delegate
app.activate(ignoringOtherApps: true)
app.run()

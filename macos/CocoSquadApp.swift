import Cocoa
import WebKit

final class IslandPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    override func constrainFrameRect(_ frameRect: NSRect, to screen: NSScreen?) -> NSRect {
        return frameRect
    }
}

class DropView: NSView {
    weak var webView: WKWebView?

    override init(frame: NSRect) {
        super.init(frame: frame)
        registerForDraggedTypes([.fileURL, .string])
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        registerForDraggedTypes([.fileURL, .string])
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        return .copy
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        guard let urls = sender.draggingPasteboard.readObjects(forClasses: [NSURL.self], options: nil) as? [URL],
              let first = urls.first else {
            return false
        }
        let safeName = first.lastPathComponent.replacingOccurrences(of: "'", with: "\\'")
        let js = "window.__island ? window.__island.swallow('\(safeName)') : console.log('Island not ready');"
        webView?.evaluateJavaScript(js, completionHandler: nil)
        return true
    }
}

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var panel: IslandPanel!
    var webView: WKWebView!
    var statusItem: NSStatusItem!
    var isVisible = true

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupWindow()
        setupStatusItem()
    }

    func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.title = "🥥"
            button.toolTip = "Coco Squad"
        }

        let menu = NSMenu()
        let header = NSMenuItem(title: "Coco Squad · Isla Dinámica", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Abrir Isla", action: #selector(openIsland), keyEquivalent: "o"))
        menu.addItem(NSMenuItem(title: "Ocultar Isla", action: #selector(hideIsland), keyEquivalent: "h"))
        menu.addItem(NSMenuItem(title: "▶ Probar Devorado de Archivo", action: #selector(testDevour), keyEquivalent: "d"))
        menu.addItem(NSMenuItem(title: "Recargar", action: #selector(reloadApp), keyEquivalent: "r"))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Salir de Coco Squad", action: #selector(quitApp), keyEquivalent: "q"))

        statusItem.menu = menu
    }

    func setupWindow() {
        let screen = NSScreen.main ?? NSScreen.screens.first!
        let sf = screen.frame
        let panelW: CGFloat = 720
        let panelH: CGFloat = 320

        panel = IslandPanel(
            contentRect: NSRect(x: sf.midX - panelW / 2, y: (screen.visibleFrame.maxY) - panelH, width: panelW, height: panelH),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = false
        panel.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.mainMenuWindow)) + 3)
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        panel.hidesOnDeactivate = false
        panel.isMovableByWindowBackground = false

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")

        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: panelW, height: panelH), configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.autoresizingMask = [.width, .height]

        let dropView = DropView(frame: NSRect(x: 0, y: 0, width: panelW, height: panelH))
        dropView.webView = webView
        dropView.autoresizingMask = [.width, .height]

        panel.contentView = dropView
        dropView.addSubview(webView)

        loadWebBundle()
        panel.orderFrontRegardless()
    }

    func loadWebBundle() {
        var webDir: URL?
        if let resURL = Bundle.main.resourceURL?.appendingPathComponent("web"),
           FileManager.default.fileExists(atPath: resURL.path) {
            webDir = resURL
        } else {
            let devURL = URL(fileURLWithPath: "/Users/Gregorio/Desktop/coco squad/windows/dist")
            if FileManager.default.fileExists(atPath: devURL.path) {
                webDir = devURL
            }
        }

        guard let dir = webDir else {
            print("Error: web directory not found")
            return
        }

        let indexFile = dir.appendingPathComponent("index.html")
        webView.loadFileURL(indexFile, allowingReadAccessTo: dir)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let js = "setTimeout(() => { if(window.__island){ window.__island.wake(); window.__island.expand('overview'); } }, 150);"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    @objc func openIsland() {
        panel.orderFrontRegardless()
        isVisible = true
        let js = "if(window.__island){ window.__island.wake(); window.__island.expand('overview'); }"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    @objc func hideIsland() {
        let js = "if(window.__island){ window.__island.collapse(); }"
        webView.evaluateJavaScript(js) { [weak self] _, _ in
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                self?.panel.orderOut(nil)
                self?.isVisible = false
            }
        }
    }

    @objc func testDevour() {
        openIsland()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            let js = "if(window.__island){ window.__island.swallow('balance_anual.pdf'); }"
            self.webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    @objc func reloadApp() {
        loadWebBundle()
    }

    @objc func quitApp() {
        NSApp.terminate(nil)
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()

import Foundation

// MARK: - Pill category

enum PillCategory: String, CaseIterable {
    case workspace
    case agent
    case ai
    case service

    var title: String {
        switch self {
        case .workspace: return "Where you code"
        case .agent:     return "Agents"
        case .ai:        return "AI for the chat"
        case .service:   return "Services"
        }
    }
}

// MARK: - Pill definition

struct PillDefinition {
    let id:         String
    let name:       String
    let color:      String
    let category:   PillCategory
    /// Label shown next to the task name in the idle card header.
    let subtitle:   String
    let source:     AgentSource
    var comingSoon: Bool = false
    var githubOnly: Bool = false

    /// Label shown in the active-session card header (workspace/agent pills only).
    var sessionSubtitle: String {
        "Coco Squad"
    }
}

// MARK: - Catalog

enum PillCatalog {
    // All declared pills in display order.
    static let all: [PillDefinition] = [
        .init(id: "coco_blanco", name: "Coco Blanco", color: "#FFFFFF",
              category: .agent, subtitle: "Asistente general", source: .agent),
        .init(id: "coco_verde", name: "Coco Verde", color: "#10B981",
              category: .agent, subtitle: "Operaciones", source: .agent),
        .init(id: "coco_rojo", name: "Coco Rojo", color: "#EF4444",
              category: .agent, subtitle: "Investigación", source: .agent),
    ]

    /// Pills available in the current build target.
    static var available: [PillDefinition] {
        #if APPSTORE
        all.filter { !$0.githubOnly }
        #else
        all
        #endif
    }

    /// Default ID for the always-on main workspace pill.
    static let defaultMainPillId = "coco_blanco"

    /// Looks up a definition by task ID (nil if not in catalog).
    static func definition(for id: String) -> PillDefinition? {
        all.first { $0.id == id }
    }
}

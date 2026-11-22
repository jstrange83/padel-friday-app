import SwiftUI

let accent = Color(red: 0.83, green: 0.96, blue: 0.24)
let usColor = Color(red: 0.11, green: 0.39, blue: 0.65)
let themColor = Color(red: 0.15, green: 0.20, blue: 0.29)

@main
struct PadelWatchApp: App {
    @StateObject private var model = Model()
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            ContentView().environmentObject(model)
                .onAppear { model.start() }
                .onChange(of: phase) { p in if p == .active, model.screen == .state { model.loadState() } }
        }
    }
}

struct ContentView: View {
    @EnvironmentObject var m: Model
    var body: some View {
        switch m.screen {
        case .loading(let t): Text(t).font(.system(size: 15)).multilineTextAlignment(.center)
        case .code(let c): CodeView(code: c)
        case .state: StateView()
        case .count: CountView()
        case .save: SaveView()
        case .manual: ManualView()
        case .error(let t):
            ScrollView {
                VStack(spacing: 10) {
                    Text(t).font(.system(size: 14)).multilineTextAlignment(.center)
                    Button("Prøv igen") { m.start() }.tint(accent)
                }
            }
        }
    }
}

struct CodeView: View {
    @EnvironmentObject var m: Model
    let code: String
    var pretty: String { code.count == 6 ? String(code.prefix(3)) + " " + String(code.suffix(3)) : code }
    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text("Padelklubben").font(.system(size: 15, weight: .bold)).foregroundColor(accent)
                Text("Skriv koden i appen").font(.system(size: 13))
                Text(pretty).font(.system(size: 32, weight: .heavy, design: .rounded)).monospacedDigit()
                Text("Min padel → Indstillinger → ⌚ Ur").font(.system(size: 11)).foregroundColor(.gray).multilineTextAlignment(.center)
                Button("Ny kode") { m.unpair() }.padding(.top, 6)
            }
        }
    }
}

private func first(_ s: Any?) -> String { ((s as? String) ?? "").split(separator: " ").first.map(String.init) ?? "" }

struct StateView: View {
    @EnvironmentObject var m: Model
    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                if let mt = m.match {
                    Text("Runde \(mt["round"] as? Int ?? 0)\((mt["court"] as? String).map { " · " + $0 } ?? "")")
                        .font(.system(size: 16, weight: .bold)).foregroundColor(accent)
                    Text("Dig & " + first(mt["partner"])).font(.system(size: 15, weight: .semibold))
                    Text("mod").font(.system(size: 11)).foregroundColor(.gray)
                    Text(first(mt["opp1"]) + " & " + first(mt["opp2"])).font(.system(size: 15, weight: .semibold))
                    if (mt["status"] as? String) == "indtastet" {
                        Text("Venter på godkendelse: \(mt["score_mine"] as? Int ?? 0)–\(mt["score_them"] as? Int ?? 0)").font(.system(size: 11)).foregroundColor(accent)
                    }
                    Button("▶ Tæl point") { m.startCount() }.tint(accent).padding(.top, 4)
                    Button("Indtast resultat") { m.manual(mt["id"] as? String, mt["score_mine"] as? Int ?? 0, mt["score_them"] as? Int ?? 0) }
                } else if let ev = m.event {
                    Text((ev["title"] as? String) ?? "Spilledag").font(.system(size: 15, weight: .bold)).foregroundColor(accent)
                    Text((ev["done"] as? Bool) == true ? "Du har spillet alle dine kampe 🎉"
                         : (ev["status"] as? String) == "igang" ? "Du har ingen kamp lige nu" : "Du er tilmeldt. Dagsplanen kommer senere.")
                        .font(.system(size: 13)).multilineTextAlignment(.center)
                } else {
                    Text("Hej \((m.state["name"] as? String) ?? "")").font(.system(size: 15, weight: .bold)).foregroundColor(accent)
                    Text("Du er ikke tilmeldt nogen spilledage lige nu").font(.system(size: 13)).multilineTextAlignment(.center)
                }
                Button("↻ Opdater") { m.loadState() }
                Button("Golden point: " + (m.golden ? "Til" : "Fra")) { m.golden.toggle() }
                Button("Fjern uret fra appen") { m.unpair() }.font(.system(size: 12)).foregroundColor(.gray)
            }
        }
    }
}

struct CountView: View {
    @EnvironmentObject var m: Model
    var body: some View {
        if let s = m.score {
            ZStack {
                HStack(spacing: 0) {
                    half(s, true).background(usColor).onTapGesture { m.point(true) }
                    half(s, false).background(themColor).onTapGesture { m.point(false) }
                }
                VStack {
                    Text(m.timerText ?? (s.mode == "points" ? (s.total > 0 ? "Til \(s.total)" : "Point")
                                         : s.tiebreak ? "Tiebreak" : s.isDeuce ? (s.golden ? "Golden point" : "Lige") : "Partier"))
                        .font(.system(size: m.timerText != nil ? 15 : 12, weight: .bold)).monospacedDigit()
                        .foregroundColor(m.timerText != nil && (m.roundEnds.map { $0.timeIntervalSince(m.now) < 60 } ?? false) ? accent : .white)
                    Spacer()
                    HStack(spacing: 8) {
                        pill("✕") { m.stopCount() }
                        pill("↶", enabled: s.canUndo) { m.undo() }
                        pill("✓") { m.screen = .save }
                    }
                }.padding(.vertical, 4)
            }.ignoresSafeArea(edges: .bottom)
        }
    }

    func half(_ s: Score, _ mine: Bool) -> some View {
        VStack(spacing: 2) {
            if s.mode != "points" { Text("\(s.games(mine))").font(.system(size: 38, weight: .heavy)).monospacedDigit() }
            Text(s.pointLabel(mine)).font(.system(size: s.mode == "points" ? 42 : 22, weight: .bold)).foregroundColor(mine ? accent : .white).monospacedDigit()
            Text(mine ? "JER" : "DEM").font(.system(size: 11, weight: .bold)).foregroundColor(.gray)
        }.frame(maxWidth: .infinity, maxHeight: .infinity).contentShape(Rectangle())
    }

    func pill(_ t: String, enabled: Bool = true, _ action: @escaping () -> Void) -> some View {
        Button(action: action) { Text(t).font(.system(size: 16, weight: .bold)).frame(width: 34, height: 30) }
            .buttonStyle(.plain).background(Color.black.opacity(0.55)).clipShape(Capsule()).opacity(enabled ? 1 : 0.4).disabled(!enabled)
    }
}

struct SaveView: View {
    @EnvironmentObject var m: Model
    var body: some View {
        if let s = m.score, let id = m.scoreMatch {
            ScrollView {
                VStack(spacing: 6) {
                    Text(s.finished ? "Kampen er slut" : "Gem resultatet?").font(.system(size: 14, weight: .bold)).foregroundColor(accent)
                    Text("\(s.resultMine) – \(s.resultThem)").font(.system(size: 34, weight: .heavy)).monospacedDigit()
                    Text("Jer – Dem").font(.system(size: 11)).foregroundColor(.gray)
                    Button("Gem resultat") { m.report(id, s.resultMine, s.resultThem) }.tint(accent)
                    Button("Ret tallene") { m.manual(id, s.resultMine, s.resultThem) }
                    Button("Tilbage") { m.screen = .count }
                }
            }
        }
    }
}

struct ManualView: View {
    @EnvironmentObject var m: Model
    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text("Resultat").font(.system(size: 14, weight: .bold)).foregroundColor(accent)
                stepper("Jer", $m.manMine)
                stepper("Dem", $m.manThem)
                if let id = m.manMatch { Button("Gem \(m.manMine)–\(m.manThem)") { m.report(id, m.manMine, m.manThem) }.tint(accent) }
                Button("Tilbage") { m.screen = (m.score != nil && m.manMatch == m.scoreMatch) ? .count : .state }
            }
        }
    }
    func stepper(_ label: String, _ v: Binding<Int>) -> some View {
        HStack {
            Button("−") { v.wrappedValue = max(0, v.wrappedValue - 1) }.frame(width: 40)
            Text("\(label) \(v.wrappedValue)").font(.system(size: 17, weight: .bold)).frame(minWidth: 64).monospacedDigit()
            Button("+") { v.wrappedValue += 1 }.frame(width: 40)
        }
    }
}

import Foundation
import SwiftUI
import WatchKit

/// Urets tilstand: forbindelse til appen (kode), næste kamp, pointtælling og nedtælling.
@MainActor
final class Model: ObservableObject {
    enum Screen: Equatable { case loading(String), code(String), state, count, save, manual, error(String) }

    @Published var screen: Screen = .loading("Henter …")
    @Published var state: [String: Any] = [:]
    @Published var score: Score?
    @Published var manMine = 0
    @Published var manThem = 0
    @Published var now = Date()

    var scoreMatch: String?
    var manMatch: String?
    var roundEnds: Date?
    private var timeUpShown = false, minuteWarned = false
    private var pollTask: Task<Void, Never>?
    private var liveTask: Task<Void, Never>?
    private var ticker: Timer?
    private let d = UserDefaults.standard

    var secret: String? { d.string(forKey: "secret") }
    var golden: Bool { get { d.bool(forKey: "golden") } set { d.set(newValue, forKey: "golden"); objectWillChange.send() } }
    var match: [String: Any]? { state["match"] as? [String: Any] }
    var event: [String: Any]? { state["event"] as? [String: Any] }

    func start() { if secret == nil { newCode() } else { loadState() } }

    // ---------- Forbind uret ----------
    func newCode() {
        screen = .loading("Henter kode …")
        Task {
            do {
                let r = try await Api.rpc("padel_watch_start_v2", ["p_device": "Apple Watch " + WKInterfaceDevice.current().model])
                d.set(r["secret"] as? String, forKey: "secret")
                screen = .code((r["code"] as? String) ?? "")
                poll()
            } catch { screen = .error(msg(error)) }
        }
    }

    private func poll() {
        pollTask?.cancel()
        pollTask = Task {
            while !Task.isCancelled, case .code = screen, let s = secret {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                guard let r = try? await Api.rpc("padel_watch_poll_v2", ["p_secret": s]) else { continue }
                if r["gone"] as? Bool == true { d.removeObject(forKey: "secret"); newCode(); return }
                if r["paired"] as? Bool == true { WKInterfaceDevice.current().play(.success); loadState(); return }
            }
        }
    }

    // ---------- Næste kamp ----------
    func loadState() {
        guard let s = secret else { newCode(); return }
        if case .state = screen {} else if case .count = screen {} else { screen = .loading("Henter …") }
        Task {
            do {
                let r = try await Api.rpc("padel_watch_state_v2", ["p_secret": s])
                if r["paired"] as? Bool != true { d.removeObject(forKey: "secret"); newCode(); return }
                state = r
                if [.count, .save, .manual].contains(screen) { return }
                screen = .state
            } catch { if state.isEmpty { screen = .error(msg(error)) } else { screen = .state } }
        }
    }

    func unpair() { d.removeObject(forKey: "secret"); state = [:]; newCode() }

    // ---------- Tæl point ----------
    func startCount() {
        guard let m = match, let id = m["id"] as? String else { return }
        let max = m["max"] as? Int ?? 99
        let total = m["total"] as? Int ?? 0
        let mode = total > 0 ? "points" : max == 7 ? "set" : "games"
        if score == nil || scoreMatch != id {
            if let data = d.data(forKey: "score_" + id), let s = try? JSONDecoder().decode(Score.self, from: data) { score = s }
            else { score = Score(mode: mode, total: total, golden: golden) }
            scoreMatch = id; timeUpShown = false; minuteWarned = false
        }
        roundEnds = nil
        if let e = m["ends"] as? String { roundEnds = ISO8601DateFormatter.flexible(e) }
        screen = .count
        startTicker()
        queueLive() // meld kampen live med det samme (0–0)
    }

    func point(_ mine: Bool) {
        guard score != nil else { return }
        WKInterfaceDevice.current().play(.click)
        score!.point(mine)
        saveScore(); queueLive()
        if score!.finished { DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { self.screen = .save } }
    }

    func undo() { score?.undo(); saveScore(); queueLive() }
    func stopCount() { saveScore(); ticker?.invalidate(); screen = .loading("Henter …"); loadState() }

    private func saveScore() {
        guard let s = score, let id = scoreMatch, let data = try? JSONEncoder().encode(s) else { return }
        d.set(data, forKey: "score_" + id)
    }

    // Live-stilling: sendes kort efter hvert tryk (kun den nyeste), så appen og TV'et kan vise den
    private func queueLive() {
        liveTask?.cancel()
        liveTask = Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            while !Task.isCancelled {
                guard let s = score, let m = scoreMatch, let sec = secret else { return }
                do {
                    _ = try await Api.rpc("padel_watch_live_v2", ["p_secret": sec, "p_match": m, "p_gm": s.games(true), "p_gt": s.games(false),
                                                                   "p_pm": s.pointLabel(true), "p_pt": s.pointLabel(false), "p_mode": s.mode])
                    return
                } catch { try? await Task.sleep(nanoseconds: 8_000_000_000) } // intet net: prøv igen om lidt
            }
        }
    }

    // ---------- Nedtælling ved tidsspil ----------
    private func startTicker() {
        ticker?.invalidate()
        guard roundEnds != nil else { return }
        ticker = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        tick()
    }

    private func tick() {
        now = Date()
        guard let end = roundEnds, screen == .count else { return }
        let left = end.timeIntervalSince(now)
        if left <= 0 {
            if !timeUpShown {
                timeUpShown = true
                buzz()
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { if self.screen == .count { self.screen = .save } }
            }
            return
        }
        if left < 60 && left > 50 && !minuteWarned { minuteWarned = true; WKInterfaceDevice.current().play(.directionUp) }
    }

    var timerText: String? {
        guard let end = roundEnds else { return nil }
        let left = Int(end.timeIntervalSince(now))
        if left <= 0 { return "Tiden er gået" }
        return String(format: "⏱ %d:%02d", left / 60, left % 60)
    }

    // Tiden er gået: kraftig vibration flere gange (uret har ingen alarmlyd for apps)
    private func buzz() {
        let dev = WKInterfaceDevice.current()
        for i in 0..<4 { DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.7) { dev.play(.notification) } }
    }

    // ---------- Gem resultat ----------
    func manual(_ id: String?, _ mine: Int, _ them: Int) { manMatch = id; manMine = mine; manThem = them; screen = .manual }

    func report(_ id: String, _ mine: Int, _ them: Int) {
        guard let s = secret else { return }
        screen = .loading("Gemmer …")
        Task {
            do {
                _ = try await Api.rpc("padel_watch_report_v2", ["p_secret": s, "p_match": id, "p_mine": mine, "p_them": them])
                d.removeObject(forKey: "score_" + id)
                if id == scoreMatch { score = nil; scoreMatch = nil }
                ticker?.invalidate()
                WKInterfaceDevice.current().play(.success)
                screen = .loading("Resultatet er gemt ✓")
                try? await Task.sleep(nanoseconds: 900_000_000)
                loadState()
            } catch { screen = .error(msg(error)) }
        }
    }

    private func msg(_ e: Error) -> String { (e as? Api.Failure)?.message ?? "Ingen forbindelse. Tjek at uret har net." }
}

extension ISO8601DateFormatter {
    static func flexible(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s)
    }
}

import Foundation

/// Pointtælling under kampen (samme regler som Samsung-uret).
///  - "set":    0-15-30-40-parti, sæt til 6 (to i forskel), tiebreak ved 6-6 (til 7, to i forskel)
///  - "games":  0-15-30-40-parti, ingen sætslut (fx 30-minutters kampe)
///  - "points": hvert tryk er ét point (americano), slut når total er nået
/// Golden point: ved 40-40 afgør næste bold partiet.
struct Score: Codable {
    let mode: String
    let total: Int
    var golden: Bool
    var gm = 0, gt = 0, pm = 0, pt = 0
    var tiebreak = false
    private var history: [[Int]] = []

    init(mode: String, total: Int, golden: Bool) { self.mode = mode; self.total = total; self.golden = golden }

    var finished: Bool {
        if mode == "points" { return total > 0 && pm + pt >= total }
        if mode == "set" { return (max(gm, gt) >= 6 && abs(gm - gt) >= 2) || max(gm, gt) == 7 }
        return false
    }
    var canUndo: Bool { !history.isEmpty }

    mutating func undo() {
        guard let s = history.popLast() else { return }
        gm = s[0]; gt = s[1]; pm = s[2]; pt = s[3]; tiebreak = s[4] == 1
    }

    mutating func point(_ mine: Bool) {
        if finished { return }
        history.append([gm, gt, pm, pt, tiebreak ? 1 : 0])
        if history.count > 400 { history.removeFirst() }
        if mine { pm += 1 } else { pt += 1 }
        if mode == "points" { return }
        let a = mine ? pm : pt, b = mine ? pt : pm
        let won: Bool
        if tiebreak { won = a >= 7 && a - b >= 2 }
        else if golden { won = a >= 4 }
        else { won = a >= 4 && a - b >= 2 }
        if !won { return }
        if mine { gm += 1 } else { gt += 1 }
        pm = 0; pt = 0
        tiebreak = mode == "set" && gm == 6 && gt == 6
    }

    func pointLabel(_ mine: Bool) -> String {
        let a = mine ? pm : pt, b = mine ? pt : pm
        if mode == "points" || tiebreak { return String(a) }
        if a >= 3 && b >= 3 { return a > b ? "AD" : "40" }
        return ["0", "15", "30", "40"][min(a, 3)]
    }
    func games(_ mine: Bool) -> Int { mine ? gm : gt }
    var isDeuce: Bool { mode != "points" && !tiebreak && pm >= 3 && pt >= 3 && pm == pt }
    var resultMine: Int { mode == "points" ? pm : gm }
    var resultThem: Int { mode == "points" ? pt : gt }
}

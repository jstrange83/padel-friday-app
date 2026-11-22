import Foundation

/// Små kald til Padelklubbens database (kun funktionerne lavet til uret, padel_watch_*).
enum Api {
    static let base = "https://jlstsyvhlzsbqymwiyzx.supabase.co/rest/v1/rpc/"
    // Offentlig nøgle (samme som hjemmesiden bruger)
    static let key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsc3RzeXZobHpzYnF5bXdpeXp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMzA2MjIsImV4cCI6MjEwODcwNjYyMn0.-dK4dK7G9mxyZLYFB5vgze5Q8oB3T3KyJEiAcWIfS0o"

    struct Failure: LocalizedError { let message: String; var errorDescription: String? { message } }

    static func rpc(_ fn: String, _ body: [String: Any]) async throws -> [String: Any] {
        var r = URLRequest(url: URL(string: base + fn)!)
        r.httpMethod = "POST"
        r.timeoutInterval = 15
        r.setValue(key, forHTTPHeaderField: "apikey")
        r.setValue("Bearer " + key, forHTTPHeaderField: "Authorization")
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await URLSession.shared.data(for: r)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 500
        let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        if code >= 400 { throw Failure(message: (obj?["message"] as? String) ?? "Noget gik galt") }
        return obj ?? [:]
    }
}

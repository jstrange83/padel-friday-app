package dk.padelklubben.app.wear;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Små kald til Padelklubbens database (kun de funktioner, der er lavet til uret). */
public class Api {
    static final String URL_BASE = "https://jlstsyvhlzsbqymwiyzx.supabase.co/rest/v1/rpc/";
    // Offentlig nøgle (samme som hjemmesiden bruger). Uret kan kun kalde padel_watch_*-funktionerne.
    static final String KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsc3RzeXZobHpzYnF5bXdpeXp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMzA2MjIsImV4cCI6MjEwODcwNjYyMn0.-dK4dK7G9mxyZLYFB5vgze5Q8oB3T3KyJEiAcWIfS0o";

    public static class ApiError extends Exception {
        public ApiError(String m) { super(m); }
    }

    public static JSONObject rpc(String fn, JSONObject body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(URL_BASE + fn).openConnection();
        c.setRequestMethod("POST");
        c.setConnectTimeout(10000);
        c.setReadTimeout(15000);
        c.setDoOutput(true);
        c.setRequestProperty("apikey", KEY);
        c.setRequestProperty("Authorization", "Bearer " + KEY);
        c.setRequestProperty("Content-Type", "application/json");
        c.setRequestProperty("Accept", "application/json");
        try (OutputStream o = c.getOutputStream()) {
            o.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }
        int code = c.getResponseCode();
        String txt = read(code >= 400 ? c.getErrorStream() : c.getInputStream());
        c.disconnect();
        if (code >= 400) {
            String msg = "Noget gik galt";
            try { msg = new JSONObject(txt).optString("message", msg); } catch (Exception ignored) { }
            throw new ApiError(msg);
        }
        if (txt == null || txt.trim().isEmpty() || txt.trim().equals("null")) return new JSONObject();
        return new JSONObject(txt);
    }

    private static String read(InputStream in) throws Exception {
        if (in == null) return "";
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
        }
        return sb.toString();
    }
}

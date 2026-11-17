package dk.padelklubben.app.wear;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Padelklubben på uret.
 * 1) Forbind: uret viser en kode, som skrives i appen (Min padel → Indstillinger → Ur).
 * 2) Næste kamp: runde, bane, makker og modstandere.
 * 3) Tæl point: tryk på jeres eller deres halvdel, når en bold er vundet (0-15-30-40, partier og sæt).
 *    Når sættet er slut, gemmes resultatet med ét tryk.
 */
public class MainActivity extends Activity {
    static final int BG = Color.parseColor("#0c1b2a");
    static final int CARD = Color.parseColor("#16314b");
    static final int ACCENT = Color.parseColor("#d4f53c");
    static final int INK = Color.parseColor("#0c1b2a");
    static final int MUTED = Color.parseColor("#8ea6bd");
    static final int US = Color.parseColor("#2d4a14");
    static final int THEM = Color.parseColor("#1d3557");
    static final ZoneId CPH = ZoneId.of("Europe/Copenhagen");

    final ExecutorService io = Executors.newSingleThreadExecutor();
    final Handler ui = new Handler(Looper.getMainLooper());
    SharedPreferences prefs;
    JSONObject state;          // seneste svar fra padel_watch_state_v2
    Score score;               // igangværende tælling
    String scoreMatch;         // kampens id
    String screen = "";
    final Runnable poll = this::pollPairing;
    final Runnable refresh = this::loadState;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("padel", MODE_PRIVATE);
        getWindow().getDecorView().setBackgroundColor(BG);
    }

    @Override
    protected void onResume() {
        super.onResume();
        start();
    }

    @Override
    protected void onPause() {
        super.onPause();
        ui.removeCallbacks(poll);
        ui.removeCallbacks(refresh);
        saveScore();
    }

    void start() {
        String secret = prefs.getString("secret", null);
        if (secret == null) { newCode(); return; }
        if (!prefs.getBoolean("paired", false)) { showCode(prefs.getString("code", "")); pollPairing(); return; }
        if (screen.equals("count") && score != null) { showCount(); return; }
        showMessage("Henter …");
        loadState();
    }

    // ---------- Forbind ----------
    void newCode() {
        showMessage("Henter kode …");
        io.execute(() -> {
            try {
                JSONObject body = new JSONObject().put("p_device", Build.MANUFACTURER + " " + Build.MODEL);
                JSONObject r = Api.rpc("padel_watch_start_v2", body);
                prefs.edit().putString("secret", r.getString("secret")).putString("code", r.getString("code")).putBoolean("paired", false).apply();
                ui.post(() -> { showCode(r.optString("code")); ui.postDelayed(poll, 3000); });
            } catch (Exception e) {
                ui.post(() -> showError(e, this::newCode));
            }
        });
    }

    void showCode(String code) {
        screen = "code";
        LinearLayout l = column();
        l.addView(text("Padelklubben", 15, ACCENT, true));
        l.addView(space(6));
        l.addView(text("Skriv koden i appen", 13, Color.WHITE, false));
        String c = code.length() == 6 ? code.substring(0, 3) + " " + code.substring(3) : code;
        TextView big = text(c, 34, Color.WHITE, true);
        big.setLetterSpacing(0.08f);
        l.addView(big);
        l.addView(text("Min padel → Indstillinger → ⌚ Ur", 11, MUTED, false));
        l.addView(space(10));
        l.addView(button("Ny kode", false, v -> { prefs.edit().remove("secret").apply(); newCode(); }));
        setScreen(l);
    }

    void pollPairing() {
        String secret = prefs.getString("secret", null);
        if (secret == null || !screen.equals("code")) return;
        io.execute(() -> {
            try {
                JSONObject r = Api.rpc("padel_watch_poll_v2", new JSONObject().put("p_secret", secret));
                ui.post(() -> {
                    if (r.optBoolean("gone")) { prefs.edit().remove("secret").apply(); newCode(); return; }
                    if (r.optBoolean("paired")) {
                        prefs.edit().putBoolean("paired", true).apply();
                        Toast.makeText(this, "Hej " + r.optString("name") + "!", Toast.LENGTH_SHORT).show();
                        showMessage("Henter …");
                        loadState();
                    } else ui.postDelayed(poll, 3000);
                });
            } catch (Exception e) {
                ui.postDelayed(poll, 6000);
            }
        });
    }

    // ---------- Næste kamp ----------
    void loadState() {
        String secret = prefs.getString("secret", null);
        if (secret == null) { newCode(); return; }
        io.execute(() -> {
            try {
                JSONObject r = Api.rpc("padel_watch_state_v2", new JSONObject().put("p_secret", secret));
                ui.post(() -> {
                    if (!r.optBoolean("paired")) { prefs.edit().remove("secret").putBoolean("paired", false).apply(); newCode(); return; }
                    state = r;
                    if (!screen.equals("count") && !screen.equals("manual") && !screen.equals("save")) showState();
                });
            } catch (Exception e) {
                ui.post(() -> { if (state != null) showState(); else showError(e, this::loadState); });
            }
        });
    }

    void showState() {
        screen = "state";
        ui.removeCallbacks(refresh);
        ui.postDelayed(refresh, 30000);
        LinearLayout l = column();
        JSONObject ev = state.optJSONObject("event");
        JSONObject m = state.optJSONObject("match");
        if (m != null) {
            l.addView(text("Runde " + m.optInt("round") + (m.isNull("court") ? "" : " · " + m.optString("court")), 18, ACCENT, true));
            String at = m.isNull("at") ? "" : "ca. " + time(m.optString("at"));
            if (!at.isEmpty()) l.addView(text(at, 12, MUTED, false));
            l.addView(space(6));
            l.addView(text("Dig & " + first(m.optString("partner")), 15, Color.WHITE, true));
            l.addView(text("mod", 11, MUTED, false));
            l.addView(text(first(m.optString("opp1")) + " & " + first(m.optString("opp2")), 15, Color.WHITE, true));
            if ("indtastet".equals(m.optString("status")))
                l.addView(text("Venter på godkendelse: " + m.optInt("score_mine") + "–" + m.optInt("score_them"), 11, ACCENT, false));
            l.addView(space(8));
            l.addView(button("▶ Tæl point", true, v -> startCount(m)));
            l.addView(button("Indtast resultat", false, v -> showManual(m, m.optInt("score_mine", 0), m.optInt("score_them", 0))));
        } else if (ev != null) {
            l.addView(text(ev.optString("title"), 15, ACCENT, true));
            l.addView(text(dateTime(ev.optString("starts_at")), 13, Color.WHITE, false));
            if (!ev.isNull("center")) l.addView(text(ev.optString("center"), 12, MUTED, false));
            l.addView(space(6));
            String why = ev.optBoolean("done") ? "Du har spillet alle dine kampe 🎉"
                : "igang".equals(ev.optString("status")) ? "Du har ingen kamp lige nu" : "Du er tilmeldt. Dagsplanen kommer senere.";
            l.addView(text(why, 12, Color.WHITE, false));
        } else {
            l.addView(text("Hej " + state.optString("name"), 15, ACCENT, true));
            l.addView(text("Du er ikke tilmeldt nogen spilledage lige nu", 12, Color.WHITE, false));
        }
        l.addView(space(8));
        l.addView(button("↻ Opdater", false, v -> { showMessage("Henter …"); loadState(); }));
        l.addView(button("Golden point: " + (prefs.getBoolean("golden", false) ? "Til" : "Fra"), false, v -> {
            prefs.edit().putBoolean("golden", !prefs.getBoolean("golden", false)).apply(); showState();
        }));
        TextView out = text("Fjern uret fra appen", 11, MUTED, false);
        out.setPadding(0, dp(8), 0, dp(4));
        out.setOnClickListener(v -> { prefs.edit().clear().apply(); state = null; newCode(); });
        l.addView(out);
        setScreen(l);
    }

    // ---------- Tæl point ----------
    void startCount(JSONObject m) {
        String id = m.optString("id");
        int max = m.optInt("max", 99);
        int total = m.isNull("total") ? 0 : m.optInt("total", 0);
        String mode = total > 0 ? "points" : max == 7 ? "set" : "games";
        if (score == null || !id.equals(scoreMatch)) {
            score = new Score(mode, total, prefs.getBoolean("golden", false));
            scoreMatch = id;
            score.load(prefs.getString("score_" + id, null));
            timeUpShown = false;
        }
        // Tidsspil: rundens sluttidspunkt, så uret kan tælle ned
        roundEnds = 0;
        if (!m.isNull("ends")) {
            try { roundEnds = OffsetDateTime.parse(m.optString("ends")).toInstant().toEpochMilli(); } catch (Exception ignored) { }
        }
        showCount();
    }

    void showCount() {
        screen = "count";
        ui.removeCallbacks(refresh);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        FrameLayout root = new FrameLayout(this);
        LinearLayout halves = new LinearLayout(this);
        halves.setOrientation(LinearLayout.HORIZONTAL);
        halves.addView(half(true), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1));
        halves.addView(half(false), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1));
        root.addView(halves, new FrameLayout.LayoutParams(-1, -1));

        String top = score.mode.equals("points") ? (score.total > 0 ? "Til " + score.total : "Point")
            : score.isTiebreak() ? "Tiebreak" : score.isDeuce() ? (score.golden ? "Golden point" : "Lige") : "Partier";
        TextView t = text(top, 12, Color.WHITE, true);
        FrameLayout.LayoutParams tp = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        tp.topMargin = dp(14);
        root.addView(t, tp);
        timerView = null;
        if (roundEnds > 0) {
            timerView = t;
            t.setTextSize(15);
            ui.removeCallbacks(tick);
            tick.run();
        }

        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER);
        TextView undo = pill("↶", score.canUndo());
        undo.setOnClickListener(v -> { if (score.canUndo()) { score.undo(); saveScore(); queueLive(); showCount(); } });
        TextView done = pill("✓", true);
        done.setOnClickListener(v -> showSave());
        TextView back = pill("✕", true);
        back.setOnClickListener(v -> { saveScore(); getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); showMessage("Henter …"); screen = ""; loadState(); });
        bar.addView(back); bar.addView(undo); bar.addView(done);
        FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        bp.bottomMargin = dp(12);
        root.addView(bar, bp);
        setContentView(root);
        if (score.finished()) ui.postDelayed(this::showSave, 400);
    }

    View half(boolean mine) {
        LinearLayout h = new LinearLayout(this);
        h.setOrientation(LinearLayout.VERTICAL);
        h.setGravity(Gravity.CENTER);
        h.setBackgroundColor(mine ? US : THEM);
        if (!score.mode.equals("points")) h.addView(text(String.valueOf(score.games(mine)), 40, Color.WHITE, true));
        TextView p = text(score.pointLabel(mine), score.mode.equals("points") ? 44 : 22, mine ? ACCENT : Color.WHITE, true);
        h.addView(p);
        h.addView(text(mine ? "JER" : "DEM", 11, MUTED, true));
        h.setOnClickListener(v -> {
            v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
            score.point(mine);
            saveScore();
            queueLive();
            showCount();
        });
        return h;
    }

    // ---------- Nedtælling ved tidsspil ----------
    long roundEnds = 0;
    boolean timeUpShown = false;
    TextView timerView;
    final Runnable tick = new Runnable() {
        @Override public void run() {
            if (timerView == null || !screen.equals("count") || roundEnds <= 0) return;
            long left = roundEnds - System.currentTimeMillis();
            if (left <= 0) {
                timerView.setText("Tiden er gået");
                timerView.setTextColor(ACCENT);
                if (!timeUpShown) {
                    timeUpShown = true;
                    buzz();
                    ui.postDelayed(MainActivity.this::showSave, 1200);
                }
                return;
            }
            long sec = left / 1000;
            timerView.setText(String.format(Locale.ROOT, "⏱ %d:%02d", sec / 60, sec % 60));
            timerView.setTextColor(sec <= 60 ? ACCENT : Color.WHITE);
            ui.postDelayed(this, 1000);
        }
    };

    void buzz() {
        try {
            android.os.Vibrator v = (android.os.Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null) v.vibrate(android.os.VibrationEffect.createWaveform(new long[]{0, 400, 200, 400, 200, 600}, -1));
        } catch (Exception ignored) { }
    }

    void saveScore() {
        if (score != null && scoreMatch != null) prefs.edit().putString("score_" + scoreMatch, score.save()).apply();
    }

    // Live-stilling: sendes kort efter hvert tryk (kun den nyeste), så appen og TV'et kan vise den
    final Runnable sendLive = this::pushLive;

    void queueLive() {
        ui.removeCallbacks(sendLive);
        ui.postDelayed(sendLive, 400);
    }

    void pushLive() {
        if (score == null || scoreMatch == null) return;
        String secret = prefs.getString("secret", null);
        if (secret == null) return;
        final String match = scoreMatch;
        final int gm = score.games(true), gt = score.games(false);
        final String pm = score.pointLabel(true), pt = score.pointLabel(false), mode = score.mode;
        io.execute(() -> {
            try {
                Api.rpc("padel_watch_live_v2", new JSONObject().put("p_secret", secret).put("p_match", match)
                    .put("p_gm", gm).put("p_gt", gt).put("p_pm", pm).put("p_pt", pt).put("p_mode", mode));
            } catch (Exception e) {
                // Intet net lige nu: prøv igen om lidt med den nyeste stilling
                ui.removeCallbacks(sendLive);
                ui.postDelayed(sendLive, 8000);
            }
        });
    }

    void showSave() {
        if (score == null) return;
        screen = "save";
        LinearLayout l = column();
        l.addView(text(score.finished() ? "Kampen er slut" : "Gem resultatet?", 14, ACCENT, true));
        l.addView(text(score.resultMine() + " – " + score.resultThem(), 36, Color.WHITE, true));
        l.addView(text("Jer – Dem", 11, MUTED, false));
        l.addView(space(8));
        l.addView(button("Gem resultat", true, v -> report(scoreMatch, score.resultMine(), score.resultThem())));
        l.addView(button("Ret tallene", false, v -> showManualFor(scoreMatch, score.resultMine(), score.resultThem())));
        l.addView(button("Tilbage", false, v -> showCount()));
        setScreen(l);
    }

    // ---------- Indtast resultat med + og − ----------
    int manMine, manThem;
    String manMatch;

    void showManual(JSONObject m, int mine, int them) { showManualFor(m.optString("id"), mine, them); }

    void showManualFor(String id, int mine, int them) {
        screen = "manual";
        manMatch = id; manMine = mine; manThem = them;
        drawManual();
    }

    void drawManual() {
        LinearLayout l = column();
        l.addView(text("Resultat", 14, ACCENT, true));
        l.addView(stepper("Jer", true));
        l.addView(stepper("Dem", false));
        l.addView(space(6));
        l.addView(button("Gem " + manMine + "–" + manThem, true, v -> report(manMatch, manMine, manThem)));
        l.addView(button("Tilbage", false, v -> { screen = ""; if (score != null && manMatch.equals(scoreMatch)) showCount(); else showState(); }));
        setScreen(l);
    }

    View stepper(String label, boolean mine) {
        LinearLayout r = new LinearLayout(this);
        r.setGravity(Gravity.CENTER);
        r.setPadding(0, dp(4), 0, dp(4));
        TextView minus = pill("−", true);
        minus.setOnClickListener(v -> { if (mine) manMine = Math.max(0, manMine - 1); else manThem = Math.max(0, manThem - 1); drawManual(); });
        TextView plus = pill("+", true);
        plus.setOnClickListener(v -> { if (mine) manMine++; else manThem++; drawManual(); });
        TextView val = text(label + " " + (mine ? manMine : manThem), 18, Color.WHITE, true);
        val.setMinWidth(dp(70));
        r.addView(minus); r.addView(val); r.addView(plus);
        return r;
    }

    void report(String matchId, int mine, int them) {
        String secret = prefs.getString("secret", null);
        showMessage("Gemmer …");
        io.execute(() -> {
            try {
                Api.rpc("padel_watch_report_v2", new JSONObject().put("p_secret", secret).put("p_match", matchId).put("p_mine", mine).put("p_them", them));
                ui.post(() -> {
                    prefs.edit().remove("score_" + matchId).apply();
                    if (matchId.equals(scoreMatch)) { score = null; scoreMatch = null; }
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    Toast.makeText(this, "Resultatet er gemt ✓", Toast.LENGTH_SHORT).show();
                    screen = "";
                    loadState();
                });
            } catch (Exception e) {
                ui.post(() -> showError(e, () -> report(matchId, mine, them)));
            }
        });
    }

    // ---------- Små byggeklodser ----------
    void showMessage(String msg) {
        LinearLayout l = column();
        l.addView(text(msg, 14, Color.WHITE, false));
        setScreen(l);
    }

    void showError(Exception e, Runnable retry) {
        String msg = e instanceof Api.ApiError ? e.getMessage() : "Ingen forbindelse. Tjek at uret har net.";
        LinearLayout l = column();
        l.addView(text(msg, 13, Color.WHITE, false));
        l.addView(space(8));
        l.addView(button("Prøv igen", true, v -> retry.run()));
        if (state != null) l.addView(button("Tilbage", false, v -> showState()));
        setScreen(l);
    }

    LinearLayout column() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setGravity(Gravity.CENTER_HORIZONTAL);
        int side = (int) (getResources().getDisplayMetrics().widthPixels * 0.12);
        l.setPadding(side, dp(26), side, dp(30));
        return l;
    }

    void setScreen(LinearLayout content) {
        ScrollView sv = new ScrollView(this);
        sv.setFillViewport(true);
        sv.setBackgroundColor(BG);
        content.setMinimumHeight(getResources().getDisplayMetrics().heightPixels);
        content.setGravity(Gravity.CENTER);
        sv.addView(content);
        setContentView(sv);
        sv.requestFocus();
    }

    TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    TextView button(String s, boolean primary, View.OnClickListener click) {
        TextView b = text(s, 14, primary ? INK : Color.WHITE, true);
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(24));
        bg.setColor(primary ? ACCENT : CARD);
        b.setBackground(bg);
        b.setPadding(dp(14), dp(10), dp(14), dp(10));
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.topMargin = dp(6);
        b.setLayoutParams(p);
        b.setOnClickListener(click);
        return b;
    }

    TextView pill(String s, boolean enabled) {
        TextView b = text(s, 18, enabled ? Color.WHITE : MUTED, true);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.parseColor("#cc0c1b2a"));
        b.setBackground(bg);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(dp(40), dp(40));
        p.leftMargin = dp(4); p.rightMargin = dp(4);
        b.setLayoutParams(p);
        return b;
    }

    View space(int dp) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, dp(dp)));
        return v;
    }

    int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    static String first(String name) {
        if (name == null || name.isEmpty() || name.equals("null")) return "?";
        return name.trim().split("\\s+")[0];
    }

    static String time(String iso) {
        try { return OffsetDateTime.parse(iso).atZoneSameInstant(CPH).format(DateTimeFormatter.ofPattern("HH.mm")); }
        catch (Exception e) { return ""; }
    }

    static String dateTime(String iso) {
        try {
            String s = OffsetDateTime.parse(iso).atZoneSameInstant(CPH).format(DateTimeFormatter.ofPattern("EEEE d. MMMM 'kl.' HH.mm", new Locale("da", "DK")));
            return s.substring(0, 1).toUpperCase(new Locale("da", "DK")) + s.substring(1);
        } catch (Exception e) { return ""; }
    }
}

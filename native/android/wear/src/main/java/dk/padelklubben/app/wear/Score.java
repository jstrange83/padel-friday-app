package dk.padelklubben.app.wear;

import java.util.ArrayList;

/**
 * Pointtælling under kampen.
 *  - "set":    0-15-30-40-parti, sæt til 6 (to i forskel), tiebreak ved 6-6 (til 7, to i forskel)
 *  - "games":  0-15-30-40-parti, ingen sætslut (fx 30-minutters kampe)
 *  - "points": hvert tryk er ét point (americano), slut når total er nået
 * Golden point: ved 40-40 afgør næste bold partiet.
 */
public class Score {
    public final String mode;
    public final int total;
    public boolean golden;
    int gm, gt, pm, pt;          // partier og point (mine/them)
    boolean tiebreak;
    private final ArrayList<int[]> history = new ArrayList<>();

    public Score(String mode, int total, boolean golden) {
        this.mode = mode; this.total = total; this.golden = golden;
    }

    private int[] snap() { return new int[]{gm, gt, pm, pt, tiebreak ? 1 : 0}; }
    private void restore(int[] s) { gm = s[0]; gt = s[1]; pm = s[2]; pt = s[3]; tiebreak = s[4] == 1; }

    public boolean finished() {
        if (mode.equals("points")) return total > 0 && pm + pt >= total;
        if (mode.equals("set")) return (Math.max(gm, gt) >= 6 && Math.abs(gm - gt) >= 2) || Math.max(gm, gt) == 7;
        return false;
    }

    public boolean canUndo() { return !history.isEmpty(); }
    public void undo() { if (!history.isEmpty()) restore(history.remove(history.size() - 1)); }

    public void point(boolean mine) {
        if (finished()) return;
        history.add(snap());
        if (history.size() > 400) history.remove(0);
        if (mine) pm++; else pt++;
        if (mode.equals("points")) return;
        int a = mine ? pm : pt, b = mine ? pt : pm;
        boolean won;
        if (tiebreak) won = a >= 7 && a - b >= 2;
        else if (golden) won = a >= 4;
        else won = a >= 4 && a - b >= 2;
        if (!won) return;
        if (mine) gm++; else gt++;
        pm = 0; pt = 0;
        tiebreak = mode.equals("set") && gm == 6 && gt == 6;
    }

    /** Pointvisning for en side: 0, 15, 30, 40, AD (eller tal i tiebreak og americano) */
    public String pointLabel(boolean mine) {
        int a = mine ? pm : pt, b = mine ? pt : pm;
        if (mode.equals("points") || tiebreak) return String.valueOf(a);
        if (a >= 3 && b >= 3) return a > b ? "AD" : "40";
        return new String[]{"0", "15", "30", "40"}[Math.min(a, 3)];
    }

    public int games(boolean mine) { return mine ? gm : gt; }
    public int points(boolean mine) { return mine ? pm : pt; }
    public boolean isTiebreak() { return tiebreak; }
    public boolean isDeuce() { return !mode.equals("points") && !tiebreak && pm >= 3 && pt >= 3 && pm == pt; }

    /** Resultatet der gemmes: partier, eller point i americano */
    public int resultMine() { return mode.equals("points") ? pm : gm; }
    public int resultThem() { return mode.equals("points") ? pt : gt; }

    public String save() {
        StringBuilder s = new StringBuilder();
        s.append(gm).append(',').append(gt).append(',').append(pm).append(',').append(pt).append(',').append(tiebreak ? 1 : 0).append(',').append(golden ? 1 : 0);
        for (int[] h : history) s.append(';').append(h[0]).append(',').append(h[1]).append(',').append(h[2]).append(',').append(h[3]).append(',').append(h[4]);
        return s.toString();
    }

    public void load(String str) {
        if (str == null || str.isEmpty()) return;
        try {
            String[] parts = str.split(";");
            String[] c = parts[0].split(",");
            gm = Integer.parseInt(c[0]); gt = Integer.parseInt(c[1]); pm = Integer.parseInt(c[2]); pt = Integer.parseInt(c[3]);
            tiebreak = c[4].equals("1"); if (c.length > 5) golden = c[5].equals("1");
            history.clear();
            for (int i = 1; i < parts.length; i++) {
                String[] h = parts[i].split(",");
                history.add(new int[]{Integer.parseInt(h[0]), Integer.parseInt(h[1]), Integer.parseInt(h[2]), Integer.parseInt(h[3]), Integer.parseInt(h[4])});
            }
        } catch (Exception e) { gm = gt = pm = pt = 0; tiebreak = false; history.clear(); }
    }
}

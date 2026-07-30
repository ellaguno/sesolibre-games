package com.sesolibre.playgames;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.text.TextUtils;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.AnnotatedData;
import com.google.android.gms.games.LeaderboardsClient;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.Player;
import com.google.android.gms.games.leaderboard.Leaderboard;
import com.google.android.gms.games.leaderboard.LeaderboardScore;
import com.google.android.gms.games.leaderboard.LeaderboardScoreBuffer;
import com.google.android.gms.games.leaderboard.LeaderboardVariant;

/**
 * Puente con Google Play Juegos (Play Games Services v2).
 *
 * Además de lo habitual (iniciar sesión y enviar puntuaciones) expone
 * {@code loadTopScores}, que devuelve la tabla de clasificación como datos para
 * poder pintarla dentro de la app en vez de abrir la pantalla de Google.
 *
 * Todo se ejecuta en el hilo de UI: los clientes de Play Juegos cuelgan de la
 * Activity y algunas llamadas abren pantallas.
 */
@CapacitorPlugin(name = "PlayGames")
public class PlayGamesPlugin extends Plugin {

    /** Máximo que acepta la API de Play Juegos en una sola petición. */
    private static final int MAX_RESULTS_LIMIT = 25;

    private boolean initialized = false;

    // ---------------------------------------------------------------- estado

    /** ¿Hay un id de proyecto de Play Juegos configurado en la app? */
    private boolean isConfigured() {
        String id = appId();
        return id != null && !TextUtils.isEmpty(id) && !"0".equals(id.trim());
    }

    private String appId() {
        try {
            int res = getContext()
                .getResources()
                .getIdentifier("game_services_project_id", "string", getContext().getPackageName());
            return res == 0 ? null : getContext().getString(res);
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", isConfigured());
        call.resolve(ret);
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        if (!isConfigured()) {
            call.reject("Play Juegos no está configurado (falta game_services_project_id)", "not_configured");
            return;
        }
        getActivity()
            .runOnUiThread(() -> {
                try {
                    if (!initialized) {
                        PlayGamesSdk.initialize(getContext());
                        initialized = true;
                    }
                    call.resolve();
                } catch (Exception e) {
                    call.reject(message(e), e);
                }
            });
    }

    // -------------------------------------------------------------- sesión

    @PluginMethod
    public void signIn(final PluginCall call) {
        final boolean silent = Boolean.TRUE.equals(call.getBoolean("silent", true));
        run(call, activity -> {
            if (silent) {
                PlayGames
                    .getGamesSignInClient(activity)
                    .isAuthenticated()
                    .addOnCompleteListener(task -> {
                        boolean ok = task.isSuccessful() && task.getResult() != null && task.getResult().isAuthenticated();
                        if (ok) resolveWithPlayer(call, activity);
                        else call.resolve(signedOut());
                    });
            } else {
                PlayGames
                    .getGamesSignInClient(activity)
                    .signIn()
                    .addOnCompleteListener(task -> {
                        boolean ok = task.isSuccessful() && task.getResult() != null && task.getResult().isAuthenticated();
                        if (ok) resolveWithPlayer(call, activity);
                        else call.resolve(signedOut());
                    });
            }
        });
    }

    @PluginMethod
    public void isSignedIn(final PluginCall call) {
        run(call, activity ->
            PlayGames
                .getGamesSignInClient(activity)
                .isAuthenticated()
                .addOnCompleteListener(task -> {
                    JSObject ret = new JSObject();
                    ret.put(
                        "signedIn",
                        task.isSuccessful() && task.getResult() != null && task.getResult().isAuthenticated()
                    );
                    call.resolve(ret);
                })
        );
    }

    @PluginMethod
    public void getPlayer(final PluginCall call) {
        run(call, activity -> resolveWithPlayer(call, activity));
    }

    private JSObject signedOut() {
        JSObject ret = new JSObject();
        ret.put("signedIn", false);
        return ret;
    }

    private void resolveWithPlayer(final PluginCall call, Activity activity) {
        PlayGames
            .getPlayersClient(activity)
            .getCurrentPlayer()
            .addOnSuccessListener(player -> {
                JSObject ret = new JSObject();
                ret.put("signedIn", true);
                ret.put("player", playerToJs(player));
                call.resolve(ret);
            })
            .addOnFailureListener(e -> call.reject(message(e), e));
    }

    private JSObject playerToJs(Player player) {
        JSObject js = new JSObject();
        if (player == null) return js;
        js.put("playerId", player.getPlayerId());
        js.put("displayName", player.getDisplayName());
        Uri icon = player.getIconImageUri();
        if (icon != null) js.put("avatarUrl", icon.toString());
        return js;
    }

    // --------------------------------------------------------- puntuaciones

    @PluginMethod
    public void submitScore(final PluginCall call) {
        final String leaderboardId = call.getString("leaderboardId");
        if (TextUtils.isEmpty(leaderboardId)) {
            call.reject("Falta leaderboardId", "bad_request");
            return;
        }
        final Integer score = call.getInt("score");
        if (score == null) {
            call.reject("Falta score", "bad_request");
            return;
        }
        run(call, activity -> {
            // submitScore (a diferencia de submitScoreImmediate) encola la
            // puntuación si no hay red y la envía cuando la haya.
            PlayGames.getLeaderboardsClient(activity).submitScore(leaderboardId, score.longValue());
            call.resolve();
        });
    }

    @PluginMethod
    public void loadTopScores(final PluginCall call) {
        final String leaderboardId = call.getString("leaderboardId");
        if (TextUtils.isEmpty(leaderboardId)) {
            call.reject("Falta leaderboardId", "bad_request");
            return;
        }
        final int max = Math.max(1, Math.min(MAX_RESULTS_LIMIT, call.getInt("maxResults", 10)));
        final int span = timeSpan(call.getString("timeSpan", "all"));
        final int collection = collection(call.getString("collection", "public"));
        final boolean forceReload = Boolean.TRUE.equals(call.getBoolean("forceReload", false));

        run(call, activity ->
            PlayGames
                .getLeaderboardsClient(activity)
                .loadTopScores(leaderboardId, span, collection, max, forceReload)
                .addOnSuccessListener(data -> call.resolve(scoresToJs(data)))
                .addOnFailureListener(e -> call.reject(message(e), e))
        );
    }

    @PluginMethod
    public void loadPlayerScore(final PluginCall call) {
        final String leaderboardId = call.getString("leaderboardId");
        if (TextUtils.isEmpty(leaderboardId)) {
            call.reject("Falta leaderboardId", "bad_request");
            return;
        }
        final int span = timeSpan(call.getString("timeSpan", "all"));
        final int collection = collection(call.getString("collection", "public"));

        run(call, activity ->
            PlayGames
                .getLeaderboardsClient(activity)
                .loadCurrentPlayerLeaderboardScore(leaderboardId, span, collection)
                .addOnSuccessListener(data -> {
                    JSObject ret = new JSObject();
                    LeaderboardScore score = data == null ? null : data.get();
                    ret.put("entry", score == null ? null : scoreToJs(score));
                    call.resolve(ret);
                })
                .addOnFailureListener(e -> call.reject(message(e), e))
        );
    }

    private JSObject scoresToJs(AnnotatedData<LeaderboardsClient.LeaderboardScores> data) {
        JSObject ret = new JSObject();
        JSArray entries = new JSArray();
        LeaderboardsClient.LeaderboardScores scores = data == null ? null : data.get();
        if (scores != null) {
            Leaderboard board = scores.getLeaderboard();
            if (board != null) ret.put("title", board.getDisplayName());
            LeaderboardScoreBuffer buffer = scores.getScores();
            if (buffer != null) {
                for (LeaderboardScore score : buffer) {
                    entries.put(scoreToJs(score));
                }
            }
            // El buffer apunta a memoria nativa: hay que soltarlo tras copiar.
            scores.release();
        }
        ret.put("entries", entries);
        ret.put("stale", data != null && data.isStale());
        return ret;
    }

    private JSObject scoreToJs(LeaderboardScore score) {
        JSObject js = new JSObject();
        js.put("rank", score.getRank());
        js.put("displayRank", score.getDisplayRank());
        js.put("score", score.getRawScore());
        js.put("displayScore", score.getDisplayScore());
        js.put("displayName", score.getScoreHolderDisplayName());
        js.put("timestamp", score.getTimestampMillis());
        Uri icon = score.getScoreHolderIconImageUri();
        if (icon != null) js.put("avatarUrl", icon.toString());
        Player holder = score.getScoreHolder();
        if (holder != null) js.put("playerId", holder.getPlayerId());
        return js;
    }

    // ------------------------------------------------------ pantallas nativas

    @PluginMethod
    public void showLeaderboard(final PluginCall call) {
        final String leaderboardId = call.getString("leaderboardId");
        if (TextUtils.isEmpty(leaderboardId)) {
            call.reject("Falta leaderboardId", "bad_request");
            return;
        }
        run(call, activity ->
            PlayGames
                .getLeaderboardsClient(activity)
                .getLeaderboardIntent(leaderboardId)
                .addOnSuccessListener(intent -> startScreen(call, activity, intent))
                .addOnFailureListener(e -> call.reject(message(e), e))
        );
    }

    @PluginMethod
    public void showAllLeaderboards(final PluginCall call) {
        run(call, activity ->
            PlayGames
                .getLeaderboardsClient(activity)
                .getAllLeaderboardsIntent()
                .addOnSuccessListener(intent -> startScreen(call, activity, intent))
                .addOnFailureListener(e -> call.reject(message(e), e))
        );
    }

    private void startScreen(PluginCall call, Activity activity, Intent intent) {
        try {
            activity.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(message(e), e);
        }
    }

    // ------------------------------------------------------------- utilidades

    private interface OnActivity {
        void run(Activity activity);
    }

    /** Comprueba la configuración y ejecuta el cuerpo en el hilo de UI. */
    private void run(final PluginCall call, final OnActivity body) {
        if (!isConfigured()) {
            call.reject("Play Juegos no está configurado (falta game_services_project_id)", "not_configured");
            return;
        }
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Sin Activity", "no_activity");
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                if (!initialized) {
                    PlayGamesSdk.initialize(getContext());
                    initialized = true;
                }
                body.run(activity);
            } catch (Exception e) {
                call.reject(message(e), e);
            }
        });
    }

    private int timeSpan(String value) {
        if ("day".equals(value)) return LeaderboardVariant.TIME_SPAN_DAILY;
        if ("week".equals(value)) return LeaderboardVariant.TIME_SPAN_WEEKLY;
        return LeaderboardVariant.TIME_SPAN_ALL_TIME;
    }

    private int collection(String value) {
        return "friends".equals(value) ? LeaderboardVariant.COLLECTION_FRIENDS : LeaderboardVariant.COLLECTION_PUBLIC;
    }

    private String message(Exception e) {
        String m = e.getMessage();
        return m == null ? e.getClass().getSimpleName() : m;
    }
}

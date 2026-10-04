package com.mobiletemp;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;

public class BeniAidNotificationWorker extends Worker {
  private static final String TAG = "BeniAidNotificationWorker";

  public BeniAidNotificationWorker(Context context, WorkerParameters workerParams) {
    super(context, workerParams);
  }

  @Override
  public Result doWork() {
    Context context = getApplicationContext();
    SharedPreferences preferences = context.getSharedPreferences(
        BeniAidNotificationModule.PREFS_NAME,
        Context.MODE_PRIVATE);
    String token = preferences.getString("auth_token", null);
    String apiUrl = preferences.getString("api_url", null);
    if (token == null || apiUrl == null) return Result.failure();

    HttpURLConnection connection = null;
    try {
      String endpoint = apiUrl.replaceAll("/+$", "") + "/notifications";
      connection = (HttpURLConnection) new URL(endpoint).openConnection();
      connection.setRequestMethod("GET");
      connection.setConnectTimeout(10000);
      connection.setReadTimeout(10000);
      connection.setRequestProperty("Authorization", token.startsWith("Bearer ") ? token : "Bearer " + token);
      connection.setRequestProperty("Accept", "application/json");

      int responseCode = connection.getResponseCode();
      if (responseCode == 401 || responseCode == 403) return Result.failure();
      if (responseCode < 200 || responseCode >= 300) return Result.retry();

      String responseBody = readResponse(connection.getInputStream());
      JSONObject response = new JSONObject(responseBody);
      JSONArray notifications = response.optJSONArray("data");
      if (notifications == null) return Result.success();

      Set<String> currentIds = new LinkedHashSet<>();
      for (int i = 0; i < notifications.length(); i++) {
        JSONObject notification = notifications.optJSONObject(i);
        if (notification == null) continue;
        String id = notification.optString("id", "");
        if (!id.isEmpty()) currentIds.add("notification:" + id);
      }

      synchronized (BeniAidNotificationModule.class) {
        SharedPreferences latestPreferences = context.getSharedPreferences(
            BeniAidNotificationModule.PREFS_NAME,
            Context.MODE_PRIVATE);
        Set<String> seenIds = new HashSet<>(latestPreferences.getStringSet(
            BeniAidNotificationModule.SEEN_IDS_KEY,
            new HashSet<>()));

        if (!latestPreferences.getBoolean(BeniAidNotificationModule.BASELINE_READY_KEY, false)) {
          seenIds.addAll(currentIds);
          latestPreferences.edit()
              .putStringSet(BeniAidNotificationModule.SEEN_IDS_KEY, seenIds)
              .putBoolean(BeniAidNotificationModule.BASELINE_READY_KEY, true)
              .apply();
          return Result.success();
        }

        Set<String> updatedIds = new LinkedHashSet<>(seenIds);
        for (int i = 0; i < notifications.length(); i++) {
          JSONObject notification = notifications.optJSONObject(i);
          if (notification == null) continue;
          String rawId = notification.optString("id", "");
          String id = "notification:" + rawId;
          if (rawId.isEmpty() || seenIds.contains(id)) continue;
          if (!shouldNotify(notification)) {
            updatedIds.add(id);
            continue;
          }

          String title = notification.optString("title", "BeniAid");
          String body = notification.optString("message", "May bago kang abiso sa BeniAid.");
          if (title.trim().isEmpty()) title = "BeniAid";
          if (body.trim().isEmpty() || "null".equals(body)) body = "May bago kang abiso sa BeniAid.";
          if (BeniAidNotificationHelper.show(context, id, title, body)) {
            updatedIds.add(id);
          }
        }

        while (updatedIds.size() > 200) {
          updatedIds.remove(updatedIds.iterator().next());
        }
        latestPreferences.edit()
            .putStringSet(BeniAidNotificationModule.SEEN_IDS_KEY, updatedIds)
            .putBoolean(BeniAidNotificationModule.BASELINE_READY_KEY, true)
            .apply();
      }
      return Result.success();
    } catch (Exception error) {
      Log.w(TAG, "Could not check for new beneficiary notifications", error);
      return Result.retry();
    } finally {
      if (connection != null) connection.disconnect();
    }
  }

  private boolean shouldNotify(JSONObject notification) {
    if (notification.optBoolean("is_read", false)) return false;

    String type = notification.optString("type", "");
    String referenceType = notification.optString("reference_type", "");
    if ("intervention_submitted".equals(type) || "intervention_submitted".equals(referenceType)) {
      return false;
    }

    String title = notification.optString("title", "");
    String message = notification.optString("message", "");
    boolean assistanceSubmission = "assistance_request".equals(referenceType)
        && (title.startsWith("Kahilingan sa Ayuda:")
            || message.toLowerCase().contains("matagumpay na naisumite"));
    if (assistanceSubmission) return false;

    return !("announcement".equals(type) || "announcement".equals(referenceType))
        || "announcement_absence".equals(referenceType);
  }

  private String readResponse(InputStream inputStream) throws Exception {
    StringBuilder response = new StringBuilder();
    try (BufferedReader reader = new BufferedReader(
        new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) response.append(line);
    }
    return response.toString();
  }
}

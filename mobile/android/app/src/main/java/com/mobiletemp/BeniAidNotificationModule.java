package com.mobiletemp;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.PeriodicWorkRequest.Builder;
import androidx.work.WorkManager;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@ReactModule(name = BeniAidNotificationModule.NAME)
public class BeniAidNotificationModule extends ReactContextBaseJavaModule {
  public static final String NAME = "BeniAidNotifications";
  static final String PREFS_NAME = "beniaid_background_notifications";
  static final String SEEN_IDS_KEY = "seen_notification_ids";
  static final String BASELINE_READY_KEY = "notification_baseline_ready";
  static final String USER_ID_KEY = "user_id";
  private static final String TOKEN_KEY = "auth_token";
  private static final String API_URL_KEY = "api_url";
  private static final String UNIQUE_WORK_NAME = "beniaid-beneficiary-notifications";

  BeniAidNotificationModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void createChannel(String channelId, String channelName, Promise promise) {
    try {
      promise.resolve(BeniAidNotificationHelper.createChannel(
          getReactApplicationContext(), channelId, channelName));
    } catch (Exception error) {
      promise.reject("NOTIFICATION_CHANNEL_ERROR", error);
    }
  }

  @ReactMethod
  public void showNotification(String notificationId, String title, String body, Promise promise) {
    try {
      ReactApplicationContext context = getReactApplicationContext();
      SharedPreferences preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
      synchronized (BeniAidNotificationModule.class) {
        Set<String> seenIds = new HashSet<>(preferences.getStringSet(SEEN_IDS_KEY, new HashSet<>()));
        if (seenIds.contains(notificationId)) {
          promise.resolve(true);
          return;
        }

        boolean displayed = BeniAidNotificationHelper.show(
            context, notificationId, title, body);
        if (displayed) {
          seenIds.add(notificationId);
          preferences.edit().putStringSet(SEEN_IDS_KEY, seenIds).apply();
        }
        promise.resolve(displayed);
      }
    } catch (Exception error) {
      promise.reject("NOTIFICATION_DISPLAY_ERROR", error);
    }
  }

  @ReactMethod
  public void startBackgroundMonitoring(String userId, String token, String apiUrl, Promise promise) {
    try {
      Context context = getReactApplicationContext();
      SharedPreferences preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
      String existingUserId = preferences.getString(USER_ID_KEY, null);
      SharedPreferences.Editor editor = preferences.edit()
          .putString(USER_ID_KEY, userId)
          .putString(TOKEN_KEY, token)
          .putString(API_URL_KEY, apiUrl);
      if (existingUserId == null || !existingUserId.equals(userId)) {
        editor.remove(SEEN_IDS_KEY).putBoolean(BASELINE_READY_KEY, false);
      }
      editor.apply();

      Constraints constraints = new Constraints.Builder()
          .setRequiredNetworkType(NetworkType.CONNECTED)
          .build();
      PeriodicWorkRequest periodicWork = new Builder(
          BeniAidNotificationWorker.class,
          15,
          TimeUnit.MINUTES)
          .setConstraints(constraints)
          .build();
      WorkManager.getInstance(context).enqueueUniquePeriodicWork(
          UNIQUE_WORK_NAME,
          ExistingPeriodicWorkPolicy.REPLACE,
          periodicWork);

      OneTimeWorkRequest baselineWork = new OneTimeWorkRequest.Builder(BeniAidNotificationWorker.class)
          .setConstraints(constraints)
          .build();
      WorkManager.getInstance(context).enqueueUniqueWork(
          UNIQUE_WORK_NAME + "-baseline",
          ExistingWorkPolicy.KEEP,
          baselineWork);
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("NOTIFICATION_MONITORING_ERROR", error);
    }
  }

  @ReactMethod
  public void stopBackgroundMonitoring(Promise promise) {
    try {
      Context context = getReactApplicationContext();
      WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_WORK_NAME);
      WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_WORK_NAME + "-baseline");
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply();
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("NOTIFICATION_MONITORING_ERROR", error);
    }
  }
}

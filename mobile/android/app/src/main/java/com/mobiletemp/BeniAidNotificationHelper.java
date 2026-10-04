package com.mobiletemp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.content.pm.PackageManager;

import androidx.core.app.NotificationCompat;

public final class BeniAidNotificationHelper {
  public static final String CHANNEL_ID = "beniaid-beneficiary-notifications";
  public static final String CHANNEL_NAME = "BeniAid notifications";

  private BeniAidNotificationHelper() {}

  public static boolean createChannel(Context context, String channelId, String channelName) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
    NotificationManager manager = context.getSystemService(NotificationManager.class);
    if (manager == null) return false;

    NotificationChannel channel = new NotificationChannel(
        channelId,
        channelName,
        NotificationManager.IMPORTANCE_HIGH);
    channel.setDescription("Mga bagong abiso mula sa BeniAid.");
    channel.enableVibration(true);
    manager.createNotificationChannel(channel);
    return true;
  }

  public static boolean show(Context context, String notificationId, String title, String body) {
    if (Build.VERSION.SDK_INT >= 33
        && context.checkSelfPermission("android.permission.POST_NOTIFICATIONS")
            != PackageManager.PERMISSION_GRANTED) {
      return false;
    }

    NotificationManager manager = (NotificationManager)
        context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager == null) return false;

    createChannel(context, CHANNEL_ID, CHANNEL_NAME);
    Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    PendingIntent contentIntent = null;
    if (launchIntent != null) {
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
      int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
      }
      contentIntent = PendingIntent.getActivity(
          context,
          notificationId.hashCode(),
          launchIntent,
          pendingIntentFlags);
    }

    NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_beniaid_notification)
        .setLargeIcon(BitmapFactory.decodeResource(context.getResources(), R.mipmap.ic_launcher))
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
        .setColor(0xFF00338D)
        .setCategory(NotificationCompat.CATEGORY_STATUS)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
        .setAutoCancel(true)
        .setOnlyAlertOnce(true)
        .setDefaults(Notification.DEFAULT_ALL);

    if (contentIntent != null) builder.setContentIntent(contentIntent);
    manager.notify(notificationId.hashCode() & 0x7fffffff, builder.build());
    return true;
  }
}

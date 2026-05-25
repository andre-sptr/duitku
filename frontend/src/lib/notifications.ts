import { Platform, Alert, Linking } from "react-native";
import * as Notifications from "expo-notifications";

let configured = false;

function setupHandler() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  setupHandler();
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === "granted") return true;
    if (!existing.canAskAgain) {
      Alert.alert(
        "Izin Notifikasi",
        "Aktifkan izin notifikasi di Pengaturan agar pengingat dapat muncul tepat waktu.",
        [
          { text: "Batal", style: "cancel" },
          { text: "Buka Pengaturan", onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    const req = await Notifications.requestPermissionsAsync();
    return req.status === "granted";
  } catch (e) {
    console.warn("ensureNotificationPermission failed", e);
    return false;
  }
}

function repeatToTrigger(date: Date, repeat: string): any {
  // expo-notifications schedule triggers
  if (repeat === "daily") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }
  if (repeat === "weekly") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: date.getDay() + 1, // 1=Sunday in expo
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }
  if (repeat === "yearly") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.YEARLY,
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }
  if (repeat === "monthly") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }
  // none / default
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date };
}

export async function scheduleReminderNotification(input: {
  title: string;
  body: string;
  date: Date;
  repeat: "none" | "daily" | "weekly" | "monthly" | "yearly";
}): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const ok = await ensureNotificationPermission();
  if (!ok) return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body || "Pengingat dari DuitKu",
        sound: true,
      },
      trigger: repeatToTrigger(input.date, input.repeat),
    });
    return id;
  } catch (e) {
    console.warn("Failed to schedule notification", e);
    return null;
  }
}

export async function cancelNotification(id?: string | null) {
  if (!id || Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (e) {
    // ignore
  }
}

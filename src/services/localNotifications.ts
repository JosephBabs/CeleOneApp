import notifee, { AndroidImportance } from "@notifee/react-native";

export async function showLocalNotification(
  title: string,
  body: string,
  data?: any
) {
  const channelId = await notifee.createChannel({
    id: "default",
    name: "Default Notifications",
    importance: AndroidImportance.HIGH,
  });

  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId,
      pressAction: { id: "default" },
    },
    data,
  });
}

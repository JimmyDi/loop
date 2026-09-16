export type Notification = { title: string; body: string };

export interface NotificationAdapter {
  notify(notification: Notification): Promise<void>;
}

export class NoopNotificationAdapter implements NotificationAdapter {
  async notify(_notification: Notification) {}
}

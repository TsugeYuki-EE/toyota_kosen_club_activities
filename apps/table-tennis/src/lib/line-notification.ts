const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";
const LINE_MESSAGE_MAX_LENGTH = 5000;

function normalizeEnvValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getLineNotificationConfig() {
  return {
    accessToken:
      normalizeEnvValue(process.env.LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN) ||
      normalizeEnvValue(process.env.TABLE_TENNIS_LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN) ||
      normalizeEnvValue(process.env.LINE_CHANNEL_ACCESS_TOKEN),
    targetId:
      normalizeEnvValue(process.env.LINE_MESSAGING_API_TARGET_ID) ||
      normalizeEnvValue(process.env.TABLE_TENNIS_LINE_MESSAGING_API_TARGET_ID) ||
      normalizeEnvValue(process.env.LINE_TARGET_ID),
  };
}

export function isLineNotificationEnabled(): boolean {
  const config = getLineNotificationConfig();
  return Boolean(config.accessToken && config.targetId);
}

function clampMessageLength(message: string): string {
  if (message.length <= LINE_MESSAGE_MAX_LENGTH) {
    return message;
  }

  return `${message.slice(0, LINE_MESSAGE_MAX_LENGTH - 1)}…`;
}

export async function sendLineNotification(message: string) {
  const config = getLineNotificationConfig();

  if (!config.accessToken || !config.targetId) {
    return { sent: false, skipped: true };
  }

  const response = await fetch(LINE_PUSH_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: config.targetId,
      messages: [{ type: "text", text: clampMessageLength(message) }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    return {
      sent: false,
      skipped: false,
      status: response.status,
      error: errorBody.slice(0, 300) || response.statusText,
    };
  }

  return { sent: true, skipped: false };
}

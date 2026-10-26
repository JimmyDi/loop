import type { SpokenCommand } from "./command-types";

export const parseSpokenCommand = (value: string, steering = false): SpokenCommand => {
  const text = value.trim();
  if (
    /^(?:停止任务|停止执行|取消任务|stop (?:the )?task|cancel (?:the )?task)[。.!！]?$/i.test(text)
  )
    return { action: "abort" };
  if (/^(?:继续任务|恢复任务|继续执行|resume (?:the )?task)[。.!！]?$/i.test(text))
    return { action: "resume" };
  const prefix =
    /^(?:(?:调整要求|纠正方向)[\s:：，,]*|(?:change requirements|correct direction)[\s:：，,]+)/i;
  const correction = prefix.test(text);
  const prompt = correction ? text.replace(prefix, "").trim() : text;
  if (
    /^[\s。.!！:：，,]*$/.test(prompt) ||
    /^(?:调整要求|纠正方向|change requirements|correct direction)[。.!！:：]?$/i.test(prompt)
  )
    return { action: "empty" };
  return { action: "prompt", text: prompt, steering: correction || steering };
};

export const voiceSubmissionNotice = (
  accepted: unknown,
  steering: boolean,
  running: boolean,
): string =>
  !accepted ? "voice.unsent" : steering ? "voice.steered" : running ? "voice.queued" : "voice.sent";

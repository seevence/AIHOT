import { createElement, type ReactElement } from "react";

const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatCareerDateTime(value: string): string | null {
  if (!ISO_UTC_PATTERN.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // 日期越界按 JS Date 自然顺延（闰年 2 月 29 天、平年 28 天），与可见文本保持一致
  return dateTimeFormatter.format(date);
}

export function CareerTime({ value, className }: { value: string; className?: string }): ReactElement {
  const formatted = formatCareerDateTime(value);
  if (formatted === null) return createElement("span", { className }, value);
  return createElement("time", { dateTime: new Date(value).toISOString(), className }, formatted);
}

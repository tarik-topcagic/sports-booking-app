export function clearTypingTimer(
  timer?: ReturnType<typeof setTimeout>,
): ReturnType<typeof setTimeout> | undefined {
  if (timer) {
    clearTimeout(timer);
  }

  return undefined;
}

export function scheduleTypingTimer(
  existingTimer: ReturnType<typeof setTimeout> | undefined,
  callback: () => void,
  delayMs: number,
): ReturnType<typeof setTimeout> {
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  return setTimeout(callback, delayMs);
}

export const TYPING_ENTRY_TTL_MS = 5000;

export function scheduleTypingEntryExpiry(
  timers: Map<string, ReturnType<typeof setTimeout>>,
  key: string,
  onExpire: () => void,
): void {
  const existing = timers.get(key);
  if (existing) {
    clearTimeout(existing);
  }

  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      onExpire();
    }, TYPING_ENTRY_TTL_MS),
  );
}

export function clearTypingEntryExpiry(
  timers: Map<string, ReturnType<typeof setTimeout>>,
  key: string,
): void {
  const existing = timers.get(key);
  if (existing) {
    clearTimeout(existing);
    timers.delete(key);
  }
}

export function clearAllTypingEntryExpiries(
  timers: Map<string, ReturnType<typeof setTimeout>>,
): void {
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }

  timers.clear();
}

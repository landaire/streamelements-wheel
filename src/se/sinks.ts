export interface AnnounceSink {
  winner(entry: string): void;
  seam(): void;
}

export interface DonationSource {
  start(): void;
  stop(): void;
}

export function consoleAnnounceSink(setTitle: (t: string) => void, respinText: string): AnnounceSink {
  return {
    winner: (entry: string) => setTitle(entry),
    seam: () => setTitle(respinText),
  };
}

// Separate from AnnounceSink: the "!wheel list" command reports the current entry set,
// not a spin outcome. Console-only for now -- never chat, per the proprietary boundary
// on outbound chat sends.
export interface ListSink {
  list(entries: readonly string[]): void;
}

export function consoleListSink(): ListSink {
  return {
    list: (entries) => console.log("[wheel] entries:", entries.join(", ")),
  };
}

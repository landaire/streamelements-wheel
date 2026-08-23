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

declare const SE_API: { store: { get(k: string): Promise<unknown>; set(k: string, v: unknown): Promise<void> } } | undefined;

export interface Store {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
}

export function seStore(): Store {
  return {
    get: async <T>(key: string) => (await SE_API!.store.get(key)) as T | undefined,
    set: async <T>(key: string, value: T) => {
      await SE_API!.store.set(key, value);
    },
  };
}

export function memoryStore(): Store {
  const m = new Map<string, unknown>();
  return {
    get: async <T>(key: string) => m.get(key) as T | undefined,
    set: async <T>(key: string, value: T) => {
      m.set(key, value);
    },
  };
}

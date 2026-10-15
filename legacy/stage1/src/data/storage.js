// Key/value storage for the FAKE data layer only. Uses the browser's
// localStorage when allowed and falls back to memory when a browser blocks it.

export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

export function createStorage() {
  try {
    const probe = '__bt_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    console.warn('Browser storage is blocked. Using memory only for this session.');
    return createMemoryStorage();
  }
}

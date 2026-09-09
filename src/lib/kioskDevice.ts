/**
 * Where a kiosk keeps proof of which site it belongs to.
 *
 * The tablet is set up once by an administrator with a one-time code. In return it
 * receives an opaque key. The key is stored in IndexedDB where available, with
 * localStorage as a fallback for older devices. Nothing here can be used to work out
 * the site on its own — the server decides that from the key every time.
 *
 * If the key is lost (storage cleared, new browser profile) the kiosk goes back to the
 * activation screen. It never falls back to a site from the address bar.
 */

export interface KioskDeviceRecord {
  token: string;
  deviceId: string;
  siteId: string;
  siteName: string;
  deviceName: string;
}

const DB_NAME = "centrim-kiosk";
const STORE = "device";
const RECORD_KEY = "bound-device";
const LS_KEY = "centrim.kioskDevice";

let cached: KioskDeviceRecord | null = null;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbGet(): Promise<KioskDeviceRecord | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(null);
        try {
          const req = db.transaction(STORE, "readonly").objectStore(STORE).get(RECORD_KEY);
          req.onsuccess = () => resolve((req.result as KioskDeviceRecord) ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

function idbPut(record: KioskDeviceRecord | null): Promise<boolean> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(false);
        try {
          const store = db.transaction(STORE, "readwrite").objectStore(STORE);
          const req = record ? store.put(record, RECORD_KEY) : store.delete(RECORD_KEY);
          req.onsuccess = () => resolve(true);
          req.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      })
  );
}

function lsGet(): KioskDeviceRecord | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as KioskDeviceRecord) : null;
  } catch {
    return null;
  }
}

/** Reads the stored device record, preferring IndexedDB and falling back to localStorage. */
export async function loadKioskDevice(): Promise<KioskDeviceRecord | null> {
  if (cached) return cached;
  const found = (await idbGet()) ?? lsGet();
  if (found?.token) cached = found;
  return cached;
}

export async function saveKioskDevice(record: KioskDeviceRecord): Promise<void> {
  cached = record;
  const stored = await idbPut(record);
  if (!stored) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(record));
    } catch {
      /* storage unavailable — the kiosk will ask to be set up again after a reload */
    }
  }
}

export async function clearKioskDevice(): Promise<void> {
  cached = null;
  await idbPut(null);
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** The key for the current device, or null when this tablet has not been set up. */
export function kioskDeviceToken(): string | null {
  return cached?.token ?? null;
}

/** The site this tablet is bound to. Never comes from the address bar. */
export function kioskBoundSiteId(): string | null {
  return cached?.siteId ?? null;
}

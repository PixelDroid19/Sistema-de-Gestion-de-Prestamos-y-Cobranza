import type { StateStorage } from 'zustand/middleware';

type SafeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const createMemoryStorage = (): SafeStorage => {
  const store = new Map<string, string>();

  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
};

const isStorageAvailable = (storage: Storage | null | undefined): storage is Storage => {
  if (!storage) {
    return false;
  }

  return typeof storage.getItem === 'function'
    && typeof storage.setItem === 'function'
    && typeof storage.removeItem === 'function';
};

const createSafeStorage = (kind: 'localStorage' | 'sessionStorage'): SafeStorage => {
  const fallbackStorage = createMemoryStorage();

  const resolveStorage = (): SafeStorage => {
    if (typeof window === 'undefined') {
      return fallbackStorage;
    }

    try {
      const storage = window[kind];
      return isStorageAvailable(storage) ? storage : fallbackStorage;
    } catch {
      return fallbackStorage;
    }
  };

  return {
    getItem: (key) => {
      try {
        return resolveStorage().getItem(key);
      } catch {
        return fallbackStorage.getItem(key);
      }
    },
    setItem: (key, value) => {
      try {
        resolveStorage().setItem(key, value);
      } catch {
        fallbackStorage.setItem(key, value);
      }
    },
    removeItem: (key) => {
      try {
        resolveStorage().removeItem(key);
      } catch {
        fallbackStorage.removeItem(key);
      }
    },
  };
};

export const safeLocalStorage = createSafeStorage('localStorage');
export const safeSessionStorage = createSafeStorage('sessionStorage');

export const safeSessionStateStorage: StateStorage = {
  getItem: (name) => safeSessionStorage.getItem(name),
  setItem: (name, value) => safeSessionStorage.setItem(name, value),
  removeItem: (name) => safeSessionStorage.removeItem(name),
};

// Saving user data in chrome storage
export default class Storage {
  static DATA = {
    ACCESS_TOKEN: "accessToken",
    USER: "user",
  };

  // Initialize or update data
  static async set(key: string, data: unknown): Promise<void> {
    const obj: Record<string, unknown> = {};
    obj[key] = data;
    await chrome.storage.local.set(obj);
  }

  // Remove user data
  static async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  // Get current data
  static async get<T = unknown>(key: string): Promise<T | null> {
    const data = await chrome.storage.local.get(key);
    return (data[key] as T) ?? null;
  }
}

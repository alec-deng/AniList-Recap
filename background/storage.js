// Saving user data in chrome storage
export default class Storage {
  static DATA = {
    ACCESS_TOKEN: "accessToken",
    USER: "user",
  };

  // Initialize or update data
  static async set(key, data) {
    const obj = {};
    obj[key] = data;
    await chrome.storage.local.set(obj);
  }

  // Remove user data
  static async remove(key) {
    await chrome.storage.local.remove(key);
  }

  // Get current data
  static async get(key) {
    const data = await chrome.storage.local.get(key);
    return data[key] || null;
  }
}

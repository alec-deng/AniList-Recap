export default class Storage {
  static DATA = {
    ACCESS_TOKEN: "accessToken",
    USER: "user",
  };

  static async set(key, data) {
    const obj = {};
    obj[key] = data;
    await chrome.storage.local.set(obj);
  }

  static async remove(key) {
    await chrome.storage.local.remove(key);
  }

  static async get(key) {
    const data = await chrome.storage.local.get(key);
    return data[key] || null;
  }
}

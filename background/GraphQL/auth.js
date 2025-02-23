import AniList from "./anilist.js";
import Storage from "../storage.js";

export default class Auth {
  // Send a request for user authorization
  static async login() {
    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: "https://anilist.co/api/v2/oauth/authorize?client_id=24586&response_type=token",
      interactive: true,
    });
    // Get the fragment part (after '#') for access token
    const fragment = redirectUrl.split("#")[1];
    const params = new URLSearchParams(fragment);
    const accessToken = params.get("access_token");

    if (accessToken === null) {
      throw new Error("Missing Access Token");
    }

    // Store access token and user data.
    const user = await new AniList(accessToken).user();

    await Promise.all([
      Storage.set(Storage.DATA.ACCESS_TOKEN, accessToken),
      Storage.set(Storage.DATA.USER, user),
    ]);

    return user;
  }

  // Logout user, remove user data in the storage
  static async logout() {
    return Promise.all([
      Storage.remove(Storage.DATA.ACCESS_TOKEN),
      Storage.remove(Storage.DATA.USER),
    ]);
  }
}

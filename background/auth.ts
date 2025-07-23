import AniList from "./anilist";
import Storage from "./storage";

export default class Auth {
  static CLIENT_ID = 24586;

  // Initiates the OAuth login flow.
  static async login() {
    const authUrl = new URL("https://anilist.co/api/v2/oauth/authorize");
    authUrl.searchParams.append("client_id", this.CLIENT_ID.toString())
    authUrl.searchParams.append("response_type", "token");

    let redirectUrl: string | undefined

    try {
      redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl.toString(),
        interactive: true,
      })
    } catch (err) {
      console.error("[Auth] launchWebAuthFlow failed:", err)
      throw new Error("OAuth login failed or was cancelled")
    }

    if (!redirectUrl) {
      console.error("[Auth] No redirectUrl returned")
      throw new Error("Authentication flow was cancelled or blocked")
    }

    // Extract the fragment after '#' which contains the access token.
    const fragment = redirectUrl.split("#")[1];
    const params = new URLSearchParams(fragment);
    const accessToken = params.get("access_token");

    if (accessToken === null) {
      throw new Error("Missing Access Token");
    }

    // Fetch user data using the access token.
    const user = await new AniList(accessToken).user();

    // Store the access token and user data.
    await Promise.all([
      Storage.set(Storage.DATA.ACCESS_TOKEN, accessToken),
      Storage.set(Storage.DATA.USER, user),
    ]);

    return user;
  }

  // Logs out the user from the extension (clears stored data)
  static async logout() {
    await Promise.all([
      Storage.remove(Storage.DATA.ACCESS_TOKEN),
      Storage.remove(Storage.DATA.USER),
    ]);
  }
}

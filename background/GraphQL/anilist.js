export default class AniList {
  #accessToken;

  constructor(token) {
    this.#accessToken = token;
  }

  /**
   * Get AniList API request headers.
   */
  #headers() {
    const headers = new Headers();

    headers.append("Content-Type", "application/json");
    headers.append("Accept", "application/json");

    if (this.#accessToken) {
      headers.append("Authorization", `Bearer ${this.#accessToken}`);
    }

    return headers;
  }

  /**
   * Get authenticated user data.
   */
  async user() {
    const query = `
      query Query {
        Viewer {
          id
          name
          siteUrl
          avatar {
            medium
          }
        }
      }
    `;

    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: this.#headers,
      body: JSON.stringify({ query }),
    });

    return response.json();
  }
}

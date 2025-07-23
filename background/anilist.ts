export default class AniList {
  #accessToken;

  constructor(token: string) {
    this.#accessToken = token;
  }

  // Construct request header
  #headers(): Headers {
    const headers = new Headers()
    headers.append("Content-Type", "application/json")
    headers.append("Accept", "application/json")
    
    if (this.#accessToken) {
      headers.append("Authorization", `Bearer ${this.#accessToken}`)
    }
    return headers
  }

  // Get authenticated user data.
  async user(): Promise<any> {
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
      headers: this.#headers(),
      body: JSON.stringify({ query }),
    });

    return response.json();
  }
}

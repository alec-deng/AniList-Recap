// Fetch anime or manga list
export async function fetchList(userName, type) {
  const query = `
        query ($userName: String, $type: MediaType) {
          MediaListCollection(userName: $userName, type: $type) {
            lists {
              name
              entries {
                ...mediaListEntry
              }
            }
          }
        } fragment mediaListEntry on MediaList {
          score
          media {
            title {
              native
            }
            episodes
            averageScore
            startDate {
              year
              month
              day
            }
          }
        }
    `;

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { userName, type } }),
  });

  return response.json();
}

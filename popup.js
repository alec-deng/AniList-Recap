document.addEventListener("DOMContentLoaded", () => {
  let selectedType = "ANIME"; // Default to ANIME

  // Get UI elements
  const animeButton = document.getElementById("animeButton");
  const mangaButton = document.getElementById("mangaButton");
  const fetchButton = document.getElementById("fetchData");

  // Toggle between ANIME and MANGA
  animeButton.addEventListener("click", () => {
    selectedType = "ANIME";
    animeButton.classList.add("active");
    mangaButton.classList.remove("active");
  });

  mangaButton.addEventListener("click", () => {
    selectedType = "MANGA";
    mangaButton.classList.add("active");
    animeButton.classList.remove("active");
  });

  // Fetch Data when the button is clicked
  fetchButton.addEventListener("click", async () => {
    const userName = document.getElementById("username").value;
    if (!userName) {
      alert("Please enter a userName!");
      return;
    }

    const data = await fetchList(userName, selectedType);
    if (data) {
      output.textContent = JSON.stringify(data, null, 2); // Show data in popup
    }
  });
});

// Fetch anime or manga list
async function fetchList(userName, type) {
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

  const result = await response.json();
  return result;
}

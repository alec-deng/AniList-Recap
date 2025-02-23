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
    console.log("Fetch button clicked!");
    const userName = document.getElementById("username").value;
    if (!userName) {
      alert("Please enter a userName!");
      return;
    }

    chrome.runtime.sendMessage(
      { action: "fetchData", userName: userName, type: selectedType },
      (response) => {
        if (response.error) {
          console.error("Error:", response.error);
        } else {
          console.log("Received Data:", response);
          output.textContent = JSON.stringify(response, null, 2);
        }
      }
    );
  });
});

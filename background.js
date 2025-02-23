import { fetchList } from "./api.js";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Anilist Analyzer Extension Installed!");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message);
  console.log("Sender details:", sender);

  if (message.action === "fetchData") {
    fetchList(message.userName, message.type)
      .then((data) => {
        sendResponse(data);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        sendResponse({ error: "Failed to fetch data" });
      });
    return true;
  }
});

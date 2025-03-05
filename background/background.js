import { fetchList } from "./GraphQL/fetchList.js";
import Storage from "./storage.js";
import Auth from "./GraphQL/auth.js";

// Listener for action send from the popup page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message);
  console.log("Sender details:", sender);

  switch (message.action) {
    case "FETCH":
      fetchList(message.userName, message.type)
        .then((data) => {
          sendResponse(data);
        })
        .catch((error) => {
          console.error(error);
          sendResponse({ error: error.message });
        });
      break;

    case "USER":
      Storage.get(Storage.DATA.USER)
        .then((user) => sendResponse({ user: user }))
        .catch((error) => {
          console.log(error);
          sendResponse({ error: error.message });
        });
      break;

    case "LOGIN":
      Auth.login()
        .then((user) => sendResponse({ user: user }))
        .catch((error) => {
          console.log(error);
          sendResponse({ error: error.message });
        });
      break;

    case "LOGOUT":
      Auth.logout()
        .then(() => sendResponse({}))
        .catch((error) => {
          console.log(error);
          sendResponse({ error: error.message });
        });
      break;
  }

  // Keep listener active to wait for async response
  return true;
});

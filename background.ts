import Storage from "./background/storage"
import Auth from "./background/auth"

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "USER":
      Storage.get(Storage.DATA.USER)
        .then((user) => sendResponse({ user }))
        .catch((error) => sendResponse({ error: error.message }))
      break

    case "LOGIN":
      Auth.login()
        .then((user) => sendResponse({ user }))
        .catch((error) => sendResponse({ error: error.message }))
      break

    case "LOGOUT":
      Auth.logout()
        .then(() => sendResponse({}))
        .catch((error) => sendResponse({ error: error.message }))
      break
  }
  // Keep listener active for async response
  return true
})
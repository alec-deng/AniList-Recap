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
        .then((user) => {
          sendResponse({ user })
          broadcastAuthChange()
        })
        .catch((error) => sendResponse({ error: error.message }))
      break

    case "LOGOUT":
      Auth.logout()
        .then(() => {
          sendResponse({})
          broadcastAuthChange()
        })
        .catch((error) => sendResponse({ error: error.message }))
      break

    case "CHECK_AUTH":
      Promise.all([
        Storage.get(Storage.DATA.ACCESS_TOKEN),
        Storage.get(Storage.DATA.USER)
      ])
        .then(([token, user]) => sendResponse({ token, user }))
        .catch((error) => sendResponse({ error: error.message }))
      break
  }
  // Keep listener active for async response
  return true
})

// Listen for storage changes and broadcast to all contexts
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes[Storage.DATA.ACCESS_TOKEN] || changes[Storage.DATA.USER]) {
      console.log('Auth data changed in storage, broadcasting...')
      broadcastAuthChange()
    }
  }
})

// Function to broadcast auth changes to all extension contexts
function broadcastAuthChange() {
  // Send to all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'AUTH_CHANGED' }).catch(() => {
          // Ignore errors for tabs that don't have content scripts
        })
      }
    })
  })

  // Send to popup if it's open
  chrome.runtime.sendMessage({ type: 'AUTH_CHANGED' }).catch(() => {
    // Ignore errors if popup is not open
  })
}
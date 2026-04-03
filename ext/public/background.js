const HOSTNAME = "com.project.host";
const API_URL = "http://127.0.0.1:5000";

function handleHostResponse(response) {
  if (chrome.runtime.lastError) {
    console.error("Error:", chrome.runtime.lastError.message);
    return;
  }
  console.log("Received from Host:", response);
  console.log("Sending to API:", response);
  fetch(`${API_URL}/api/certificate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(response)
  })
  .then(response => response.json())
  .then(api_response => console.log("Received from API:", api_response))
  .catch(api_error => console.error("Error from API:", api_error));

};

chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith("https://")) {
        const message = {
            action: "get_certificate",
            url: tab.url,
            timestamp: new Date().toISOString()
        };
        if (chrome.runtime.lastError) {
          console.error("Error:", chrome.runtime.lastError.message);
          return;
        }
        console.log("Send to Host:", message);
        chrome.runtime.sendNativeMessage(
          HOSTNAME,
          message,
          handleHostResponse
        );
    }
});
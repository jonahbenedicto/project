chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }, () => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message)
        }
    })
})

const attachedTabs = new Set()

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") {
        return
    }
    if (!tab.url) {
        return
    }
    if (!tab.url.startsWith("http")) {
        return
    }
    if (attachedTabs.has(tabId)) {
        return
    }
    const debuggeeId = { tabId }
    chrome.debugger.attach(debuggeeId, "1.3", () => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message)
            return
        }
        attachedTabs.add(tabId)
        chrome.debugger.sendCommand(debuggeeId, "Network.enable", () => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message)
                return
            }
        })
    })
})

chrome.tabs.onRemoved.addListener((tabId) => {
    if (!attachedTabs.has(tabId)) {
        return
    }
    const debuggeeId = { tabId }
    chrome.debugger.detach(debuggeeId, () => {
        if (chrome.runtime.lastError) {
            console.warn(chrome.runtime.lastError.message)
            return
        }
        attachedTabs.delete(tabId)
    })
})

function matchesDomain(domain, pattern) {
    const domainLower = domain.toLowerCase()
    const patternLower = pattern.toLowerCase()

    if (patternLower === domainLower) {
        return true
    }

    if (patternLower.startsWith("*.")) {
        const suffix = patternLower.slice(1)

        if (domainLower.endsWith(suffix)) {
            const prefix = domainLower.slice(0, domainLower.length - suffix.length)

            return prefix.length > 0 && !prefix.includes(".")
        }
    }

    return false
}

const API_BASE_URL = "http://127.0.0.1:5000";

chrome.debugger.onEvent.addListener(async (debuggeeId, message, params) =>{
    if (message !== "Network.responseReceived") {
        return
    }
    if (!params) {
        return
    }
    if (!params.response) {
        return
    }
    if (!params.response.securityDetails) {
        return
    }
    if (!params.response.url) {
        return
    }
    if (!params.response.url.startsWith("http")) {
        return
    }
    const securityDetails = params.response.securityDetails
    const token = await getAuthToken(); // Helper to retrieve your stored JWT

    if (!token) {
        console.warn("No auth token found. Skipping certificate sync.");
        return;
    }

    try {
        // 1. Get the active policy for the user's organisation
        const policyResponse = await fetch(`${API_BASE_URL}/api/policy/active`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!policyResponse.ok) return; // Organisation might not have an active policy
        const policy = await policyResponse.json();

        // 2. Check if the user has consented to this specific policy
        const consentResponse = await fetch(`${API_BASE_URL}/api/consent/${policy.policy_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const consentData = await consentResponse.json();
        if (!consentData.has_consent) {
            console.log("User has not consented to this policy. Sync aborted.");
            return;
        }

        // 3. Check domain relevance before sending
        const certDomains = [securityDetails.subjectName, ...(securityDetails.sanList || [])];
        const isRelevant = policy.valid_domains.length === 0 || certDomains.some(domain => 
            policy.valid_domains.some(pattern => matchesDomain(domain, pattern))
        );

        // Inside chrome.debugger.onEvent.addListener
        if (isRelevant) {
            console.log("Domain is relevant, attempting to sync...");
            const certificatePayload = {
                protocol: securityDetails.protocol,
                key_exchange: securityDetails.keyExchange || "",
                key_exchange_group: securityDetails.keyExchangeGroup || "",
                cipher: securityDetails.cipher,
                mac: securityDetails.mac || "",
                subject_name: securityDetails.subjectName,
                san_list: securityDetails.sanList || [],
                issuer: securityDetails.issuer,
                // Convert Unix timestamps to ISO strings for Python
                valid_from: new Date(securityDetails.validFrom * 1000).toISOString(),
                valid_to: new Date(securityDetails.validTo * 1000).toISOString(),
                signed_certificate_timestamp_list: (securityDetails.signedCertificateTimestampList || []).length > 0,
                certificate_transparency_compliance: securityDetails.certificateTransparencyCompliance === "compliant",
                encrypted_client_hello: !!securityDetails.encryptedClientHello
            };

            const createResponse = await fetch(`${API_BASE_URL}/api/certificate/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(certificatePayload)
            });

            if (createResponse.ok) {
                console.log("Certificate successfully synced.");
            } else {
                const errorData = await createResponse.json();
                console.error("Server rejected certificate:", errorData); // Add this
            }
        } else {
            console.log("Certificate domains not relevant to active policy."); // Add this
        }
    } catch (error) {
        console.error("Error during certificate automation:", error);
    }
})

// main.js

function getAuthToken() {
    return new Promise((resolve) => {
        // Look for the exact key used in storage.ts
        chrome.storage.local.get(["accessToken"], (result) => {
            // Change result.access_token to result.accessToken
            resolve(result.accessToken || null);
        });
    });
}
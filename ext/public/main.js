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

chrome.debugger.onEvent.addListener(async (_, message, params) => {
    if (message !== "Network.responseReceived") {
        return;
    }
    if (!params) {
        return;
    }
    if (!params.response) {
        return;
    }
    if (!params.response.securityDetails) {
        return;
    }
    if (!params.response.url) {
        return;
    }
    if (!params.response.url.startsWith("http")) {
        return;
    }
    const securityDetails = params.response.securityDetails
    const url = new URL(params.response.url)
    const hostname = url.hostname
    const certificate = {
        protocol: securityDetails.protocol,
        keyExchange: securityDetails.keyExchange,
        keyExchangeGroup: securityDetails.keyExchangeGroup,
        cipher: securityDetails.cipher,
        mac: securityDetails.mac,
        certificateId: securityDetails.certificateId,
        subjectName: securityDetails.subjectName,
        sanList: securityDetails.sanList,
        issuer: securityDetails.issuer,
        validFrom: new Date(securityDetails.validFrom * 1000).toISOString(),
        validTo: new Date(securityDetails.validTo * 1000).toISOString(),
        signedCertificateTimestampList: securityDetails.signedCertificateTimestampList,
        certificateTransparencyCompliance: securityDetails.certificateTransparencyCompliance,
        serverSignatureAlgorithm: securityDetails.serverSignatureAlgorithm,
        encryptedClientHello: securityDetails.encryptedClientHello,
    }
    console.log(hostname, certificate)
})
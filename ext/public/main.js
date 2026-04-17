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

function complianceCheck(certificate, policy) {
    return {
        hasValidProtocol: policy.validProtocols.length === 0 || policy.validProtocols.includes(certificate.protocol),
        hasValidKeyExchange: policy.validKeyExchanges.length === 0 || policy.validKeyExchanges.includes(certificate.keyExchange),
        hasValidKeyExchangeGroup: policy.validKeyExchangeGroups.length === 0 || policy.validKeyExchangeGroups.includes(certificate.keyExchangeGroup),
        hasValidCipher: policy.validCiphers.length === 0 || policy.validCiphers.includes(certificate.cipher),
        hasValidMac: policy.validMacs.length === 0 || policy.validMacs.includes(certificate.mac),
        hasValidDomain: policy.validDomains.some(pattern => matchesDomain(certificate.subjectName, pattern) || certificate.sanList.some(san => matchesDomain(san, pattern))),
        hasValidIssuer: policy.validIssuers.length === 0 || policy.validIssuers.includes(certificate.issuer),
        hasValidDaysUntilExpiration: (new Date(certificate.validTo) - new Date()) / (1000 * 60 * 60 * 24) >= policy.minDaysUntilExpiration,
        hasValidDaysSinceIssuance: (new Date() - new Date(certificate.validFrom)) / (1000 * 60 * 60 * 24) <= policy.maxDaysSinceIssuance,
        hasValidSignedCertificateTimestampList: (certificate.signedCertificateTimestampList && certificate.signedCertificateTimestampList.length > 0) === policy.requireSignedCertificateTimestampList,
        hasValidCertificateTransparencyCompliance: certificate.certificateTransparencyCompliance === policy.requireCertificateTransparencyCompliance,
        hasValidEncryptedClientHello: certificate.encryptedClientHello === policy.requireEncryptedClientHello,
    }
}

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

    const policy = {
        validProtocols: ["QUIC", "TLS 1.3"],
        validKeyExchanges: [],
        validKeyExchangeGroups: ["X25519MLKEM768"],
        validCiphers: ["AES_128_GCM"],
        validMacs: [],
        validDomains: ["google.com"],
        validIssuers: ["WR2"],
        minDaysUntilExpiration: 30,
        maxDaysSinceIssuance: 365,
        requireSignedCertificateTimestampList: true,
        requireCertificateTransparencyCompliance: true,
        requireEncryptedClientHello: true,
    }

    // Get validDomains from server side
    const validDomains = policy.validDomains

    const certificate = {
        protocol: securityDetails.protocol,
        keyExchange: securityDetails.keyExchange,
        keyExchangeGroup: securityDetails.keyExchangeGroup,
        cipher: securityDetails.cipher,
        mac: securityDetails.mac,
        subjectName: securityDetails.subjectName,
        sanList: securityDetails.sanList,
        issuer: securityDetails.issuer,
        validFrom: new Date(securityDetails.validFrom * 1000).toISOString(),
        validTo: new Date(securityDetails.validTo * 1000).toISOString(),
        signedCertificateTimestampList: securityDetails.signedCertificateTimestampList,
        certificateTransparencyCompliance: securityDetails.certificateTransparencyCompliance,
        encryptedClientHello: securityDetails.encryptedClientHello,
    }

    const hasValidDomain = validDomains.some(pattern => matchesDomain(certificate.subjectName, pattern) || certificate.sanList.some(san => matchesDomain(san, pattern)))

    if (hasValidDomain) {
        console.log(certificate)
    }

    // Move compliance check to server side
    const compliance = complianceCheck(certificate, policy)
})
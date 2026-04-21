import { useState, useEffect } from "react"
import { getStoredAccessToken } from "./storage"
import { Loader2 } from "lucide-react"
import AuthPage from "./AuthPage"
import UserPage from "./UserPage"
import OrganisationPage from "./OrganisationPage"
import PolicyPage from "./PolicyPage"
import ConsentPage from "./ConsentPage"
import CertificatePage from "./CertificatePage"
import CompliancePage from "./CompliancePage"

type Page = "loading" | "auth" | "user" | "organisation" | "policy" | "consent" | "certificate" | "compliance"

export default function App() {
  const [page, setPage] = useState<Page>("loading")

  useEffect(() => {
    async function checkToken() {
      const token = await getStoredAccessToken()
      setPage(token ? "user" : "auth")
    }
    checkToken()
  }, [])

  if (page === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (page === "auth") {
    return <AuthPage onSignIn={() => setPage("user")} />
  }

  if (page === "organisation") {
    return (
      <OrganisationPage
        onBack={() => setPage("user")}
        onSignOut={() => setPage("auth")}
      />
    )
  }

  if (page === "policy") {
    return (
      <PolicyPage
        onBack={() => setPage("user")}
        onSignOut={() => setPage("auth")}
      />
    )
  }

  if (page === "consent") {
    return (
      <ConsentPage
        onBack={() => setPage("user")}
        onSignOut={() => setPage("auth")}
      />
    )
  }

  if (page === "certificate") {
    return (
      <CertificatePage
        onBack={() => setPage("user")}
        onSignOut={() => setPage("auth")}
      />
    )
  }

  if (page === "compliance") {
    return (
      <CompliancePage
        onBack={() => setPage("user")}
        onSignOut={() => setPage("auth")}
      />
    )
  }

  return (
    <UserPage
      onSignOut={() => setPage("auth")}
      onGoToOrganisation={() => setPage("organisation")}
      onGoToPolicy={() => setPage("policy")}
      onGoToConsent={() => setPage("consent")}
      onGoToCertificate={() => setPage("certificate")}
      onGoToCompliance={() => setPage("compliance")}
    />
  )
}
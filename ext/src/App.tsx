import { useState, useEffect } from "react"
import { getStoredAccessToken } from "./storage"
import { Loader2 } from "lucide-react"
import AuthPage from "./AuthPage"
import UserPage from "./UserPage"

export default function App() {
  const [page, setPage] = useState<"auth" | "user" | "loading">("loading")

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

  if (page === "user") {
    return <UserPage onSignOut={() => setPage("auth")} />
  }

  return <AuthPage onSignIn={() => setPage("user")} />
}
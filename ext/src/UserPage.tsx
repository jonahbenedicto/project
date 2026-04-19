import { useState, useEffect } from "react"
import { getStoredAccessToken, clearStorage } from "./storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Loader2, LogOut, Mail, Hash, Calendar } from "lucide-react"

const API_BASE = "http://127.0.0.1:5000"

interface User {
  user_id: number
  name: string
  username: string
  email: string
  created_at: string
}

export default function UserPage({ onSignOut }: { onSignOut: () => void }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    async function loadUser() {
      const token = await getStoredAccessToken()
      if (!token) {
        onSignOut()
        return
      }
      const res = await fetch(`${API_BASE}/api/user/info`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        await clearStorage()
        onSignOut()
        return
      }
      setUser(await res.json())
    }
    loadUser()
  }, [])

  async function handleSignOut() {
    await clearStorage()
    onSignOut()
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const joined = new Date(user.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
  const initials = user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-xs">
        <CardHeader className="items-center gap-3 pb-3">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary ring-2 ring-primary/20">
              {initials}
            </div>
            <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold leading-tight">{user.name}</p>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          </div>
          <Badge variant="secondary" className="text-xs">Authenticated</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Separator />
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3.5 w-3.5" /><span className="text-xs">Email</span></div>
              <span className="truncate text-right text-xs font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-muted-foreground"><Hash className="h-3.5 w-3.5" /><span className="text-xs">User ID</span></div>
              <span className="truncate text-right text-xs font-medium">{user.user_id}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="h-3.5 w-3.5" /><span className="text-xs">Joined</span></div>
              <span className="truncate text-right text-xs font-medium">{joined}</span>
            </div>
          </div>
          <Separator />
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleSignOut}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
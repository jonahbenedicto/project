import { useState, useEffect, useCallback } from "react"
import { getStoredAccessToken, clearStorage } from "./storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Crown, Shield, User, AtSign,
  Loader2, Mail, Calendar, LogOut, Building2, ScrollText, ShieldCheck, ChevronRight,
} from "lucide-react"

const API_BASE = "http://127.0.0.1:5000"

interface UserInfo {
  user_id: number
  name: string
  username: string
  email: string
  created_at: string
}

type Role = "owner" | "admin" | "member" | null

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <span className="truncate text-right text-xs font-medium">{value}</span>
    </div>
  )
}

export default function UserPage({
  onSignOut,
  onGoToOrganisation,
  onGoToPolicy,
  onGoToConsent,
}: {
  onSignOut: () => void
  onGoToOrganisation: () => void
  onGoToPolicy: () => void
  onGoToConsent: () => void
}) {
  const [user, setUser]     = useState<UserInfo | null>(null)
  const [hasOrg, setHasOrg] = useState(false)
  const [role, setRole]     = useState<Role>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const token = await getStoredAccessToken()
    if (!token) { onSignOut(); return }

    const headers = { Authorization: `Bearer ${token}` }

    const [userRes, orgRes] = await Promise.all([
      fetch(`${API_BASE}/api/user/info`,         { headers }),
      fetch(`${API_BASE}/api/organisation/info`, { headers }),
    ])

    if (!userRes.ok) { await clearStorage(); onSignOut(); return }
    setUser(await userRes.json())

    if (orgRes.ok) {
      setHasOrg(true)
      const roleRes = await fetch(`${API_BASE}/api/organisation/role`, { headers })
      if (roleRes.ok) {
        const roleData = await roleRes.json()
        setRole(roleData.role as Role)
      }
    } else {
      setHasOrg(false)
      setRole(null)
    }

    setLoading(false)
  }, [onSignOut])

  useEffect(() => { loadData() }, [loadData])

  async function handleSignOut() {
    await clearStorage()
    onSignOut()
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const joinedAt    = new Date(user.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
  const roleLabel   = role === "owner" ? "Owner" : role === "admin" ? "Admin" : role === "member" ? "Member" : null
  const RoleBadgeIcon = role === "owner" ? Crown : role === "admin" ? Shield : User

  return (
    <div className="flex min-h-screen items-start p-4">
      <div className="flex w-full flex-col gap-3">

        {/* ── User card ──────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">User</span>
              {roleLabel && (
                <Badge
                  variant={role === "owner" ? "default" : role === "admin" ? "secondary" : "outline"}
                  className="ml-auto gap-1 text-xs"
                >
                  <RoleBadgeIcon className="h-2.5 w-2.5" />{roleLabel}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-3">
              <InfoRow icon={User}     label="Name"     value={user.name} />
              <InfoRow icon={AtSign}   label="Username" value={`@${user.username}`} />
              <InfoRow icon={Mail}     label="Email"    value={user.email} />
              <InfoRow icon={Calendar} label="Joined"   value={joinedAt} />
            </div>
            <Separator />
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleSignOut}>
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </CardContent>
        </Card>

        {/* ── Navigation buttons ─────────────────────────────────────────── */}
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4 pb-4">
            <Button
              variant="ghost"
              className="w-full justify-between text-sm font-normal h-10"
              onClick={onGoToOrganisation}
            >
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Organisation
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>

            {hasOrg && (
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-between text-sm font-normal h-10"
                  onClick={onGoToPolicy}
                >
                  <span className="flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-muted-foreground" />
                    Policy
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-between text-sm font-normal h-10"
                  onClick={onGoToConsent}
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    Consent
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
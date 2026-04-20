import { useState, useEffect, useCallback } from "react"
import { getStoredAccessToken } from "./storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  UserPlus, Copy, Check, AlertCircle, Crown, Shield, User,
  ChevronLeft, Loader2, Calendar, Building2, Plus,
} from "lucide-react"

const API_BASE = "http://127.0.0.1:5000"

interface Organisation {
  organisation_id: number
  name: string
  owner_id: number
  active_policy_id: number | null
  created_at: string
}

interface Invite {
  invite_id: number
  invite_code: string
  role: string
  expires_at: string
  usage_count: number
  max_usage: number
  created_at: string
}

type Role = "owner" | "admin" | "member" | null

async function apiRequest(path: string, options: RequestInit = {}) {
  const token = await getStoredAccessToken()
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })
}

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

export default function OrganisationPage({
  onBack,
  onSignOut,
}: {
  onBack: () => void
  onSignOut: () => void
}) {
  const [org, setOrg]       = useState<Organisation | null>(null)
  const [hasOrg, setHasOrg] = useState(false)
  const [role, setRole]     = useState<Role>(null)
  const [loading, setLoading] = useState(true)

  // Create org
  const [orgName, setOrgName]               = useState("")
  const [creatingOrg, setCreatingOrg]       = useState(false)
  const [createOrgError, setCreateOrgError] = useState("")

  // Join org
  const [joinCode, setJoinCode]         = useState("")
  const [joiningOrg, setJoiningOrg]     = useState(false)
  const [joinOrgError, setJoinOrgError] = useState("")

  // Invite
  const [inviteRole, setInviteRole]               = useState("member")
  const [creatingInvite, setCreatingInvite]       = useState(false)
  const [createInviteError, setCreateInviteError] = useState("")
  const [createdInvite, setCreatedInvite]         = useState<Invite | null>(null)
  const [copied, setCopied] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const token = await getStoredAccessToken()
    if (!token) { onSignOut(); return }

    const headers = { Authorization: `Bearer ${token}` }
    const orgRes  = await fetch(`${API_BASE}/api/organisation/info`, { headers })

    if (orgRes.ok) {
      setOrg(await orgRes.json())
      setHasOrg(true)

      const roleRes = await fetch(`${API_BASE}/api/organisation/role`, { headers })
      if (roleRes.ok) {
        const roleData = await roleRes.json()
        setRole(roleData.role as Role)
        setInviteRole(roleData.role === "owner" ? "admin" : "member")
      }
    } else {
      setOrg(null)
      setHasOrg(false)
      setRole(null)
    }

    setLoading(false)
  }, [onSignOut])

  useEffect(() => { loadData() }, [loadData])

  async function handleCreateOrg() {
    setCreateOrgError("")
    setCreatingOrg(true)
    const res  = await apiRequest("/api/organisation/create", { method: "POST", body: JSON.stringify({ name: orgName }) })
    const data = await res.json()
    if (!res.ok) { setCreateOrgError(data.message || "Failed to create organisation"); setCreatingOrg(false); return }
    setOrg(data)
    setHasOrg(true)
    setRole("owner")
    setInviteRole("admin")
    setCreatingOrg(false)
  }

  async function handleJoinOrg() {
    setJoinOrgError("")
    setJoiningOrg(true)
    const res  = await apiRequest(`/api/invite/accept/${joinCode.trim()}`, { method: "POST" })
    const data = await res.json()
    if (!res.ok) { setJoinOrgError(data.message || "Failed to join organisation"); setJoiningOrg(false); return }
    setOrg(data)
    setHasOrg(true)
    setJoiningOrg(false)
    const roleRes = await apiRequest("/api/organisation/role")
    if (roleRes.ok) {
      const roleData = await roleRes.json()
      setRole(roleData.role as Role)
      setInviteRole(roleData.role === "owner" ? "admin" : "member")
    }
  }

  async function handleCreateInvite() {
    setCreateInviteError("")
    setCreatingInvite(true)
    setCreatedInvite(null)
    const res  = await apiRequest("/api/invite/create", { method: "POST", body: JSON.stringify({ role: inviteRole, max_usage: 1 }) })
    const data = await res.json()
    if (!res.ok) { setCreateInviteError(data.message || "Failed to create invite"); setCreatingInvite(false); return }
    setCreatedInvite(data)
    setCreatingInvite(false)
  }

  async function handleCopy() {
    if (!createdInvite) return
    await navigator.clipboard.writeText(createdInvite.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canInvite = role === "owner" || role === "admin"
  const roleLabel = role === "owner" ? "Owner" : role === "admin" ? "Admin" : role === "member" ? "Member" : null
  const RoleBadgeIcon = role === "owner" ? Crown : role === "admin" ? Shield : User

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-start p-4">
      <div className="flex w-full flex-col gap-3">

        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">Organisation</span>
        </div>

        <Card>
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">
                Organisation
              </span>
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

            {!hasOrg ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Create an organisation or join one with an invite code.
                </p>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Organisation name</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Acme Inc."
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && orgName.trim() && handleCreateOrg()}
                      className="text-xs"
                    />
                    <Button size="sm" onClick={handleCreateOrg} disabled={creatingOrg || !orgName.trim()}>
                      {creatingOrg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {createOrgError && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <AlertDescription className="text-xs">{createOrgError}</AlertDescription>
                    </Alert>
                  )}
                </div>

                <Separator />

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Invite code</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste invite code"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && joinCode.trim() && handleJoinOrg()}
                      className="font-mono text-xs"
                    />
                    <Button size="sm" onClick={handleJoinOrg} disabled={joiningOrg || !joinCode.trim()}>
                      {joiningOrg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {joinOrgError && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <AlertDescription className="text-xs">{joinOrgError}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  <InfoRow icon={Building2} label="Name" value={org!.name} />
                  <InfoRow
                    icon={Calendar}
                    label="Created"
                    value={new Date(org!.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  />
                </div>

                {canInvite && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium">Invite</p>
                      <div className="flex gap-2">
                        <Select
                          value={inviteRole}
                          onValueChange={(v) => { setInviteRole(v); setCreatedInvite(null); setCreateInviteError("") }}
                        >
                          <SelectTrigger className="h-9 flex-1 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {role === "owner" && (
                              <SelectItem value="admin" className="text-xs">
                                <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" />Admin</span>
                              </SelectItem>
                            )}
                            <SelectItem value="member" className="text-xs">
                              <span className="flex items-center gap-1.5"><User className="h-3 w-3" />Member</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={handleCreateInvite} disabled={creatingInvite}>
                          {creatingInvite
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <UserPlus className="h-3.5 w-3.5" />}
                        </Button>
                      </div>

                      {createInviteError && (
                        <Alert variant="destructive" className="py-2">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <AlertDescription className="text-xs">{createInviteError}</AlertDescription>
                        </Alert>
                      )}

                      {createdInvite && (
                        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Invite code</span>
                            <Badge variant="outline" className="gap-1 text-xs capitalize">
                              {createdInvite.role === "admin"
                                ? <Shield className="h-2.5 w-2.5" />
                                : <User className="h-2.5 w-2.5" />}
                              {createdInvite.role}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 text-xs font-mono ring-1 ring-border">
                              {createdInvite.invite_code}
                            </code>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
                              {copied
                                ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                                : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">Expires in 2 min · 1 use</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
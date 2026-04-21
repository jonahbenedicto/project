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
  AlertCircle, ScrollText, ChevronDown, ChevronUp, Star,
  ChevronLeft, Loader2, Calendar, Plus, X,
  Network, Key, Lock, Globe, Building, Clock, ShieldAlert
} from "lucide-react"

const API_BASE = "http://127.0.0.1:5000"

interface Organisation {
  organisation_id: number
  name: string
  owner_id: number
  active_policy_id: number | null
  created_at: string
}

interface Policy {
  policy_id: number
  organisation_id: number
  name: string
  created_at: string
  valid_protocols: string[]
  valid_key_exchanges: string[]
  valid_key_exchange_groups: string[]
  valid_ciphers: string[]
  valid_macs: string[]
  valid_domains: string[]
  valid_issuers: string[]
  min_days_until_expiration: number
  max_days_since_issuance: number
  require_signed_certificate_timestamp_list: boolean
  require_certificate_transparency_compliance: boolean
  require_encrypted_client_hello: boolean
}

type Role = "owner" | "admin" | "member" | null

const emptyPolicyForm = {
  name: "",
  valid_protocols:           [] as string[],
  valid_key_exchanges:       [] as string[],
  valid_key_exchange_groups: [] as string[],
  valid_ciphers:             [] as string[],
  valid_macs:                [] as string[],
  valid_domains:             [] as string[],
  valid_issuers:             [] as string[],
  min_days_until_expiration: "30",
  max_days_since_issuance: "365",
  require_signed_certificate_timestamp_list: false,
  require_certificate_transparency_compliance: false,
  require_encrypted_client_hello: false,
}

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

// ── Tag input ──────────────────────────────────────────────────────────────

function TagInput({
  tags, onAdd, onRemove, placeholder,
}: {
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
  placeholder?: string
}) {
  const [value, setValue] = useState("")
  return (
    <div className="flex flex-wrap gap-1 rounded-md border bg-background px-2 py-1.5 min-h-[2rem] focus-within:ring-1 focus-within:ring-ring">
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
          {tag}
          <button
            type="button"
            onClick={() => onRemove(tag)}
            className="ml-0.5 rounded text-muted-foreground hover:text-foreground"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[6rem] bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        value={value}
        placeholder={tags.length === 0 ? placeholder : ""}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && value.trim()) {
            e.preventDefault()
            onAdd(value.trim())
            setValue("")
          }
        }}
      />
    </div>
  )
}

// ── Shared display helpers ─────────────────────────────────────────────────

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

function TagList({ icon: Icon, label, values }: { icon: React.ElementType; label: string; values: string[] }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex flex-wrap justify-end gap-1">
        {values.length > 0 ? values.map(v => (
          <Badge key={v} variant="outline" className="text-xs font-normal px-1.5 py-0 text-muted-foreground">{v}</Badge>
        )) : (
          <Badge variant="outline" className="text-xs font-normal px-1.5 py-0 text-muted-foreground">Any</Badge>
        )}
      </div>
    </div>
  )
}

function BoolRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <Badge variant={value ? "default" : "outline"} className="text-xs font-normal px-1.5 py-0 text-muted-foreground">
        {value ? "Required" : "Optional"}
      </Badge>
    </div>
  )
}

// ── Policy detail ──────────────────────────────────────────────────────────

function PolicyDetail({ policy }: { policy: Policy }) {
  return (
    <div className="flex flex-col gap-3">
      <InfoRow
        icon={ScrollText}
        label="Name"
        value={policy.name}
      />
      <InfoRow
        icon={Calendar}
        label="Created"
        value={new Date(policy.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
      />
      <TagList icon={Network}   label="Protocols"          values={policy.valid_protocols} />
      <TagList icon={Key}       label="Key exchanges"      values={policy.valid_key_exchanges} />
      <TagList icon={Key}       label="Key exchange groups"          values={policy.valid_key_exchange_groups} />
      <TagList icon={Lock}      label="Ciphers"            values={policy.valid_ciphers} />
      <TagList icon={Lock}      label="MACs"               values={policy.valid_macs} />
      <TagList icon={Globe}     label="Domains"            values={policy.valid_domains} />
      <TagList icon={Building}  label="Issuers"            values={policy.valid_issuers} />
      <InfoRow icon={Clock}     label="Min days until expiration"   value={`${policy.min_days_until_expiration} days`} />
      <InfoRow icon={Clock}     label="Max days since issuance"  value={`${policy.max_days_since_issuance} days`} />
      <BoolRow icon={ShieldAlert} label="Signed certificate timestamp list"               value={policy.require_signed_certificate_timestamp_list} />
      <BoolRow icon={ShieldAlert} label="Certificate transparency compliance"          value={policy.require_certificate_transparency_compliance} />
      <BoolRow icon={ShieldAlert} label="Encrypted client hello"  value={policy.require_encrypted_client_hello} />
    </div>
  )
}

// ── Collapsible policy row ──────────────────────────────────────────────────

function CollapsiblePolicy({
  policy, isActive, canManage, settingActive, onSetActive,
}: {
  policy: Policy
  isActive: boolean
  canManage: boolean
  settingActive: number | null
  onSetActive: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border overflow-hidden">
      <button
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold">{policy.name}</span>
          {isActive && <Badge variant="default" className="gap-1 text-xs px-1.5 py-0"><Star className="h-2 w-2" />Active</Badge>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canManage && !isActive && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              disabled={settingActive === policy.policy_id}
              onClick={e => { e.stopPropagation(); onSetActive(policy.policy_id) }}
            >
              {settingActive === policy.policy_id
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : "Set active"}
            </Button>
          )}
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="border-t px-2.5 py-2.5">
          <PolicyDetail policy={policy} />
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function PolicyPage({
  onBack,
  onSignOut,
}: {
  onBack: () => void
  onSignOut: () => void
}) {
  const [org, setOrg]         = useState<Organisation | null>(null)
  const [role, setRole]       = useState<Role>(null)
  const [loading, setLoading] = useState(true)

  const [policies, setPolicies]               = useState<Policy[]>([])
  const [activePolicy, setActivePolicy]       = useState<Policy | null>(null)
  const [policyForm, setPolicyForm]           = useState(emptyPolicyForm)
  const [creatingPolicy, setCreatingPolicy]   = useState(false)
  const [createPolicyError, setCreatePolicyError] = useState("")
  const [settingActive, setSettingActive]     = useState<number | null>(null)
  const [setPolicyError, setSetPolicyError]   = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    const token = await getStoredAccessToken()
    if (!token) { onSignOut(); return }

    const headers = { Authorization: `Bearer ${token}` }

    const orgRes = await fetch(`${API_BASE}/api/organisation/info`, { headers })
    if (!orgRes.ok) { setLoading(false); return }

    const orgData = await orgRes.json()
    setOrg(orgData)

    const [roleRes, policiesRes, activePolicyRes] = await Promise.all([
      fetch(`${API_BASE}/api/organisation/role`,  { headers }),
      fetch(`${API_BASE}/api/policy/list`,        { headers }),
      fetch(`${API_BASE}/api/policy/active`,      { headers }),
    ])

    if (roleRes.ok) {
      const roleData = await roleRes.json()
      setRole(roleData.role as Role)
    }
    if (policiesRes.ok) setPolicies(await policiesRes.json())
    if (activePolicyRes.ok) setActivePolicy(await activePolicyRes.json())
    else setActivePolicy(null)

    setLoading(false)
  }, [onSignOut])

  useEffect(() => { loadData() }, [loadData])

  async function handleCreatePolicy() {
    setCreatePolicyError("")
    setCreatingPolicy(true)
    const body = {
      name:                      policyForm.name,
      valid_protocols:           policyForm.valid_protocols,
      valid_key_exchanges:       policyForm.valid_key_exchanges,
      valid_key_exchange_groups: policyForm.valid_key_exchange_groups,
      valid_ciphers:             policyForm.valid_ciphers,
      valid_macs:                policyForm.valid_macs,
      valid_domains:             policyForm.valid_domains,
      valid_issuers:             policyForm.valid_issuers,
      min_days_until_expiration: parseInt(policyForm.min_days_until_expiration) || 0,
      max_days_since_issuance:   parseInt(policyForm.max_days_since_issuance) || 0,
      require_signed_certificate_timestamp_list: policyForm.require_signed_certificate_timestamp_list,
      require_certificate_transparency_compliance: policyForm.require_certificate_transparency_compliance,
      require_encrypted_client_hello: policyForm.require_encrypted_client_hello,
    }
    const res  = await apiRequest("/api/policy/create", { method: "POST", body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setCreatePolicyError(data.message || "Failed to create policy"); setCreatingPolicy(false); return }
    setPolicies(prev => [...prev, data])
    setPolicyForm(emptyPolicyForm)
    setCreatingPolicy(false)
  }

  async function handleSetActivePolicy(policyId: number) {
    setSetPolicyError("")
    setSettingActive(policyId)
    const res  = await apiRequest(`/api/policy/active/${policyId}`, { method: "POST" })
    const data = await res.json()
    if (!res.ok) { setSetPolicyError(data.message || "Failed to set active policy"); setSettingActive(null); return }
    setOrg(data)
    const policyRes = await apiRequest(`/api/policy/${policyId}`)
    if (policyRes.ok) setActivePolicy(await policyRes.json())
    setSettingActive(null)
  }

  const canManagePolicies = role === "owner" || role === "admin"

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex min-h-screen items-start p-4">
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold">Policy</span>
          </div>
          <p className="text-xs text-muted-foreground px-1">You must be in an organisation to view policies.</p>
        </div>
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
          <span className="text-sm font-semibold">Policy</span>
        </div>

        <Card>
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Policy</span>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-1">

            {/* Active policy */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">Active</p>
              {activePolicy ? (
                <div className="rounded-md border overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                    <span className="text-xs font-semibold">{activePolicy.name}</span>
                    <Badge variant="default" className="gap-1 text-xs px-1.5 py-0"><Star className="h-2 w-2" />Active</Badge>
                  </div>
                  <div className="border-t px-2.5 py-2.5">
                    <PolicyDetail policy={activePolicy} />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">None set.</p>
              )}
            </div>

            {/* All policies */}
            {policies.filter(p => p.policy_id !== org?.active_policy_id).length > 0 && (
              <>
                <Separator />
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">All</p>
                  {setPolicyError && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <AlertDescription className="text-xs">{setPolicyError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex flex-col gap-2">
                    {policies.filter(p => p.policy_id !== org?.active_policy_id).map(p => (
                      <CollapsiblePolicy
                        key={p.policy_id}
                        policy={p}
                        isActive={p.policy_id === org?.active_policy_id}
                        canManage={canManagePolicies}
                        settingActive={settingActive}
                        onSetActive={handleSetActivePolicy}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Create policy — owner/admin only */}
            {canManagePolicies && (
              <>
                <Separator />
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">New</p>
                  <div className="rounded-md border overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                      <span className="text-xs font-mono text-muted-foreground">New</span>
                    </div>
                    <div className="border-t px-2.5 py-2.5 flex flex-col gap-2">
                      <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <Input
                          className="h-8 text-xs"
                          value={policyForm.name}
                          onChange={e => setPolicyForm(f => ({ ...f, name: e.target.value }))}
                        />
                      </div>
                      {(
                        [
                          ["valid_protocols",           "Protocols"],
                          ["valid_key_exchanges",       "Key exchanges"],
                          ["valid_key_exchange_groups", "Key exchange groups"],
                          ["valid_ciphers",             "Ciphers"],
                          ["valid_macs",                "Message authentication codes"],
                          ["valid_domains",             "Domains"],
                          ["valid_issuers",             "Issuers"],
                        ] as [keyof typeof emptyPolicyForm, string][]
                      ).map(([key, label]) => (
                        <div key={key} className="grid gap-1">
                          <Label className="text-xs text-muted-foreground">{label}</Label>
                          <TagInput
                            tags={policyForm[key] as string[]}
                            onAdd={tag => setPolicyForm(f => ({ ...f, [key]: [...(f[key] as string[]), tag] }))}
                            onRemove={tag => setPolicyForm(f => ({ ...f, [key]: (f[key] as string[]).filter(t => t !== tag) }))}
                          />
                        </div>
                      ))}

                      <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">Min days until expiration</Label>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={policyForm.min_days_until_expiration}
                          onChange={e => setPolicyForm(f => ({ ...f, min_days_until_expiration: e.target.value }))}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">Max days since issuance</Label>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={policyForm.max_days_since_issuance}
                          onChange={e => setPolicyForm(f => ({ ...f, max_days_since_issuance: e.target.value }))}
                        />
                      </div>

                      {(
                        [
                          ["require_signed_certificate_timestamp_list",   "Signed certificate timestamp list"],
                          ["require_certificate_transparency_compliance",  "Certificate transparency compliance"],
                          ["require_encrypted_client_hello",               "Encrypted client hello"],
                        ] as [keyof typeof emptyPolicyForm, string][]
                      ).map(([key, label]) => (
                        <div key={key} className="grid gap-1">
                          <Label className="text-xs text-muted-foreground">{label}</Label>
                          <Select
                            value={policyForm[key] ? "true" : "false"}
                            onValueChange={v => setPolicyForm(f => ({ ...f, [key]: v === "true" }))}
                          >
                            <SelectTrigger className="h-8 w-full text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true" className="text-xs">Required</SelectItem>
                              <SelectItem value="false" className="text-xs">Optional</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}

                      {createPolicyError && (
                        <Alert variant="destructive" className="py-2">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <AlertDescription className="text-xs">{createPolicyError}</AlertDescription>
                        </Alert>
                      )}

                      <Button size="sm" className="w-full" disabled={creatingPolicy} onClick={handleCreatePolicy}>
                        {creatingPolicy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
                        Create
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

          </CardContent>
        </Card>

      </div>
    </div>
  )
}
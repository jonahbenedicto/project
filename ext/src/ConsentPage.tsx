import { useState, useEffect, useCallback } from "react"
import { getStoredAccessToken } from "./storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertCircle, ShieldCheck, ShieldOff, ChevronLeft, ChevronDown, ChevronUp, Star,
  Loader2, Calendar, ScrollText, CheckCircle2, XCircle,
  Network, Key, Lock, Globe, Building, Clock, ShieldAlert,
} from "lucide-react"

const API_BASE = "http://127.0.0.1:5000"

interface Consent {
  consent_id: number
  user_id: number
  policy_id: number
  has_consent: boolean
  created_at: string
  revoked_at: string | null
}

interface Policy {
  policy_id: number
  organisation_id: number
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

function TagList({ icon: Icon, label, values }: { icon: React.ElementType; label: string; values: string[] }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex flex-wrap justify-end gap-1">
        {values.length > 0 ? values.map(v => (
          <Badge key={v} variant="secondary" className="text-xs font-mono font-normal px-1.5 py-0">{v}</Badge>
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
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      {value
        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
    </div>
  )
}

function PolicyDetail({ policy }: { policy: Policy }) {
  return (
    <div className="flex flex-col gap-3">
      <InfoRow
        icon={ScrollText}
        label="Policy ID"
        value={<span className="font-mono">#{policy.policy_id}</span>}
      />
      <InfoRow
        icon={Calendar}
        label="Created"
        value={new Date(policy.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
      />
      <TagList icon={Network}   label="Protocols"            values={policy.valid_protocols} />
      <TagList icon={Key}       label="Key exchanges"        values={policy.valid_key_exchanges} />
      <TagList icon={Key}       label="KE groups"            values={policy.valid_key_exchange_groups} />
      <TagList icon={Lock}      label="Ciphers"              values={policy.valid_ciphers} />
      <TagList icon={Lock}      label="MACs"                 values={policy.valid_macs} />
      <TagList icon={Globe}     label="Domains"              values={policy.valid_domains} />
      <TagList icon={Building}  label="Issuers"              values={policy.valid_issuers} />
      <InfoRow icon={Clock}     label="Min days to expiry"   value={`${policy.min_days_until_expiration} days`} />
      <InfoRow icon={Clock}     label="Max days since issue" value={`${policy.max_days_since_issuance} days`} />
      <BoolRow icon={ShieldAlert} label="Require SCT list"               value={policy.require_signed_certificate_timestamp_list} />
      <BoolRow icon={ShieldAlert} label="Require CT compliance"          value={policy.require_certificate_transparency_compliance} />
      <BoolRow icon={ShieldAlert} label="Require encrypted client hello" value={policy.require_encrypted_client_hello} />
    </div>
  )
}

// ── Consent action footer (shared by both card variants) ─────────────────────

function ConsentActions({
  policyId,
  consent,
  acting,
  actionError,
  onGive,
  onRevoke,
}: {
  policyId: number
  consent: Consent | null
  acting: boolean
  actionError: string
  onGive: (id: number) => void
  onRevoke: (id: number) => void
}) {
  const hasConsent = consent?.has_consent === true

  return (
    <>
      {consent && (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <InfoRow
              icon={Calendar}
              label="Consented"
              value={new Date(consent.created_at).toLocaleDateString("en-AU", {
                day: "numeric", month: "short", year: "numeric",
              })}
            />
            {consent.revoked_at && (
              <InfoRow
                icon={Calendar}
                label="Revoked"
                value={new Date(consent.revoked_at).toLocaleDateString("en-AU", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              />
            )}
          </div>
        </>
      )}

      {actionError && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">{actionError}</AlertDescription>
        </Alert>
      )}

      {hasConsent ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-destructive hover:text-destructive"
          disabled={acting}
          onClick={e => { e.stopPropagation(); onRevoke(policyId) }}
        >
          {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
          Revoke consent
        </Button>
      ) : (
        <Button
          size="sm"
          className="w-full gap-2"
          disabled={acting}
          onClick={e => { e.stopPropagation(); onGive(policyId) }}
        >
          {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Give consent
        </Button>
      )}
    </>
  )
}

// ── Active policy card (always expanded) ─────────────────────────────────────

function ActivePolicyCard({
  policy, consent, acting, actionError, onGive, onRevoke,
}: {
  policy: Policy
  consent: Consent | null
  acting: boolean
  actionError: string
  onGive: (id: number) => void
  onRevoke: (id: number) => void
}) {
  const hasConsent = consent?.has_consent === true
  const hasRevoked = consent?.has_consent === false

  return (
    <div className="rounded-md border overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <span className="text-xs font-mono text-muted-foreground">#{policy.policy_id}</span>
        <div className="flex items-center gap-1.5">
          <Badge variant="default" className="gap-1 text-xs px-1.5 py-0">
            <Star className="h-2 w-2" />Active
          </Badge>
          <Badge
            variant={hasConsent ? "default" : hasRevoked ? "destructive" : "outline"}
            className="text-xs px-1.5 py-0"
          >
            {hasConsent ? "Consented" : hasRevoked ? "Revoked" : "No consent"}
          </Badge>
        </div>
      </div>
      <div className="border-t px-2.5 py-2.5 flex flex-col gap-3">
        <PolicyDetail policy={policy} />
        <ConsentActions
          policyId={policy.policy_id}
          consent={consent}
          acting={acting}
          actionError={actionError}
          onGive={onGive}
          onRevoke={onRevoke}
        />
      </div>
    </div>
  )
}

// ── Collapsible policy row (non-active) ──────────────────────────────────────

function CollapsibleConsentPolicy({
  policy, consent, acting, onGive, onRevoke,
}: {
  policy: Policy
  consent: Consent | null
  acting: boolean
  onGive: (id: number) => void
  onRevoke: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const hasConsent = consent?.has_consent === true
  const hasRevoked = consent?.has_consent === false

  return (
    <div className="rounded-md border overflow-hidden">
      <button
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-xs font-mono text-muted-foreground">#{policy.policy_id}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant={hasConsent ? "default" : hasRevoked ? "destructive" : "outline"}
            className="text-xs px-1.5 py-0"
          >
            {hasConsent ? "Consented" : hasRevoked ? "Revoked" : "No consent"}
          </Badge>
          {open
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-2.5 py-2.5 flex flex-col gap-3">
          <PolicyDetail policy={policy} />
          <ConsentActions
            policyId={policy.policy_id}
            consent={consent}
            acting={acting}
            actionError=""
            onGive={onGive}
            onRevoke={onRevoke}
          />
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConsentPage({
  onBack,
  onSignOut,
}: {
  onBack: () => void
  onSignOut: () => void
}) {
  const [policies, setPolicies]             = useState<Policy[]>([])
  const [activePolicyId, setActivePolicyId] = useState<number | null>(null)
  const [consents, setConsents]             = useState<Consent[]>([])
  const [noOrg, setNoOrg]                   = useState(false)
  const [loading, setLoading]               = useState(true)

  // Per-policy acting / error state
  const [acting, setActing]           = useState<Record<number, boolean>>({})
  const [actionError, setActionError] = useState<Record<number, string>>({})

  const loadData = useCallback(async () => {
    setLoading(true)
    const token = await getStoredAccessToken()
    if (!token) { onSignOut(); return }

    const headers = { Authorization: `Bearer ${token}` }

    const orgRes = await fetch(`${API_BASE}/api/organisation/info`, { headers })
    if (!orgRes.ok) {
      setNoOrg(true)
      setLoading(false)
      return
    }

    const [policiesRes, activePolicyRes, consentsRes] = await Promise.all([
      fetch(`${API_BASE}/api/policy/list`,   { headers }),
      fetch(`${API_BASE}/api/policy/active`, { headers }),
      fetch(`${API_BASE}/api/consent/list`,  { headers }),
    ])

    if (policiesRes.ok)     setPolicies(await policiesRes.json())
    if (activePolicyRes.ok) {
      const p: Policy = await activePolicyRes.json()
      setActivePolicyId(p.policy_id)
    } else {
      setActivePolicyId(null)
    }
    if (consentsRes.ok) setConsents(await consentsRes.json())

    setLoading(false)
  }, [onSignOut])

  useEffect(() => { loadData() }, [loadData])

  async function handleGiveConsent(policyId: number) {
    setActionError(e => ({ ...e, [policyId]: "" }))
    setActing(a => ({ ...a, [policyId]: true }))
    const res  = await apiRequest(`/api/consent/give/${policyId}`, { method: "POST" })
    const data = await res.json()
    if (!res.ok) {
      setActionError(e => ({ ...e, [policyId]: data.message || "Failed to give consent" }))
      setActing(a => ({ ...a, [policyId]: false }))
      return
    }
    setConsents(prev => [data, ...prev.filter(c => c.policy_id !== policyId)])
    setActing(a => ({ ...a, [policyId]: false }))
  }

  async function handleRevokeConsent(policyId: number) {
    setActionError(e => ({ ...e, [policyId]: "" }))
    setActing(a => ({ ...a, [policyId]: true }))
    const res  = await apiRequest(`/api/consent/revoke/${policyId}`, { method: "PATCH" })
    const data = await res.json()
    if (!res.ok) {
      setActionError(e => ({ ...e, [policyId]: data.message || "Failed to revoke consent" }))
      setActing(a => ({ ...a, [policyId]: false }))
      return
    }
    setConsents(prev => prev.map(c => c.policy_id === policyId ? data : c))
    setActing(a => ({ ...a, [policyId]: false }))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (noOrg) {
    return (
      <div className="flex min-h-screen items-start p-4">
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold">Consent</span>
          </div>
          <p className="text-xs text-muted-foreground px-1">You must be in an organisation to manage consent.</p>
        </div>
      </div>
    )
  }

  const activePolicy  = policies.find(p => p.policy_id === activePolicyId) ?? null
  const otherPolicies = policies.filter(p => p.policy_id !== activePolicyId)
  const consentMap    = Object.fromEntries(consents.map(c => [c.policy_id, c]))

  return (
    <div className="flex min-h-screen items-start p-4">
      <div className="flex w-full flex-col gap-3">

        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">Consent</span>
        </div>

        <Card>
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Consent</span>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-1">

            {/* Active policy */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">Active</p>
              {activePolicy ? (
                <ActivePolicyCard
                  policy={activePolicy}
                  consent={consentMap[activePolicy.policy_id] ?? null}
                  acting={acting[activePolicy.policy_id] ?? false}
                  actionError={actionError[activePolicy.policy_id] ?? ""}
                  onGive={handleGiveConsent}
                  onRevoke={handleRevokeConsent}
                />
              ) : (
                <p className="text-xs text-muted-foreground italic">No active policy has been set for your organisation.</p>
              )}
            </div>

            {/* Other policies */}
            {otherPolicies.length > 0 && (
              <>
                <Separator />
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">All</p>
                  <div className="flex flex-col gap-2">
                    {otherPolicies.map(p => (
                      <CollapsibleConsentPolicy
                        key={p.policy_id}
                        policy={p}
                        consent={consentMap[p.policy_id] ?? null}
                        acting={acting[p.policy_id] ?? false}
                        onGive={handleGiveConsent}
                        onRevoke={handleRevokeConsent}
                      />
                    ))}
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
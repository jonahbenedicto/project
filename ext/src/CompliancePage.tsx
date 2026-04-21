import { useState, useEffect, useCallback } from "react"
import { getStoredAccessToken } from "./storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ChevronLeft, ChevronDown, ChevronUp, Loader2,
  ShieldCheck, ShieldAlert, ShieldX, CheckCircle2, XCircle,
  RefreshCw, AlertCircle, Hash, ScrollText, Calendar, Clock,
} from "lucide-react"

const API_BASE = "http://127.0.0.1:5000"

// ── Types ──────────────────────────────────────────────────────────────────

interface Certificate {
  certificate_id: number
  subject_name: string
  recent_compliance_id: number | null
  valid_to: string
}

// ── Status helpers ──────────────────────────────────────────────────────────

type ComplianceStatus = "compliant" | "warning" | "violation"

function getComplianceStatus(
  c: Compliance,
  policy: Policy | null | undefined,
  validTo: string,
): ComplianceStatus {
  const checks = getChecks(c, policy)
  const failedRequired = checks.filter(([, v, req]) => req && !v)
  if (failedRequired.length === 0) return "compliant"
  const now = new Date()
  const expiry = new Date(validTo)
  const onlyWarn =
    failedRequired.length === 1 &&
    failedRequired[0][0] === "Days until expiration" &&
    expiry > now
  return onlyWarn ? "warning" : "violation"
}

interface Compliance {
  compliance_id: number
  certificate_id: number
  policy_id: number
  created_at: string
  has_valid_protocol: boolean
  has_valid_key_exchange: boolean
  has_valid_key_exchange_group: boolean
  has_valid_cipher: boolean
  has_valid_mac: boolean
  has_valid_domain: boolean
  has_valid_issuer: boolean
  has_valid_days_until_expiration: boolean
  has_valid_days_since_issuance: boolean
  has_valid_signed_certificate_timestamp_list: boolean
  has_valid_certificate_transparency_compliance: boolean
  has_valid_encrypted_client_hello: boolean
}

interface Policy {
  policy_id: number
  name: string
  organisation_id: number
  require_signed_certificate_timestamp_list: boolean
  require_certificate_transparency_compliance: boolean
  require_encrypted_client_hello: boolean
}

// ── API helper ─────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────

// Returns [label, passing, required]
function getChecks(c: Compliance, policy?: Policy | null): [string, boolean, boolean][] {
  const sctReq = policy ? policy.require_signed_certificate_timestamp_list : true
  const ctReq  = policy ? policy.require_certificate_transparency_compliance : true
  const echReq = policy ? policy.require_encrypted_client_hello : true

  return [
    ["Protocol",                          c.has_valid_protocol,                                    true],
    ["Key exchange",                      c.has_valid_key_exchange,                                true],
    ["Key exchange group",                c.has_valid_key_exchange_group,                          true],
    ["Cipher",                            c.has_valid_cipher,                                      true],
    ["Message authentication code",       c.has_valid_mac,                                         true],
    ["Domain",                            c.has_valid_domain,                                      true],
    ["Issuer",                            c.has_valid_issuer,                                      true],
    ["Days until expiration",             c.has_valid_days_until_expiration,                       true],
    ["Days since issuance",               c.has_valid_days_since_issuance,                         true],
    ["Signed certificate timestamp list", c.has_valid_signed_certificate_timestamp_list,           sctReq],
    ["Certificate transparency",          c.has_valid_certificate_transparency_compliance,         ctReq],
    ["Encrypted client hello",            c.has_valid_encrypted_client_hello,                      echReq],
  ]
}

function passCount(c: Compliance, policy?: Policy | null) {
  // Count checks that are either passing, or optional (not required)
  return getChecks(c, policy).filter(([, v, req]) => v || !req).length
}

const TOTAL_CHECKS = 12

// ── Sub-components ─────────────────────────────────────────────────────────

function ComplianceRow({ label, value, required, isWarning }: { label: string; value: boolean; required: boolean; isWarning?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        {label}
        {!required && (
          <span className="text-[9px] text-muted-foreground/60 font-normal">(opt)</span>
        )}
      </span>
      {value ? (
        <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${required ? "text-green-500" : "text-green-400/70"}`} />
      ) : isWarning ? (
        <AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
      )}
    </div>
  )
}

function ComplianceSummary({ compliance, policy, validTo }: { compliance: Compliance; policy?: Policy | null; validTo: string }) {
  const passed = passCount(compliance, policy)
  const status  = getComplianceStatus(compliance, policy, validTo)
  const isExpired = new Date(validTo) <= new Date()

  const badgeCls =
    status === "compliant" ? "bg-green-600 text-[10px] h-4 px-1.5" :
    status === "warning"   ? "bg-yellow-500 text-[10px] h-4 px-1.5" :
                             "bg-red-600   text-[10px] h-4 px-1.5"

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(compliance.created_at).toLocaleString("en-AU", {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </span>
        <Badge className={badgeCls}>
          {passed}/{TOTAL_CHECKS} passed
        </Badge>
      </div>
      <div className="flex flex-col rounded-md border bg-muted/10 px-2.5 py-1.5">
        {getChecks(compliance, policy).map(([label, value, required]) => (
          <ComplianceRow
            key={label}
            label={label}
            value={value}
            required={required}
            isWarning={label === "Days until expiration" && !value && !isExpired}
          />
        ))}
      </div>
    </div>
  )
}

// ── Collapsible certificate compliance card ────────────────────────────────

function CertCompliance({
  cert,
  initialRecent,
}: {
  cert: Certificate
  initialRecent: Compliance | null
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)

  // Recent (shown in header + top of expanded)
  const [recent, setRecent] = useState<Compliance | null>(initialRecent)

  // Sync when parent pushes a new compliance (e.g. after check-all)
  useEffect(() => {
    if (
      initialRecent &&
      initialRecent.compliance_id !== recent?.compliance_id
    ) {
      setRecent(initialRecent)
      // Reset history so it reloads fresh on next expand
      setHistory([])
      setHistoryLoaded(false)
      setPolicy(null)
    }
  }, [initialRecent])

  // Full history (loaded on expand)
  const [history, setHistory] = useState<Compliance[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Policy for the most recent compliance
  const [policy, setPolicy] = useState<Policy | null>(null)

  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Per-cert check
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    if (historyLoaded) return
    setLoadingDetail(true)
    setDetailError(null)
    try {
      // Fetch full history + policy in parallel
      const [histRes, policyRes] = await Promise.all([
        apiRequest(`/api/compliance/list/${cert.certificate_id}`),
        recent
          ? apiRequest(`/api/compliance/policy/${recent.compliance_id}`)
          : Promise.resolve(null),
      ])

      if (histRes.ok) {
        const list: Compliance[] = await histRes.json()
        // Sort most-recent first
        list.sort((a, b) => b.compliance_id - a.compliance_id)
        setHistory(list)
        // If we had no initial recent, grab from list
        if (!recent && list.length > 0) setRecent(list[0])
      }

      if (policyRes && policyRes.ok) {
        setPolicy(await policyRes.json())
      }
    } catch {
      setDetailError("Failed to load compliance details.")
    } finally {
      setLoadingDetail(false)
      setHistoryLoaded(true)
    }
  }, [cert.certificate_id, historyLoaded, recent])

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next && !historyLoaded) loadDetail()
  }

  const handleCheck = async () => {
    setChecking(true)
    setCheckError(null)
    try {
      const res = await apiRequest(`/api/compliance/check/${cert.certificate_id}`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? "Compliance check failed")
      }
      const newCompliance: Compliance = await res.json()

      // Fetch the specific record via GET /api/compliance/<id> to confirm it saved
      const confirmRes = await apiRequest(`/api/compliance/${newCompliance.compliance_id}`)
      const confirmed: Compliance = confirmRes.ok ? await confirmRes.json() : newCompliance

      setRecent(confirmed)
      setHistory(prev => [confirmed, ...prev])

      // Refresh policy if policy_id changed
      if (!policy || policy.policy_id !== confirmed.policy_id) {
        const pRes = await apiRequest(`/api/compliance/policy/${confirmed.compliance_id}`)
        if (pRes.ok) setPolicy(await pRes.json())
      }
    } catch (e: any) {
      setCheckError(e.message ?? "Compliance check failed")
    } finally {
      setChecking(false)
    }
  }

  // Header status
  const passed = recent ? passCount(recent, policy) : null
  const status: ComplianceStatus | null = recent
    ? getComplianceStatus(recent, policy, cert.valid_to)
    : null

  const headerBadgeCls =
    status === "compliant" ? "bg-green-600 text-[10px] h-4 px-1.5" :
    status === "warning"   ? "bg-yellow-500 text-[10px] h-4 px-1.5" :
                             "bg-red-600   text-[10px] h-4 px-1.5"

  return (
    <div className="rounded-md border overflow-hidden">
      {/* ── Collapsed header ── */}
      <button
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2.5 text-left hover:bg-muted/30 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          {status === null ? (
            <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : status === "compliant" ? (
            <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
          ) : status === "warning" ? (
            <ShieldAlert className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
          ) : (
            <ShieldX className="h-3.5 w-3.5 text-red-500 shrink-0" />
          )}
          <span className="text-xs font-semibold truncate">{cert.subject_name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {recent === null ? (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">No check</Badge>
          ) : (
            <Badge className={headerBadgeCls}>
              {passed}/{TOTAL_CHECKS}
            </Badge>
          )}
          {open
            ? <ChevronUp   className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {/* ── Expanded body ── */}
      {open && (
        <div className="border-t px-2.5 py-3 flex flex-col gap-4">
          {loadingDetail ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : detailError ? (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">{detailError}</AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Policy badge */}
              {policy && (
                <div className="flex items-center gap-1.5">
                  <ScrollText className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Policy:</span>
                  <Badge variant="outline" className="text-xs font-normal px-1.5 py-0">{policy.name}</Badge>
                </div>
              )}

              {/* Re-check button + error */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Latest check</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1"
                    disabled={checking}
                    onClick={handleCheck}
                  >
                    {checking
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <RefreshCw className="h-3 w-3" />}
                    Re-check
                  </Button>
                </div>

                {checkError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <AlertDescription className="text-xs">{checkError}</AlertDescription>
                  </Alert>
                )}

                {recent ? (
                  <ComplianceSummary compliance={recent} policy={policy} validTo={cert.valid_to} />
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No compliance check run yet. Press Re-check to evaluate against the active policy.
                  </p>
                )}
              </div>

              {/* History */}
              {history.length > 1 && (
                <>
                  <Separator />
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowHistory(h => !h)}
                  >
                    <Hash className="h-3 w-3" />
                    {showHistory ? "Hide" : "Show"} history ({history.length - 1} older)
                    {showHistory
                      ? <ChevronUp   className="h-3 w-3" />
                      : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {showHistory && (
                    <div className="flex flex-col gap-3">
                      {history.slice(1).map(c => (
                        <div key={c.compliance_id} className="opacity-60">
                          <ComplianceSummary compliance={c} policy={policy} validTo={cert.valid_to} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CompliancePage({
  onBack,
  onSignOut,
}: {
  onBack: () => void
  onSignOut: () => void
}) {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [recentMap, setRecentMap] = useState<Record<number, Compliance | null>>({})
  const [loading, setLoading] = useState(true)

  // Check-all
  const [checkingAll, setCheckingAll] = useState(false)
  const [checkAllError, setCheckAllError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const token = await getStoredAccessToken()
    if (!token) { onSignOut(); return }

    const headers = { Authorization: `Bearer ${token}` }
    const certsRes = await fetch(`${API_BASE}/api/certificate/list`, { headers })
    if (!certsRes.ok) { setLoading(false); return }

    const certs: Certificate[] = await certsRes.json()
    setCertificates(certs)

    // Fetch most-recent compliance for every cert in parallel
    // using GET /api/compliance/recent/<id>
    const recentResults = await Promise.all(
      certs.map(async cert => {
        try {
          const res = await fetch(`${API_BASE}/api/compliance/recent/${cert.certificate_id}`, { headers })
          if (res.ok) return [cert.certificate_id, await res.json() as Compliance] as const
        } catch { /* ignore */ }
        return [cert.certificate_id, null] as const
      })
    )
    setRecentMap(Object.fromEntries(recentResults))
    setLoading(false)
  }, [onSignOut])

  useEffect(() => { loadData() }, [loadData])

  const handleCheckAll = async () => {
    setCheckingAll(true)
    setCheckAllError(null)
    try {
      const res = await apiRequest("/api/compliance/check/all", { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? "Check all failed")
      }
      const newRecords: Compliance[] = await res.json()
      // Merge the new records into the recent map
      const updated: Record<number, Compliance> = {}
      for (const c of newRecords) updated[c.certificate_id] = c
      setRecentMap(prev => ({ ...prev, ...updated }))
    } catch (e: any) {
      setCheckAllError(e.message ?? "Check all failed")
    } finally {
      setCheckingAll(false)
    }
  }

  const totalCerts = certificates.length
  const checkedCerts = Object.values(recentMap).filter(Boolean).length

  const compliantCount = certificates.filter(cert => {
    const c = recentMap[cert.certificate_id]
    return c ? getComplianceStatus(c, undefined, cert.valid_to) === "compliant" : false
  }).length

  const warningCount = certificates.filter(cert => {
    const c = recentMap[cert.certificate_id]
    return c ? getComplianceStatus(c, undefined, cert.valid_to) === "warning" : false
  }).length

  const violationCount = certificates.filter(cert => {
    const c = recentMap[cert.certificate_id]
    return c ? getComplianceStatus(c, undefined, cert.valid_to) === "violation" : false
  }).length

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

        {/* ── Header ── */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">Compliance</span>
        </div>

        {/* ── Summary card ── */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                {/* tri-state stat row */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs font-semibold text-green-600">{compliantCount}</span>
                    <span className="text-xs text-muted-foreground">compliant</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5 text-yellow-500" />
                    <span className="text-xs font-semibold text-yellow-600">{warningCount}</span>
                    <span className="text-xs text-muted-foreground">warning{warningCount !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShieldX className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-xs font-semibold text-red-600">{violationCount}</span>
                    <span className="text-xs text-muted-foreground">violation{violationCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                {/* evaluated count (only shown if not all evaluated) */}
                {checkedCerts < totalCerts && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {checkedCerts} of {totalCerts} evaluated
                    </span>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs w-full"
                disabled={checkingAll || totalCerts === 0}
                onClick={handleCheckAll}
              >
                {checkingAll
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                Check all
              </Button>
            </div>

            {checkAllError && (
              <Alert variant="destructive" className="mt-3 py-2">
                <AlertCircle className="h-3.5 w-3.5" />
                <AlertDescription className="text-xs">{checkAllError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* ── Certificate list ── */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Certificates</span>
              <Badge variant="outline" className="ml-auto text-xs">{totalCerts}</Badge>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-2 pt-1 pb-4">
            {certificates.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-1 py-4 text-center">
                No certificates synced yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {certificates.map(cert => (
                  <CertCompliance
                    key={cert.certificate_id}
                    cert={cert}
                    initialRecent={recentMap[cert.certificate_id] ?? null}
                    onSignOut={onSignOut}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
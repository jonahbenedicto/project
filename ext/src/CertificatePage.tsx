import { useState, useEffect, useCallback } from "react"
import { getStoredAccessToken } from "./storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChevronLeft, ChevronDown, ChevronUp, Loader2, Calendar,
  Building, Network, FileCode,
  Key, Lock, Globe, Clock,
  AlertCircle,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const API_BASE = "http://127.0.0.1:5000"

// ── Types ──────────────────────────────────────────────────────────────────

interface Certificate {
  certificate_id: number
  user_id: number
  recent_compliance_id: number | null
  created_at: string
  protocol: string
  key_exchange: string
  key_exchange_group: string
  cipher: string
  mac: string
  subject_name: string
  san_list: string[]
  issuer: string
  valid_from: string
  valid_to: string
  signed_certificate_timestamp_list: boolean
  certificate_transparency_compliance: boolean
  encrypted_client_hello: boolean
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

// ── Display helpers ────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  const isEmpty = value === null || value === undefined || value === ""
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      {isEmpty ? (
        <Badge variant="outline" className="text-xs font-normal px-1.5 py-0 text-muted-foreground">None</Badge>
      ) : (
        <span className="truncate text-right text-xs font-medium">{value}</span>
      )}
    </div>
  )
}

function TagList({ icon: Icon, label, values }: { icon: React.ElementType; label: string; values: string[] }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex flex-wrap justify-end gap-1">
        {values.length > 0 ? values.map(v => (
          <Badge key={v} variant="outline" className="text-xs font-normal px-1.5 py-0 text-muted-foreground">{v}</Badge>
        )) : (
          <span className="text-xs text-muted-foreground italic">None</span>
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
      <Badge
        variant="outline"
        className="text-xs font-normal px-1.5 py-0 text-muted-foreground"
      >
        {value ? "Present" : "None"}
      </Badge>
    </div>
  )
}

// ── Certificate detail ─────────────────────────────────────────────────────

function CertificateDetail({ cert }: { cert: Certificate }) {
  return (
    <div className="flex flex-col gap-3">
      <InfoRow icon={Network}   label="Protocol"                      value={cert.protocol} />
      <InfoRow icon={Key}       label="Key exchange"                  value={cert.key_exchange} />
      <InfoRow icon={Key}       label="Key exchange group"            value={cert.key_exchange_group} />
      <InfoRow icon={Lock}      label="Cipher"                        value={cert.cipher} />
      <InfoRow icon={Lock}      label="Message authentication code"   value={cert.mac} />
      <InfoRow icon={Building}  label="Issuer"                        value={cert.issuer} />
      <TagList  icon={Globe}    label="SANs"                          values={cert.san_list} />
      <InfoRow
        icon={Calendar}
        label="Valid from"
        value={new Date(cert.valid_from).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
      />
      <InfoRow
        icon={Calendar}
        label="Valid to"
        value={new Date(cert.valid_to).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
      />
      <InfoRow
        icon={Clock}
        label="Synced"
        value={new Date(cert.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
      />
      <BoolRow icon={Lock} label="Signed certificate timestamp list" value={cert.signed_certificate_timestamp_list} />
      <BoolRow icon={Lock} label="Certificate transparency"          value={cert.certificate_transparency_compliance} />
      <BoolRow icon={Lock} label="Encrypted client hello"            value={cert.encrypted_client_hello} />
    </div>
  )
}

// ── Collapsible certificate card ───────────────────────────────────────────

function CollapsibleCertificate({
  cert,
}: {
  cert: Certificate
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const [fullCert, setFullCert] = useState<Certificate | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    if (fullCert) return
    setLoadingDetail(true)
    setDetailError(null)
    try {
      const res = await apiRequest(`/api/certificate/${cert.certificate_id}`)
      if (!res.ok) throw new Error("Failed to load certificate")
      setFullCert(await res.json())
    } catch {
      setDetailError("Failed to load certificate details.")
    } finally {
      setLoadingDetail(false)
    }
  }, [cert.certificate_id, fullCert])

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next && !fullCert) loadDetail()
  }

  return (
    <div className="rounded-md border overflow-hidden">
      {/* Header row — always visible */}
      <button
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-muted/30 transition-colors"
        onClick={handleToggle}
      >
        <span className="text-xs font-semibold truncate">{cert.subject_name}</span>
        {open
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t px-2.5 py-2.5 flex flex-col gap-4">
          {loadingDetail ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : detailError ? (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">{detailError}</AlertDescription>
            </Alert>
          ) : fullCert ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">Details</p>
              <CertificateDetail cert={fullCert} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CertificatePage({
  onBack,
  onSignOut,
}: {
  onBack: () => void
  onSignOut: () => void
}) {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const token = await getStoredAccessToken()
    if (!token) { onSignOut(); return }

    const res = await fetch(`${API_BASE}/api/certificate/list`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.ok) {
      setCertificates(await res.json())
    }
    setLoading(false)
  }, [onSignOut])

  useEffect(() => { loadData() }, [loadData])

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
          <span className="text-sm font-semibold">Certificates</span>
        </div>

        <Card>
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Certificates</span>
              <Badge variant="outline" className="ml-auto text-xs">
                {certificates.length}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-1">
            {certificates.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-1 py-4 text-center">
                No certificates synced yet. Browse HTTPS sites with the debugger attached to see them here.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {certificates.map(cert => (
                  <CollapsibleCertificate
                    key={cert.certificate_id}
                    cert={cert}
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
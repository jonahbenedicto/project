import { useState } from "react"
import { setStoredAccessToken } from "./storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, User } from "lucide-react"

const API_BASE = "http://127.0.0.1:5000"

export default function AuthPage({ onSignIn }: { onSignIn: () => void }) {
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")

  async function handleSignIn() {
    setError("")
    setSubmitting(true)
    const res = await fetch(`${API_BASE}/api/authentication/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.message || "Sign in failed")
      setSubmitting(false)
      return
    }
    await setStoredAccessToken(data.access_token)
    setSubmitting(false)
    onSignIn()
  }

  async function handleSignUp() {
    setError("")
    setSubmitting(true)
    const res = await fetch(`${API_BASE}/api/authentication/sign-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, email, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.message || "Sign up failed")
      setSubmitting(false)
      return
    }
    await setStoredAccessToken(data.access_token)
    setSubmitting(false)
    onSignIn()
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-xs">
        <CardHeader className="items-center gap-1 pb-4">
          <div className="flex items-center flex-col gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-semibold tracking-wide">ext</p>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sign-in" onValueChange={() => setError("")}>
            <TabsList className="w-full">
              <TabsTrigger value="sign-in" className="flex-1">Sign in</TabsTrigger>
              <TabsTrigger value="sign-up" className="flex-1">Sign up</TabsTrigger>
            </TabsList>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <TabsContent value="sign-in" className="mt-4 flex flex-col gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Username</Label>
                <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Password</Label>
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSignIn()} />
              </div>
              <Button className="w-full" disabled={submitting} onClick={handleSignIn}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
              </Button>
            </TabsContent>

            <TabsContent value="sign-up" className="mt-4 flex flex-col gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Name</Label>
                <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Username</Label>
                <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Password</Label>
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSignUp()} />
              </div>
              <Button className="w-full" disabled={submitting} onClick={handleSignUp}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign up
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
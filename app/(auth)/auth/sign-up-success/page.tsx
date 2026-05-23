import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center justify-center">
        <Card className="w-full max-w-lg overflow-hidden border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur-md">
          <div className="h-2 bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-300" />
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 shadow-lg ring-1 ring-white/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-100" />
            </div>
            <CardTitle className="text-3xl">Cadastro concluído!</CardTitle>
            <CardDescription className="text-base text-white/75">
              Sua conta foi criada e liberada para acessar o PDI - Test Control.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="h-12 w-full bg-gradient-to-r from-blue-500 to-purple-600 text-base font-semibold hover:from-blue-600 hover:to-purple-700">
              <Link href="/auth/login">Ir para o login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

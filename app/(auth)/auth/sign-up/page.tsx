import Link from "next/link"
import { LockKeyhole, MailCheck, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center justify-center">
        <Card className="w-full max-w-xl overflow-hidden border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur-md">
          <div className="h-2 bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-300" />
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-white/20">
              <ShieldCheck className="h-8 w-8 text-blue-100" />
            </div>
            <CardTitle className="text-3xl">Cadastro restrito</CardTitle>
            <CardDescription className="text-base text-white/75">
              O acesso ao PDI - Test Control é liberado somente por convite enviado por um administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20">
                  <MailCheck className="h-5 w-5 text-blue-100" />
                </div>
                <div>
                  <h2 className="font-semibold">Como criar sua conta?</h2>
                  <p className="mt-1 text-sm leading-6 text-white/75">
                    Solicite ao administrador o envio de um link de cadastro. O link é individual, possui validade e só
                    pode ser usado uma vez para o e-mail autorizado.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-5">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20">
                  <LockKeyhole className="h-5 w-5 text-purple-100" />
                </div>
                <div>
                  <h2 className="font-semibold">Por que o cadastro direto foi bloqueado?</h2>
                  <p className="mt-1 text-sm leading-6 text-white/75">
                    Para evitar cadastros não autorizados e manter os dados dos experimentos protegidos dentro do sistema.
                  </p>
                </div>
              </div>
            </div>

            <Button asChild className="h-12 w-full bg-gradient-to-r from-blue-500 to-purple-600 text-base font-semibold hover:from-blue-600 hover:to-purple-700">
              <Link href="/auth/login">Voltar para o login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

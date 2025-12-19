export default function BlockedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 text-center">
        <h1 className="text-2xl font-semibold">Acesso bloqueado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu usuário está inativo. Fale com o administrador para liberar o acesso.
        </p>
      </div>
    </main>
  )
}

import { redirect } from "next/navigation"

type PageProps = {
  searchParams?: {
    token?: string | string[]
  }
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

export default function CadastroConviteRedirectPage({ searchParams }: PageProps) {
  const token = getSingleParam(searchParams?.token).trim()
  redirect(token ? `/auth/convite/${encodeURIComponent(token)}` : "/auth/login")
}

import { redirect } from "next/navigation"

type PageProps = {
  searchParams?: {
    token?: string | string[]
  }
}

export default function CadastroConviteRedirectPage({ searchParams }: PageProps) {
  const rawToken = Array.isArray(searchParams?.token) ? searchParams?.token[0] : searchParams?.token
  const token = typeof rawToken === "string" ? rawToken.trim() : ""

  redirect(token ? `/auth/invite?token=${encodeURIComponent(token)}` : "/auth/invite")
}


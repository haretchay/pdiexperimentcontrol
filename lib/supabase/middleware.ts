import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Com Fluid compute, não coloque este cliente em uma variável de ambiente global.
  // Sempre crie um novo em cada requisição.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  // Não execute código entre createServerClient e supabase.auth.getUser().
  // Um erro simples pode tornar muito difícil debugar problemas com usuários
  // sendo deslogados aleatoriamente.

  // IMPORTANTE: Se você remover getUser() e usar renderização server-side
  // com o cliente Supabase, seus usuários podem ser deslogados aleatoriamente.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthRoute = path.startsWith("/auth")
  const isProtected =
    path === "/" ||
    path.startsWith("/dashboard") ||
    path.startsWith("/experiments") ||
    path.startsWith("/tests") ||
    path.startsWith("/repetitions") ||
    path.startsWith("/media") ||
    path.startsWith("/registers")

  // Redireciona para login se tentar acessar rotas protegidas sem autenticação
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // Redireciona para dashboard se já estiver autenticado e tentar acessar rotas de auth
  if (user && isAuthRoute && path !== "/auth/blocked") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Verifica status do perfil do usuário
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, role")
      .eq("user_id", user.id)
      .maybeSingle()

    // Redireciona para página de bloqueio se o usuário não estiver ativo
    if (!profile || profile.status !== "active") {
      if (path !== "/auth/blocked") {
        const url = request.nextUrl.clone()
        url.pathname = "/auth/blocked"
        return NextResponse.redirect(url)
      }
    }

    // Proteção de rotas admin
    const isAdminRoute = path.startsWith("/admin")
    if (isAdminRoute && profile?.role !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }
  }

  // IMPORTANTE: Você *deve* retornar o objeto supabaseResponse como está.
  // Se você está criando um novo objeto de resposta com NextResponse.next(), certifique-se de:
  // 1. Passar a request nele, assim:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copiar os cookies, assim:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Modificar o objeto myNewResponse para suas necessidades, mas evite modificar
  //    os cookies!
  // 4. Finalmente:
  //    return myNewResponse
  // Se isso não for feito, você pode estar fazendo o navegador e o servidor
  // ficarem fora de sincronia e terminar a sessão do usuário prematuramente!

  return supabaseResponse
}

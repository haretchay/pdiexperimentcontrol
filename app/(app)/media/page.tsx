// SUBSTITUIR ARQUIVO COMPLET0: app/(app)/media/page.tsx

import { MediaPageClient } from "@/components/media/media-page-client"

export default async function MediaPage() {
  // A página de Mídias agora lista tudo de uma vez (sem selecionar experimento).
  // O carregamento e filtros ficam no client para manter a experiência fluida.
  return <MediaPageClient />
}

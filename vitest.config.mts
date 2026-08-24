import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

// Test unitari, deliberatamente senza ambiente browser e senza setup globale:
// qui dentro gira solo logica di dominio, con i moduli di I/O sostituiti da
// vi.mock nel singolo file di test. Nessun test tocca Supabase o SMTP.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
})

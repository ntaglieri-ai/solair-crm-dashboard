/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      // --- Discovery OAuth del server MCP ---------------------------------
      // I documenti di metadata devono stare sotto /.well-known della radice
      // (RFC 8414 e RFC 9728), ma le rotte vivono in app/api/oauth-mcp: sono
      // codice applicativo, non file statici. Le riscritture tengono insieme
      // le due cose.
      //
      // La variante con :path* serve perche' i client MCP cercano la metadata
      // anche in fondo al percorso della risorsa
      // (/.well-known/oauth-protected-resource/api/mcp): quale delle due venga
      // provata per prima dipende dal client e dalla piattaforma, quindi
      // rispondono entrambe.
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth-mcp/authorization-server",
      },
      {
        source: "/.well-known/oauth-authorization-server/:path*",
        destination: "/api/oauth-mcp/authorization-server",
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/oauth-mcp/protected-resource",
      },
      {
        source: "/.well-known/oauth-protected-resource/:path*",
        destination: "/api/oauth-mcp/protected-resource",
      },
      // --- Rete di sicurezza per i client che tirano a indovinare ----------
      // E' il difetto noto di claude.ai (anthropics/claude-ai-mcp#644): in
      // certi casi ignora l'header di autenticazione e prova OAuth contro la
      // radice del dominio, chiedendo /authorize e prendendo 404. Ora quel
      // percorso esiste e porta dove deve.
      { source: "/authorize", destination: "/oauth/mcp/authorize" },
      { source: "/token", destination: "/api/oauth-mcp/token" },
      { source: "/register", destination: "/api/oauth-mcp/register" },
    ]
  },
}

export default nextConfig

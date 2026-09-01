import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryProvider } from '@/components/providers/query-provider'
import { AppearanceProvider } from '@/components/providers/appearance-provider'
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration'
import './globals.css'

export const metadata: Metadata = {
  title: 'Solair CRM',
  applicationName: 'SolairCRM',
  description: 'CRM enterprise per Solair Group — gestione lead, clienti e pipeline fotovoltaico',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'SolairCRM',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/pwa/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f7f8fa',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="it" className="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=JSON.parse(localStorage.getItem("solair:appearance")||"null")||{};var t=p.theme||"light";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.classList.toggle("light",!d);r.dataset.accent=p.accent||"navy";r.dataset.density=p.density||"comfortable";r.dataset.radius=p.radius||"soft"}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background">
        <QueryProvider>
          <AppearanceProvider>
            <TooltipProvider delay={150}>{children}</TooltipProvider>
          </AppearanceProvider>
        </QueryProvider>
        <Toaster position="bottom-right" richColors closeButton />
        <ServiceWorkerRegistration />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

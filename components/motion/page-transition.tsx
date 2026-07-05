"use client"

import { motion, useReducedMotion } from "framer-motion"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()

  return (
    <>
      {!reduceMotion ? (
        <motion.div
          key={pathname}
          className="fixed left-[248px] right-0 top-0 z-50 h-[3px] origin-left bg-[#4f7cff]"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: [0, 0.72, 1], opacity: [1, 1, 0] }}
          transition={{ duration: 0.42, times: [0, 0.65, 1], ease: "easeOut" }}
        />
      ) : null}
      {children}
    </>
  )
}

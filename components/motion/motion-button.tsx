"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { ComponentProps } from "react"

export function MotionButton({
  children,
  ...props
}: ComponentProps<typeof motion.div>) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.015 }}
      whileTap={reduceMotion ? undefined : { scale: 0.975 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

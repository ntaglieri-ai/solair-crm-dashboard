"use client"

import {
  forwardRef,
  type AnchorHTMLAttributes,
} from "react"

type NextcloudOpenLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
}

export const NextcloudOpenLink = forwardRef<
  HTMLAnchorElement,
  NextcloudOpenLinkProps
>(function NextcloudOpenLink({ href, ...props }, ref) {
  return (
    <a
      ref={ref}
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    />
  )
})

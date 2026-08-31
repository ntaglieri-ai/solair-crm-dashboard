"use client"

import {
  forwardRef,
  type AnchorHTMLAttributes,
  type MouseEvent,
} from "react"

const RESET_SESSION_URL = "/api/auth/nextcloud/reset-session"
const RESET_DELAY_MS = 1400

type NextcloudOpenLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
}

function hrefWithCleanSession(href: string): string {
  const url = new URL(href, window.location.href)
  url.searchParams.set("nc_clean", "1")
  return `${url.pathname}${url.search}${url.hash}`
}

export const NextcloudOpenLink = forwardRef<
  HTMLAnchorElement,
  NextcloudOpenLinkProps
>(function NextcloudOpenLink({ onClick, href, ...props }, ref) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()

    const nextHref = hrefWithCleanSession(href)
    const resetWindow = window.open(
      RESET_SESSION_URL,
      "solair-nextcloud-session-reset",
      "popup,width=460,height=620",
    )

    window.setTimeout(() => {
      try {
        resetWindow?.close()
      } catch {
        // Some browsers refuse to close a cross-origin popup after redirect.
      }
      window.location.assign(nextHref)
    }, RESET_DELAY_MS)
  }

  return (
    <a
      ref={ref}
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
    />
  )
})

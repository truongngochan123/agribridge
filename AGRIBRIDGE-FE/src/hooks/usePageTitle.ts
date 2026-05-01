import { useEffect } from 'react'

const APP_NAME = 'AgriBridge'

/**
 * Set document.title for the current page.
 * Format: "<pageTitle> | AgriBridge"
 * If no pageTitle provided, falls back to just "AgriBridge".
 */
export function usePageTitle(pageTitle?: string) {
  useEffect(() => {
    const previous = document.title
    document.title = pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME
    return () => {
      document.title = previous
    }
  }, [pageTitle])
}

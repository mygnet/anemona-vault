import { writable, derived } from 'svelte/store'
import en from './en.json'
import es from './es.json'

export type Locale = 'en' | 'es'

const locales: Record<string, Record<string, any>> = { en, es }

function resolve(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) return acc[part]
    return undefined
  }, obj)
}

export function initLocale(vscodeLanguage: string, storedLocale?: string): string {
  if (storedLocale && storedLocale !== 'auto' && locales[storedLocale]) {
    return storedLocale
  }
  if (storedLocale === 'auto' || !storedLocale) {
    if (vscodeLanguage === 'es') return 'es'
    return 'en'
  }
  return 'en'
}

export const currentLocale = writable<string>('en')

export const localeLabel = derived(currentLocale, ($l) => $l === 'es' ? 'Español' : 'English')

export const t = derived(currentLocale, ($currentLocale) => {
  return (key: string, vars?: Record<string, string>): string => {
    const langData = locales[$currentLocale]
    let text = resolve(langData, key)

    if (text === undefined) {
      text = resolve(locales['en'], key)
    }

    if (text === undefined) {
      return key
    }

    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
      }
    }

    return text
  }
})

import { useState, useEffect } from 'react'

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (val: T) => void] {
    const [value, setValue] = useState<T>(() => {
        if (typeof window === 'undefined') return defaultValue
        try {
            const stored = localStorage.getItem(key)
            return stored !== null ? JSON.parse(stored) : defaultValue
        } catch {
            return defaultValue
        }
    })

    const set = (val: T) => {
        setValue(val)
        try {
            localStorage.setItem(key, JSON.stringify(val))
        } catch { }
    }

    return [value, set]
}
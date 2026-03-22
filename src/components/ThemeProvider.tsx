'use client'

import { useEffect, useState } from 'react'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<'light' | 'dark'>('light')

    useEffect(() => {
        const current = document.documentElement.getAttribute('data-theme')
        if (current === 'dark') setTheme('dark')
    }, [])

    function toggle() {
        const next = theme === 'light' ? 'dark' : 'light'
        setTheme(next)
        document.documentElement.setAttribute('data-theme', next)
        localStorage.setItem('theme', next)
    }

    return (
        <>
            {children}
            <button
                onClick={toggle}
                aria-label="Toggle theme"
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    zIndex: 9999,
                }}
            >
                {theme === 'light' ? '◐ Dark' : '◑ Light'}
            </button>
        </>
    )
}

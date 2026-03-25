import Sidebar from './Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
            <Sidebar />
            <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' as const }}>
                {children}
            </main>
        </div>
    )
}

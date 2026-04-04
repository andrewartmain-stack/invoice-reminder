import Sidebar from './Sidebar'
import NotificationListener from './NotificationListener'

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className='bg-black/95' style={{ display: 'flex', minHeight: '100vh' }}>
            <NotificationListener />
            <Sidebar />
            <main className='my-2 px-2 rounded-l-2xl bg-background overflow-hidden' style={{ flex: 1 }}>
                {children}
            </main>
        </div>
    )
}

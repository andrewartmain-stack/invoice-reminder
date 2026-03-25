'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, Mail, Settings, LogOut, Zap, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Module-level cache — survives component remount on navigation
const _cache = {
    userEmail: null as string | null,
    plan: 'trial' as 'trial' | 'paid',
    invoiceCount: null as number | null,
    clientCount: null as number | null,
}

export default function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const [userEmail, setUserEmail] = useState(_cache.userEmail)
    const [plan, setPlan] = useState(_cache.plan)
    const [invoiceCount, setInvoiceCount] = useState(_cache.invoiceCount)
    const [clientCount, setClientCount] = useState(_cache.clientCount)

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const [
                { data: profile },
                { count: invCount },
                { count: clCount },
            ] = await Promise.all([
                supabase.from('profiles').select('plan').eq('id', user.id).single(),
                supabase.from('invoices').select('id', { count: 'exact', head: true }),
                supabase.from('clients').select('id', { count: 'exact', head: true }),
            ])

            const email = user.email || null
            const p = profile?.plan === 'paid' ? 'paid' : 'trial'
            const inv = invCount ?? 0
            const cl = clCount ?? 0

            _cache.userEmail = email
            _cache.plan = p
            _cache.invoiceCount = inv
            _cache.clientCount = cl

            setUserEmail(email)
            setPlan(p)
            setInvoiceCount(inv)
            setClientCount(cl)
        }
        load()
    }, [])

    async function signOut() {
        _cache.userEmail = _cache.invoiceCount = _cache.clientCount = null
        await supabase.auth.signOut()
        router.push('/login')
    }

    function isActive(href: string) {
        return pathname === href || pathname.startsWith(href + '/')
    }

    const initials = userEmail ? userEmail.charAt(0).toUpperCase() : '?'

    const NAV = [
        { href: '/invoices', label: 'Invoices', icon: FileText, count: invoiceCount },
        { href: '/clients', label: 'Clients', icon: Users, count: clientCount },
        { href: '/email-templates', label: 'Email Templates', icon: Mail, count: null },
        { href: '/settings', label: 'Settings', icon: Settings, count: null },
    ]

    return (
        <aside className="w-60 h-screen bg-white border-r border-black/[0.07] flex flex-col shrink-0 sticky top-0 font-[Inter,sans-serif]">

            {/* Logo */}
            <div className="flex items-center gap-3 px-5 pt-6 pb-5">
                <span style={{ fontFamily: "'League Spartan', sans-serif", fontWeight: 800 }} className="text-[24px] text-black tracking-tight leading-none">cashping.</span>
            </div>

            {/* User card */}
            {userEmail && (
                <div className="mx-3 mb-4 flex items-center gap-3 px-3 py-3 rounded-xl bg-black/[0.04]">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <span className="text-[13px] font-semibold text-black/75 truncate leading-tight">{userEmail}</span>
                        <span className={cn(
                            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded self-start leading-none",
                            plan === 'paid'
                                ? "bg-black text-white"
                                : "bg-black/8 text-black/40"
                        )}>
                            {plan === 'paid' ? 'Pro' : 'Trial'}
                        </span>
                    </div>
                </div>
            )}

            {/* Section label */}
            <div className="px-5 pb-2">
                <span className="text-[10px] font-semibold text-black/25 uppercase tracking-widest">Navigation</span>
            </div>

            {/* Nav */}
            <nav className="flex flex-col gap-1 px-3 flex-1">
                {NAV.map(item => {
                    const active = isActive(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-3 rounded-lg text-[14px] font-medium transition-all no-underline",
                                active
                                    ? "bg-black text-white"
                                    : "text-black/50 hover:bg-black/4 hover:text-black/80"
                            )}
                        >
                            <item.icon
                                size={15}
                                strokeWidth={active ? 2.3 : 1.8}
                                className={cn("shrink-0", active ? "text-white" : "text-black/40")}
                            />
                            <span className="flex-1 leading-none">{item.label}</span>
                            {item.count !== null && item.count !== undefined && (
                                <span className={cn(
                                    "text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md min-w-5 text-center leading-tight",
                                    active
                                        ? "bg-white/20 text-white"
                                        : "bg-green-100 text-green-700"
                                )}>
                                    {item.count}
                                </span>
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* Sign out */}
            <div className="p-3 border-t border-black/[0.07]">
                <Button
                    variant="ghost"
                    onClick={signOut}
                    className="w-full justify-start gap-3 px-3 h-auto py-2.5 text-[13px] text-black/45 hover:text-black/70"
                >
                    <LogOut size={15} strokeWidth={1.8} className="shrink-0 text-black/35" />
                    <span>Sign out</span>
                </Button>
            </div>
        </aside>
    )
}

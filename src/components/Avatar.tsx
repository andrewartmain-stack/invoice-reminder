import { getInitials } from '@/lib/format'

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  size?: number
}

export function Avatar({ name, avatarUrl, size = 34 }: AvatarProps) {
  const initials = getInitials(name)
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }}
      className="bg-black/7 flex items-center justify-center"
    >
      <span
        style={{ fontSize: size * 0.35, lineHeight: 1 }}
        className="font-bold text-black/45 select-none"
      >
        {initials}
      </span>
    </div>
  )
}

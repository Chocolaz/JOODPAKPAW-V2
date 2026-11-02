export function UserAvatar({
  user,
  size = 'sm',
}: {
  user: { avatar: string; firstName: string; lastName: string }
  size?: 'xs' | 'sm' | 'md'
}) {
  const sizeClasses: Record<string, string> = {
    xs: 'w-7 h-7 text-sm rounded-full',
    sm: 'w-8 h-8 text-sm rounded-full',
    md: 'w-10 h-10 text-base rounded-full',
  }
  const cls = sizeClasses[size]

  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.firstName}
        className={`${cls} object-cover ring-1 ring-black/5 shrink-0`}
      />
    )
  }
  return (
    <div
      className={`${cls} bg-gray-100 text-gray-600 font-semibold font-baloo2 flex items-center justify-center shrink-0 text-[13px]`}
    >
      {user.firstName.charAt(0)}
    </div>
  )
}

type AuthHeaderProps = {
  children: React.ReactNode
}

export default function AuthHeader({ children }: AuthHeaderProps) {
  return (
    <div className="relative w-full flex justify-center pt-10 pb-6 overflow-hidden lg:hidden">
      <div
        aria-hidden="true"
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[140%] max-w-[640px] h-72 rounded-b-[50%] bg-off-white border-b border-border/60 pointer-events-none z-0"
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

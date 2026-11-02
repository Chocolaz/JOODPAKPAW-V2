import Image from 'next/image'
import { assetPath } from '@/lib/utils'

type AuthHeaderProps = {
  children: React.ReactNode
}

export default function AuthHeader({ children }: AuthHeaderProps) {
  return (
    <div className="relative w-screen flex justify-center pt-10 overflow-hidden lg:hidden">
      <div className="absolute top-0 left-0 right-0 z-0 pointer-events-none max-w-[500px] mx-auto">
        <Image
          src={assetPath("/graphics/Ellipse.svg")}
          alt="Background Ellipse"
          width={500}
          height={308}
          style={{ width: '100%', height: 'auto' }}
          priority
        />
      </div>
      <div className="z-10">{children}</div>
    </div>
  )
}

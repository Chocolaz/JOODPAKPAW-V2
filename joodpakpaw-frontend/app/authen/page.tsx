import Image from 'next/image'
import Link from 'next/link'
import { assetPath } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import AuthHeader from './_components/AuthHeader'

interface AuthenPageProps {
  searchParams: Promise<{ returnUrl?: string }>
}

export default async function AuthenPage({ searchParams }: AuthenPageProps) {
  const { returnUrl } = await searchParams
  const loginHref = returnUrl
    ? `/authen/login?returnUrl=${encodeURIComponent(returnUrl)}`
    : '/authen/login'
  const registerHref = returnUrl
    ? `/authen/register?returnUrl=${encodeURIComponent(returnUrl)}`
    : '/authen/register'

  return (
    <div className="bg-white text-foreground w-full flex flex-col items-center lg:min-h-0">
      {/* Mobile header with graphic */}
      <AuthHeader>
        <Image
          src={assetPath("/graphics/welcome.svg")}
          alt="Welcome"
          width={500}
          height={372}
          priority
        />
      </AuthHeader>

      <div className="px-5 w-full max-w-sm lg:max-w-md text-center mx-auto mt-8 lg:mt-0">
        {/* Desktop title (left panel shows graphic, right panel shows this) */}
        <div className="hidden lg:block mb-8">
          <h1 className="text-3xl xl:text-4xl font-bold text-accent-orange mb-3">
            Welcome to JOODPAKPAW
          </h1>
          <p className="text-neutral-gray">Find trusted stays, loving hosts, and happy tails.</p>
        </div>

        {/* Mobile title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-accent-orange lg:hidden mb-2">Welcome to JOODPAKPAW</h1>
        <div className="text-sm sm:text-base text-neutral-gray mb-8 lg:hidden">
          <p>Find trusted stays, loving hosts, and happy tails.</p>
          <p>Your pet&apos;s comfort starts here.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:h-[56px]">
          <Link href={loginHref} passHref className="flex-1">
            <Button className="w-full py-3.5 sm:py-4 rounded-lg bg-accent-orange text-white hover:bg-accent-orange/80 h-full text-base sm:text-lg font-semibold">
              Sign In
            </Button>
          </Link>
          <Link href={registerHref} passHref className="flex-1">
            <Button
              variant="outline"
              className="w-full py-3.5 sm:py-4 rounded-lg border-deep-teal text-deep-teal hover:bg-deep-teal hover:text-white h-full text-base sm:text-lg font-semibold"
            >
              Sign Up
            </Button>
          </Link>
        </div>
        <div className="mt-4">
          <Link href="/" passHref>
            <Button
              variant="ghost"
              className="w-full text-deep-teal text-sm sm:text-base font-semibold"
            >
              Continue without signing in
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

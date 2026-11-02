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
        <h1 className="text-accent-orange lg:hidden">
          Welcome to <br /> JOODPAKPAW
        </h1>
        <div className="text-[16px] mb-10 lg:hidden">
          <p>Find trusted stays, loving hosts, and happy tails.</p>
          <p>Your pet&apos;s comfort starts here.</p>
        </div>

        <div className="flex h-[60px]">
          <Link href={loginHref} passHref className="flex-1">
            <Button className="w-full py-4 rounded-lg bg-accent-orange text-white hover:bg-accent-orange/80 mr-2 h-full text-[20px] font-semibold">
              Sign In
            </Button>
          </Link>
          <Link href={registerHref} passHref className="flex-1">
            <Button
              variant="outline"
              className="w-full py-4 rounded-lg border-deep-teal text-deep-teal hover:bg-deep-teal hover:text-white ml-2 h-full text-[20px] font-semibold"
            >
              Sign Up
            </Button>
          </Link>
        </div>
        <div className="mt-4">
          <Link href="/" passHref>
            <Button
              variant="ghost"
              className="w-full text-deep-teal text-[18px] font-semibold"
            >
              Continue without signing in
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

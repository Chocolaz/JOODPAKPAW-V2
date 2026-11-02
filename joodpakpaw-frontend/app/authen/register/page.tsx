import AuthHeader from '../_components/AuthHeader'
import RegisterForm from '../_components/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="bg-white text-foreground w-full flex flex-col items-center lg:min-h-0">
      <AuthHeader>
        <div className="z-10 mt-20 mx-5 text-center">
          <h1 className="text-4xl font-bold text-accent-orange mb-[25px]">
            Join the JOODPAKPAW
          </h1>
          <div className="text-[20px]">
            Create your account and start finding safe, <br />
            loving stays for your pet.
          </div>
        </div>
      </AuthHeader>

      {/* Desktop title */}
      <div className="hidden lg:block text-center mb-2 mt-2">
        <h1 className="text-3xl xl:text-4xl font-bold text-accent-orange mb-2">Join the JOODPAKPAW</h1>
        <p className="text-neutral-gray">Create your account and start finding safe, loving stays for your pet.</p>
      </div>

      <RegisterForm />
    </div>
  )
}

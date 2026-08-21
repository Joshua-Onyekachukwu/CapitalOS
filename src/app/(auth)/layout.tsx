import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1629] flex items-center justify-center px-[15px] py-[40px]">
      <div className="w-full max-w-[440px]">
        {/* Logo */}
        <div className="text-center mb-[30px]">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold text-[#0f172a] dark:text-white">
              Capital<span className="text-primary-500">OS</span>
            </span>
          </Link>
        </div>

        {children}
      </div>
    </div>
  );
}

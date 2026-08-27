import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0e19] flex items-center justify-center px-[15px] py-[40px]">
      <div className="w-full max-w-[440px]">
        {/* Back to website link */}
        <div className="mb-[20px]">
          <Link
            href="/"
            className="inline-flex items-center gap-[8px] text-[14px] text-gray-500 hover:text-[#D15616] transition-colors font-medium"
          >
            <i className="ri-arrow-left-line text-[16px]"></i>
            Back to website
          </Link>
        </div>

        {/* Logo */}
        <div className="text-center mb-[30px]">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold text-[#06201b] dark:text-white">
              Capital<span className="text-lime-500">OS</span>
            </span>
          </Link>
        </div>

        {children}
      </div>
    </div>
  );
}

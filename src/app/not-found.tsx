import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <div className="pt-[140px] md:pt-[160px] lg:pt-[220px] xl:pt-[260px] 2xl:pt-[280px] py-[70px] md:py-[90px] lg:py-[110px] xl:py-[150px] 2xl:py-[180px] bg-gray-50 dark:bg-[#0a0e19]">
        <div className="container sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px] mx-auto px-[12px]">
          <div className="text-center">
            <div className="mb-[30px]">
              <span className="text-[80px] md:text-[120px] font-bold text-primary-100 dark:text-primary-900/30">
                404
              </span>
            </div>

            <h2 className="mb-[15px]">Page Not Found</h2>
            <p className="md:text-[16px] lg:text-md">
              The page you are looking for does not exist or has been moved.
            </p>

            <Link
              href="/"
              className="inline-block py-[9px] px-[25px] md:py-[10.5px] md:px-[30px] font-medium text-white bg-primary-500 rounded-[100px] border border-primary-500 transition-all hover:bg-primary-600 hover:border-primary-600 mt-[15px]"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

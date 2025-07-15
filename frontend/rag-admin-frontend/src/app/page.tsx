// app/page.tsx
import Link from 'next/link'; // For navigation links
import Image from 'next/image'; // For optimized images

export default function HomePage() {
  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center p-4 md:p-8 bg-gray-100">
      {/* min-h-[calc(100vh-64px)] assumes your NavBar is roughly 64px tall (p-4 around 16px padding on each side, plus content).
        Adjust if your NavBar height is different. This ensures the main content takes up the remaining viewport height.
      */}
      <div className="container mx-auto p-0 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Left Column: Welcoming Text and Register Link */}
          <div className="flex flex-col justify-center items-center p-8 lg:p-12 text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to RAG Admin
            </h1>
            <p className="text-lg text-gray-600 mb-6 max-w-md">
              Manage your multi-tenant Retrieval-Augmented Generation (RAG) applications with ease. Get started by creating your organization!
            </p>
            <Link href="/register" legacyBehavior>
              <a className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105">
                Get Started - Register Now!
              </a>
            </Link>
            <p className="mt-4 text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/login" legacyBehavior>
                <a className="text-blue-600 hover:underline">Login here.</a>
              </Link>
            </p>
          </div>

          {/* Right Column: Image */}
          <div className="hidden md:flex justify-center items-center bg-blue-50 p-4 h-full">
            <Image
              src="/rag-admin-hero.jpg" 
              alt="RAG Admin Dashboard Screenshot"
              width={800} 
              height={500} 
              className="object-contain w-full h-auto max-h-[500px]"
              priority 
            />
          </div>
        </div>
      </div>
    </main>
  );
}
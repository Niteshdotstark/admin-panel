'use client'; // This component needs to be a client component

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

export default function NavBar() {
  const { isLoggedIn, userEmail, logout, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    // Optionally render a loading state for the Navbar or null
    return null; // Or <nav>...</nav> with a spinner
  }

  return (
    <nav className="bg-gray-800 p-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link className="text-white text-lg font-bold" href="/">
          RAG Admin
        </Link>
        <div className="space-x-4">
          {isLoggedIn ? (
            <>
              {/* Optional: Display user email */}
              <span className="text-white">Welcome, {userEmail}</span>
              <Link className="text-white hover:text-gray-300" href="/dashboard">
                Dashboard
              </Link>
              <button
                onClick={logout}
                className="text-white hover:text-gray-300 bg-red-600 px-3 py-1 rounded-md"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link className="text-white hover:text-gray-300" href="/register">
                Register
              </Link>
              <Link className="text-white hover:text-gray-300" href="/login">
                Login
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
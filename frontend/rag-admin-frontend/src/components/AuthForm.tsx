// components/AuthForm.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { registerUser, loginUser } from '@/lib/api'; // Make sure registerUser is updated later
import { EnvelopeIcon, LockClosedIcon, UserIcon, PhoneIcon, HomeIcon } from '@heroicons/react/24/outline'; // Import new icons
import { useAuth } from '@/contexts/AuthContext';

interface AuthFormProps {
  type: 'register' | 'login';
}

export default function AuthForm({ type }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // New state variables for registration fields
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');

  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuth();

  const mutation = useMutation({
    mutationFn: type === 'register' ? registerUser : loginUser,
    onSuccess: (data) => {
      if (type === 'login') {
        login(data.access_token, data.user.email);
        router.push('/dashboard');
      } else {
        // For successful registration, redirect to login page
        router.push('/login?registered=true'); // Added query param for confirmation
      }
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'An error occurred');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    let data: any = { email, password };

    if (type === 'register') {
      data = {
        ...data,
        username,
        phone_number: phoneNumber, // Use snake_case for backend
        address,
      };
    }
    mutation.mutate(data);
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-md shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        {type === 'register' ? 'Register New Account' : 'Login to Your Account'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div className="flex items-center border rounded-md p-2">
          <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full outline-none"
            required
          />
        </div>

        {/* Password Field */}
        <div className="flex items-center border rounded-md p-2">
          <LockClosedIcon className="h-5 w-5 text-gray-400 mr-2" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full outline-none"
            required
          />
        </div>

        {/* Conditional Fields for Registration */}
        {type === 'register' && (
          <>
            {/* Username Field */}
            <div className="flex items-center border rounded-md p-2">
              <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full outline-none"
                required // Make username required for registration
              />
            </div>

            {/* Phone Number Field */}
            <div className="flex items-center border rounded-md p-2">
              <PhoneIcon className="h-5 w-5 text-gray-400 mr-2" />
              <input
                type="tel" // Use type="tel" for phone numbers
                placeholder="Phone Number (e.g., +91-1234567890)"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full outline-none"
                // Optional: add pattern for validation: pattern="[0-9]{10}"
              />
            </div>

            {/* Address Field */}
            <div className="flex items-center border rounded-md p-2">
              <HomeIcon className="h-5 w-5 text-gray-400 mr-2" />
              <textarea
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full outline-none resize-y min-h-[60px]" // resize-y allows vertical resize
                rows={3} // Initial rows
              />
            </div>
          </>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Processing...' : type === 'register' ? 'Register' : 'Login'}
        </button>
      </form>
    </div>
  );
}
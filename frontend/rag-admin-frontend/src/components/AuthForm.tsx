'use client';

import { useState, FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { registerUser, loginUser } from '@/lib/api';
import { EnvelopeIcon, LockClosedIcon, UserIcon, PhoneIcon, HomeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';

interface AuthFormProps {
  type: 'register' | 'login';
}
type RegisterData = {
  email: string;
  password: string;
  username: string;
  phone_number: string;
  address: string;
};

type LoginData = {
  email: string;
  password: string;
};

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
    mutationFn: async (data: LoginData | RegisterData) => {
      if (type === 'register') {
        return registerUser(data as RegisterData);
      } else {
        return loginUser(data as LoginData);
      }
    },
    onSuccess: (data) => {
      if (type === 'login') {
        login(data.access_token, data.user.email);
        router.push('/dashboard');
      } else {
        router.push('/login?registered=true');
      }
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail || 'An error occurred');
    },
  });

   const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (type === 'register') {
      const registerData: RegisterData = {
        email,
        password,
        username,
        phone_number: phoneNumber,
        address,
      };
      mutation.mutate(registerData);
    } else {
      const loginData: LoginData = { email, password };
      mutation.mutate(loginData);
    }
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
                required
              />
            </div>

            {/* Phone Number Field */}
            <div className="flex items-center border rounded-md p-2">
              <PhoneIcon className="h-5 w-5 text-gray-400 mr-2" />
              <input
                type="tel"
                placeholder="Phone Number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full outline-none"
              />
            </div>

            {/* Address Field */}
            <div className="flex items-center border rounded-md p-2">
              <HomeIcon className="h-5 w-5 text-gray-400 mr-2" />
              <textarea
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full outline-none resize-y min-h-[60px]"
                rows={3}
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
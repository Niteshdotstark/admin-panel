import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://ec2-65-2-142-83.ap-south-1.compute.amazonaws.com/api/';

// Updated interface to include new registration fields
export interface RegisterData {
  email: string;
  password: string;
  username: string;
  phone_number?: string;
  address?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// The registerUser function now accepts the new fields
export const registerUser = async (data: RegisterData) => {
  const response = await axios.post(`${API_URL}/users/`, data);
  return response.data;
};

export const loginUser = async (data: LoginData) => {
  const response = await axios.post(
    `${API_URL}/login/`,
    new URLSearchParams({ username: data.email, password: data.password }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return response.data;
};
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface RegisterData {
  email: string;
  password: string;
  tenant_name?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

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


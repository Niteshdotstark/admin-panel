'use client';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

// Update the Tenant interface to match the backend response
interface Tenant {
  id: number;
  name: string;
  created_at: string;
  fb_url: string | null;
  insta_url: string | null;
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
  sources?: string[];
}
interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
  message?: string;
}
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://ec2-65-2-142-83.ap-south-1.compute.amazonaws.com/api/';

export default function Chat() {
  // We no longer need a list of tenants, just the single one for the user
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch the user's single tenant on mount
  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication token not found. Please log in.');
          router.push('/login');
          return;
        }

        const response = await axios.get(`${API_URL}/tenants/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // The API now returns a list, but we expect at most one item.
        if (response.data.length > 0) {
          setTenant(response.data[0]);
        } else {
          setError('No organization found for your account. Please create one.');
        }
      }  catch (err: unknown) {
        const error = err as ApiError;
        setError('Failed to load organization. ' + (error.response?.data?.detail || 'Please try again.'));
      }
    };

    fetchTenant();
  }, [router]);

  // Scroll to bottom of messages when new message is added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
  if (!inputMessage.trim() || !tenant) {
    setError('Please ensure your organization is loaded and enter a message.');
    return;
  }

  const newMessage: ChatMessage = {
    id: Math.random().toString(36).substring(2),
    text: inputMessage,
    isUser: true,
    timestamp: new Date().toISOString(),
  };

  setMessages(prev => [...prev, newMessage]);
  setInputMessage('');
  setIsLoading(true);
  setError('');

  try {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication token not found. Please log in.');
      return;
    }

    const response = await axios.post(
      `${API_URL}/chatbot/ask?tenant_id=${tenant.id}`,
      { message: newMessage.text },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const botReply: ChatMessage = {
      id: Math.random().toString(36).substring(2),
      text: response.data.response,
      isUser: false,
      timestamp: new Date().toISOString(),
      sources: response.data.sources,
    };

    setMessages(prev => [...prev, botReply]);
  } catch (err: unknown) {
    const error = err as ApiError;
    setError(error.response?.data?.detail || 'Failed to send message.');
  } finally {
    setIsLoading(false);
  }
};


  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 p-4">
      <h1 className="text-3xl font-bold mb-6">Chatbot</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}

      {/* Display a single tenant name instead of a dropdown */}
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700">
          Selected Organization:
          <span className="ml-2 font-bold text-indigo-600">
            {tenant ? tenant.name : 'Loading...'}
          </span>
        </p>
      </div>

      {/* Chat Container */}
      <div className="bg-white rounded-lg shadow-md p-4 h-[500px] flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              {tenant ? 'Start a conversation by typing a message below' : 'Loading organization...'}
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg ${
                    message.isUser
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <p>{message.text}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 text-sm">
                      <p className="font-semibold">Sources:</p>
                      <ul className="list-disc pl-4">
                        {message.sources.map((source, index) => (
                          <li key={index}>
                            <a
                              href={source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              {source}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs mt-1 opacity-75">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t pt-4">
          <div className="flex space-x-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 p-2 border rounded-md resize-none focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
              disabled={isLoading || !tenant}
            />
            <button
              onClick={handleSendMessage}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300"
              disabled={isLoading || !inputMessage.trim() || !tenant}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
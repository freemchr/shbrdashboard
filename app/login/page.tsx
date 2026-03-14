'use client';

import { useState } from 'react';
import Image from 'next/image';

const SECRET = 'shbr2026';

export default function LoginPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() === SECRET) {
      localStorage.setItem('shbr_auth', SECRET);
      window.location.href = '/';
    } else {
      setError('Invalid access code. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Image
              src="/shbr-logo.png"
              alt="SHBR Group"
              width={220}
              height={85}
              priority
              unoptimized
            />
          </div>
          <h1 className="text-xl font-semibold text-white">Prime Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Internal access only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Access Code</label>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter access code"
              autoFocus
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}

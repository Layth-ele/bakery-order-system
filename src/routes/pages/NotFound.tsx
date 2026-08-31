/**
 * NotFound.tsx
 * 404 Not Found page
 * 
 * Displayed when user navigates to a route that doesn't exist
 */

import { useNavigate } from 'react-router';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { motion } from 'motion/react';

export function NotFound(): JSX.Element | null {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#1a1a1a] to-black flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Animation */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-9xl font-bold text-[#D4A574] opacity-30 mb-4">
            404
          </h1>
        </motion.div>
        
        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#D4A574]/20 to-[#B8935E]/20 border-2 border-[#D4A574]/30 mb-6"
        >
          <Search className="w-10 h-10 text-[#D4A574]" />
        </motion.div>
        
        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-bold text-white mb-3">
            Page Not Found
          </h2>
          <p className="text-gray-400 text-lg mb-2">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <p className="text-gray-500">
            Check the URL or use the navigation to find what you need.
          </p>
        </motion.div>
        
        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#D4A574] to-[#B8935E] text-black rounded-lg hover:from-[#C9994A] hover:to-[#A8835E] transition-all font-semibold shadow-lg"
          >
            <Home className="w-4 h-4" />
            Go to Home
          </button>
          
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] transition-colors border border-[#D4A574]/30"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </motion.div>
      </div>
    </div>
  );
}

"use client";

import { FiCloud, FiArrowUp } from "react-icons/fi";
import { motion } from "framer-motion";

export default function Loading({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="relative w-16 h-16 mb-6">
        {/* Cloud */}
        <FiCloud size={64} className="text-gray-900" />
        {/* Animated Arrow */}
        <motion.div
          className="absolute top-8 left-1/2 transform -translate-x-1/2 text-black"
          animate={{ y: [0, -12, 0] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
        >
          <FiArrowUp size={20} />
        </motion.div>
      </div>

      {/* Loading Message */}
      <p className="text-gray-700 text-lg md:text-xl font-medium text-center">
        {message || "Loading..."}
      </p>
    </div>
  );
}

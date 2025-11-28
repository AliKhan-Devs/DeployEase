"use client";

import { FiCloud, FiArrowUp } from "react-icons/fi";
import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="relative w-8 h-8">
        {/* Cloud base */}
        <FiCloud size={36} className="text-gray-900" />
        {/* Arrow accent */}
        <FiArrowUp size={16} className="absolute top-3 left-1/2 transform -translate-x-1/2 text-black font-bold" />
      </div>
      <span className="text-xl md:text-2xl font-bold text-gray-900">DeployEase</span>
    </Link>
  );
}

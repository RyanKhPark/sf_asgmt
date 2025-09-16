"use client";

import React from "react";

export function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 px-4 py-2 rounded-lg flex items-center space-x-2">
        <div className="flex items-center space-x-1">
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]"></div>
            <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]"></div>
            <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]"></div>
          </div>
        </div>
      </div>
    </div>
  );
}


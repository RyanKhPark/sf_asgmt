"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

interface PDFChatProps {
  documentId: string;
  pdfContent?: string;
  onHighlightText?: (phrases: string[]) => void;
  externalNotice?: string;
}

export function PDFChat({ documentId, pdfContent, onHighlightText, externalNotice }: PDFChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Inject external notices as assistant messages when provided
  useEffect(() => {
    if (!externalNotice) return;
    const notice: Message = {
      id: `notice-${Date.now()}`,
      text: externalNotice,
      isUser: false,
    };
    setMessages((prev) => [...prev, notice]);
  }, [externalNotice]);

  // Load chat history on component mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await fetch(`/api/conversations/${documentId}`);
        if (response.ok) {
          const data = await response.json();
          setConversationId(data.conversationId);
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadChatHistory();
  }, [documentId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      isUser: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: inputValue,
          pdfContent,
          documentId,
          conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.message,
        isUser: false,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Use AI to extract topic and find matching PDF content
      if (onHighlightText && data.message) {
        // Send the AI response for analysis - the analysis system will use AI to:
        // 1. Extract the essential topic from the response
        // 2. Find matching content in the PDF text
        // 3. Return relevant phrases for highlighting
        console.log(`🎯 Triggering highlight analysis for AI response: "${data.message}"`);
        onHighlightText([data.message]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error. Please try again.",
        isUser: false,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">AI Assistant</h3>
        <p className="text-sm text-gray-500">
          Ask questions about this document
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory ? (
          <div className="text-center text-gray-500 py-8">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]"></div>
            </div>
            <p className="text-sm mt-2">Loading chat history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg font-medium">👋 Hi there!</p>
            <p className="text-sm mt-2">
              Ask me anything about this PDF document.
            </p>
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.isUser ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg ${
                message.isUser
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.text}</p>
            </div>
          </div>
        ))}

        {isLoading && (
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
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about this document..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Mic, MicOff, Waves, AudioWaveform } from "lucide-react";
import { toast } from "sonner";
import { useTTS } from "@/hooks/use-tts";
import { MessageBubble } from "@/components/chat/message-bubble";
import { TypingDots } from "@/components/chat/typing-dots";
// Using browser TTS for voice synthesis

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  onerror: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

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
  // Optional: invoked when backend returns a persisted assistant messageId
  onAIMessageSaved?: (messageId: string) => void;
}

export function PDFChat({
  documentId,
  pdfContent,
  onHighlightText,
  externalNotice,
  onAIMessageSaved,
}: PDFChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Speech-related state
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isConversationMode, setIsConversationMode] = useState(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const currentInterimRef = useRef<string>("");
  const isConversationModeRef = useRef<boolean>(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      // Stop any ongoing speech synthesis
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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

  // Separated message sending logic for reuse in voice mode
  const sendMessageToAI = async (message: string) => {
    if (!message.trim()) return;

    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
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

      // If API returns a persisted messageId, expose it for linking highlights
      if (data.messageId && typeof data.messageId === "string") {
        try {
          onAIMessageSaved?.(data.messageId);
        } catch {}
      }

      // Speak the AI response if voice mode is enabled
      if (isConversationModeRef.current && data.message) {
        await speak(data.message);
      }

      // Use AI to extract topic and find matching PDF content
      if (onHighlightText && data.message) {
        onHighlightText([data.message]);
      }

      // Don't restart listening here, it will be handled after speech ends
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error. Please try again.",
        isUser: false,
      };
      setMessages((prev) => [...prev, errorMessage]);

      // Don't restart listening after error, user can manually restart
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      isUser: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = inputValue;
    setInputValue("");

    await sendMessageToAI(messageToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Speech-to-Text functionality with automatic sentence detection
  const initializeSpeechRecognition = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);

      finalTranscriptRef.current = "";
      currentInterimRef.current = "";
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      // Process all results from the current result index
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript = transcript;
        }
      }

      // Update the final transcript if we got new final results
      if (finalTranscript) {
        finalTranscriptRef.current += finalTranscript;
      }

      // Calculate full current transcript
      const fullTranscript = finalTranscriptRef.current + interimTranscript;

      // Update display
      setInterimTranscript(fullTranscript);
      currentInterimRef.current = interimTranscript;

      // In manual mode, update input field
      if (!isConversationModeRef.current) {
        setInputValue(fullTranscript);
        return;
      }

      // In conversation mode, check for auto-submission
      if (isConversationModeRef.current && fullTranscript.trim()) {
        // Clear existing timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        const trimmedText = fullTranscript.trim();

        // Check for sentence ending punctuation
        if (trimmedText.match(/[.!?]$/)) {
          submitVoiceMessage(trimmedText);
          return;
        }

        // Check for question words that might indicate completion
        const questionStarters =
          /^(what|where|when|why|who|how|is|are|can|could|would|should|do|does|did)/i;
        const mightBeQuestion = questionStarters.test(trimmedText);

        // Set silence timer (shorter for likely questions)
        const silenceDelay = mightBeQuestion ? 1500 : 2000;

        silenceTimerRef.current = setTimeout(() => {
          if (
            finalTranscriptRef.current.trim() ||
            currentInterimRef.current.trim()
          ) {
            const finalText = (
              finalTranscriptRef.current + currentInterimRef.current
            ).trim();

            submitVoiceMessage(finalText);
          }
        }, silenceDelay);
      } else if (!isConversationModeRef.current && fullTranscript.trim()) {
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        toast.error("Speech recognition error: " + event.error);
      }
      setIsListening(false);
      setInterimTranscript("");
    };

    recognition.onend = () => {
      setIsListening(false);

      // Clear any pending timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      // Submit any remaining transcript when recognition ends
      const remainingText = (
        finalTranscriptRef.current + currentInterimRef.current
      ).trim();
      if (isConversationModeRef.current && remainingText && !isSpeaking) {
        submitVoiceMessage(remainingText);
      } else if (isConversationModeRef.current && !isSpeaking) {
        // If in conversation mode but no text, restart listening
        setTimeout(() => {
          if (
            recognitionRef.current &&
            isConversationModeRef.current &&
            !isListening
          ) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error("Failed to restart:", e);
            }
          }
        }, 100);
      }

      // Clear the interim display
      if (!remainingText) {
        setInterimTranscript("");
      }
    };

    recognitionRef.current = recognition;
  };

  // Helper function to submit voice message
  const submitVoiceMessage = (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    // Clear timers and transcript
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Clear all transcript state
    setInterimTranscript("");
    finalTranscriptRef.current = "";
    currentInterimRef.current = "";

    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      text: trimmedText,
      isUser: true,
    };
    setMessages((prev) => [...prev, userMessage]);

    // Stop listening while processing
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }

    // Send the message to AI
    sendMessageToAI(trimmedText);
  };

  const { speak } = useTTS({
    enabledRef: isConversationModeRef,
    onEnd: () => restartListeningAfterSpeech(),
    setIsSpeaking,
  });

  // Helper to restart listening after speech ends
  const restartListeningAfterSpeech = () => {
    if (isConversationModeRef.current && recognitionRef.current) {
      setTimeout(() => {
        finalTranscriptRef.current = "";
        currentInterimRef.current = "";
        setInterimTranscript("");
        try {
          recognitionRef.current?.start();
        } catch (e) {
          console.error("Failed to restart recognition:", e);
        }
      }, 500);
    }
  };

  // Toggle voice conversation mode
  const toggleVoiceMode = async () => {
    const newState = !isConversationMode;

    setIsConversationMode(newState);
    setIsSpeechEnabled(newState);
    isConversationModeRef.current = newState;

    if (newState) {
      // Load voices if not already loaded
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.getVoices();
      }

      initializeSpeechRecognition();

      toast.success("🎤 Voice mode enabled - Start speaking!");

      // Start listening automatically
      setTimeout(() => {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error("Failed to start recognition:", e);
            toast.error("Failed to start voice recognition");
          }
        }
      }, 500);
    } else {
      // Stop everything
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      // No additional cleanup needed for browser TTS

      setIsListening(false);
      setIsSpeaking(false);
      setInterimTranscript("");
      finalTranscriptRef.current = "";
      currentInterimRef.current = "";

      toast.success("🔇 Voice mode disabled");
    }
  };

  // Start/stop listening
  const toggleListening = () => {
    if (!isSpeechEnabled) return;

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="px-4 h-14 flex items-center border-b border-gray-200 bg-gray-50">
        <div>
          <h3 className="font-semibold text-gray-900 leading-tight">
            AI Assistant
          </h3>
          <p className="text-xs text-gray-500">
            Ask questions about this document
          </p>
        </div>
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
          <MessageBubble
            key={message.id}
            isUser={message.isUser}
            text={message.text}
          />
        ))}

        {isLoading && <TypingDots />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <textarea
            value={isConversationMode ? interimTranscript : inputValue}
            onChange={(e) =>
              !isConversationMode && setInputValue(e.target.value)
            }
            onKeyDown={!isConversationMode ? handleKeyDown : undefined}
            placeholder={
              isConversationMode
                ? isListening
                  ? "Listening... Speak now"
                  : "Voice mode active"
                : "Ask a question!"
            }
            className={`flex-1 resize-none border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isConversationMode
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300"
            }`}
            rows={1}
            disabled={isLoading || isConversationMode}
            readOnly={isConversationMode}
          />

          {/* Voice Mode Toggle */}
          <Button
            onClick={toggleVoiceMode}
            variant={isConversationMode ? "default" : "outline"}
            className="px-4 py-1 h-10 relative"
            title="Toggle voice mode"
          >
            {isConversationMode ? (
              <MicOff className="h-4 w-4 text-white" />
            ) : (
              <Mic className="h-4 w-4 text-gray-600" />
            )}
            {isConversationMode && isListening && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </Button>

          {isSpeaking && (
            <div className="flex items-center px-3 py-2 bg-blue-100 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0ms]"></div>
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:150ms]"></div>
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:300ms]"></div>
              </div>
            </div>
          )}

          {/* Send Button (only show when not in conversation mode) */}
          {!isConversationMode && (
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="px-4 py-1 h-10"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

export function useTTS(params: {
  enabledRef: React.MutableRefObject<boolean>;
  onEnd: () => void;
  setIsSpeaking: (v: boolean) => void;
}) {
  const { enabledRef, onEnd, setIsSpeaking } = params;

  const speak = (text: string) => {
    if (!enabledRef.current) return Promise.resolve();
    return new Promise<void>((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        setIsSpeaking(false);
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.lang === "en-US" && v.localService) ||
        voices.find((v) => v.lang === "en-US") ||
        voices[0];
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => {
        setIsSpeaking(false);
        onEnd();
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    });
  };

  return { speak };
}


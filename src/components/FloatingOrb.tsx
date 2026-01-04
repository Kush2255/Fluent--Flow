import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, AlertCircle } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

type OrbState = "idle" | "listening" | "processing" | "suggesting";

const FloatingOrb = () => {
  const [state, setState] = useState<OrbState>("idle");
  const [suggestionText, setSuggestionText] = useState<string>("");
  const [permissionDenied, setPermissionDenied] = useState(false);

  const constraintsRef = useRef<HTMLDivElement>(null);
  const lastProcessedTranscript = useRef<string>("");

  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    lang: "en-US",
  });

  const currentTranscript =
    transcript + (interimTranscript ? " " + interimTranscript : "");

  // 🔹 CALL BACKEND API (SAFE)
  const callBackend = async (text: string) => {
    try {
      setState("processing");

      const response = await fetch("/api/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });

      const resultText = await response.text();

      // 🔐 SAFETY GUARD (PREVENTS REACT CRASH)
      if (typeof resultText !== "string" || resultText.trim().length === 0) {
        setSuggestionText("Wait and listen for a moment.");
      } else {
        setSuggestionText(resultText.trim());
      }

      setState("suggesting");

      setTimeout(() => {
        if (isListening) setState("listening");
      }, 5000);
    } catch (error) {
      console.error("Backend error:", error);
      setSuggestionText("Wait and listen for a moment.");
      setState("suggesting");
    }
  };

  // 🔹 Process ONLY new transcript
  useEffect(() => {
    const cleaned = transcript.trim();

    if (
      state === "listening" &&
      cleaned.length > 5 &&
      cleaned !== lastProcessedTranscript.current
    ) {
      lastProcessedTranscript.current = cleaned;
      callBackend(cleaned);
    }
  }, [transcript, state]);

  // 🔹 Sync listening state
  useEffect(() => {
    if (isListening && state === "idle") setState("listening");
    if (!isListening && state !== "idle") setState("idle");
  }, [isListening]);

  const handleClick = useCallback(async () => {
    if (state === "idle") {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setPermissionDenied(false);
        resetTranscript();
        startListening();
        setState("listening");
      } catch {
        setPermissionDenied(true);
      }
    } else {
      stopListening();
      setState("idle");
      setSuggestionText("");
      lastProcessedTranscript.current = "";
    }
  }, [state]);

  if (!isSupported) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="glass rounded-xl px-4 py-3 flex gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm">Speech recognition not supported.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={constraintsRef} className="fixed inset-0 z-50 pointer-events-none">
      <motion.div
        drag
        dragConstraints={constraintsRef}
        className="absolute bottom-6 right-6 pointer-events-auto"
      >
        <div className="relative">
          <motion.button
            onClick={handleClick}
            className="w-16 h-16 rounded-full glass flex items-center justify-center"
          >
            {state === "idle" && !permissionDenied && <Mic />}
            {state === "idle" && permissionDenied && <MicOff />}
            {state === "listening" && <Mic className="text-blue-400" />}
            {state === "processing" && (
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            )}
            {state === "suggesting" && <Volume2 className="text-blue-400" />}
          </motion.button>

          {/* 🔹 POPUP (ONE SENTENCE ONLY) */}
          <AnimatePresence>
            {state === "suggesting" && suggestionText && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="absolute right-full mr-4 top-1/2 -translate-y-1/2 w-64"
              >
                <div className="glass rounded-xl p-3">
                  <p className="text-sm leading-relaxed">
                    {typeof suggestionText === "string" ? suggestionText : ""}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default FloatingOrb;

import { useState, useEffect, useRef } from "react";

/**
 * Smoothly reveals text character-by-character, creating a typewriter effect.
 * When `isStreaming` is true, new characters from `fullText` are revealed gradually.
 * When `isStreaming` becomes false, any remaining text is shown immediately.
 */
export function useTypewriter(fullText: string, isStreaming: boolean, speed = 12) {
  const [displayed, setDisplayed] = useState(fullText);
  const targetRef = useRef(fullText);
  const displayedLenRef = useRef(fullText.length);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  // Update target when fullText changes
  targetRef.current = fullText;

  useEffect(() => {
    if (!isStreaming) {
      // When streaming ends, show everything immediately
      setDisplayed(fullText);
      displayedLenRef.current = fullText.length;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const msPerChar = 1000 / speed; // ~12 chars = ~83ms per char

    const tick = (now: number) => {
      const target = targetRef.current;
      const currentLen = displayedLenRef.current;

      if (currentLen >= target.length) {
        // Caught up, wait for more
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (!lastTimeRef.current) lastTimeRef.current = now;
      const elapsed = now - lastTimeRef.current;

      // How many chars to reveal this frame
      let charsToReveal = Math.floor(elapsed / msPerChar);
      
      // If we're falling behind (buffer > 80 chars), speed up proportionally
      const buffer = target.length - currentLen;
      if (buffer > 80) {
        charsToReveal = Math.max(charsToReveal, Math.ceil(buffer * 0.3));
      } else if (buffer > 40) {
        charsToReveal = Math.max(charsToReveal, Math.ceil(buffer * 0.15));
      }

      if (charsToReveal > 0) {
        const newLen = Math.min(currentLen + charsToReveal, target.length);
        displayedLenRef.current = newLen;
        setDisplayed(target.slice(0, newLen));
        lastTimeRef.current = now;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isStreaming, speed]);

  // When not streaming at all (static message), just return full text
  return isStreaming ? displayed : fullText;
}

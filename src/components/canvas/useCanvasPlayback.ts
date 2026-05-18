import { useEffect, useRef, useState } from 'react';

interface Options {
  total: number;
  /** ms per step */
  stepDurationMs?: number;
}

interface PlaybackState {
  currentStep: number;
  playing: boolean;
  drawAndShowMode: boolean;
  setStep: (n: number) => void;
  prev: () => void;
  next: () => void;
  playPause: () => void;
  drawAndShow: () => void;
  reset: () => void;
}

export function useCanvasPlayback({
  total,
  stepDurationMs = 600,
}: Options): PlaybackState {
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [drawAndShowMode, setDrawAndShowMode] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Stop timer helper
  const stop = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (!playing) {
      stop();
      return;
    }
    if (currentStep >= total) {
      setPlaying(false);
      setDrawAndShowMode(false);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      setCurrentStep((s) => {
        const next = s + 1;
        if (next >= total) {
          setPlaying(false);
          setDrawAndShowMode(false);
          return total;
        }
        return next;
      });
    }, stepDurationMs);
    return stop;
  }, [playing, currentStep, total, stepDurationMs]);

  return {
    currentStep,
    playing,
    drawAndShowMode,
    setStep: (n: number) => {
      stop();
      setPlaying(false);
      setDrawAndShowMode(false);
      setCurrentStep(Math.max(0, Math.min(total, n)));
    },
    prev: () => {
      stop();
      setPlaying(false);
      setDrawAndShowMode(false);
      setCurrentStep((s) => Math.max(0, s - 1));
    },
    next: () => {
      stop();
      setPlaying(false);
      setDrawAndShowMode(false);
      setCurrentStep((s) => Math.min(total, s + 1));
    },
    playPause: () => {
      if (playing) {
        stop();
        setPlaying(false);
      } else {
        if (currentStep >= total) setCurrentStep(0);
        setPlaying(true);
      }
    },
    drawAndShow: () => {
      stop();
      setCurrentStep(0);
      setPlaying(true);
      setDrawAndShowMode(true);
    },
    reset: () => {
      stop();
      setPlaying(false);
      setDrawAndShowMode(false);
      setCurrentStep(0);
    },
  };
}

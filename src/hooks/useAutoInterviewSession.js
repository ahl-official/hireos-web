import { useState, useEffect, useRef, useCallback } from 'react';
import { evaluateAudioTurn } from '../utils/googleSheets';

const FILLER_WORDS = ['um', 'uh', 'hm', 'hmm', 'ah', 'oh', 'like', 'you know', 'so', 'actually', 'right', 'okay', 'ok', 'i mean'];
const FILLER_REGEX = new RegExp(`\\b(?:${FILLER_WORDS.join('|')})\\b`, 'gi');
const SILENCE_THRESHOLD = 10;
const SILENCE_TIMEOUT_MS = 2500;
const MIN_MEANINGFUL_WORDS = 3;
const MAX_RETRY_ATTEMPTS = 2;

const normalizeTranscript = (value) => String(value || '').trim().replace(/[\r\n]+/g, ' ');

export const cleanTranscript = (rawText) => {
  const text = normalizeTranscript(rawText);
  if (!text) return '';

  const cleaned = text
    .replace(/\b([a-zA-Z])\s+\1\b/g, '$1')
    .replace(FILLER_REGEX, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
};

export const validateTranscript = (rawText) => {
  const cleaned = cleanTranscript(rawText);
  const meaningfulWords = cleaned.split(/\s+/).filter((word) => word.length > 1);

  if (!cleaned) {
    return { valid: false, cleaned, reason: 'No speech detected.' };
  }
  if (meaningfulWords.length < MIN_MEANINGFUL_WORDS) {
    return { valid: false, cleaned, reason: 'Answer seems too short or only filler.' };
  }
  return { valid: true, cleaned, reason: '' };
};

const speakWithVoice = (text, onStart, onEnd) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((voice) => voice.name.includes('Google') && voice.lang.startsWith('en'))
      || voices.find((voice) => voice.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.error('Speech synthesis failed:', error);
    onEnd?.();
  }
};

export function useAutoInterviewSession(questions = [], isSessionReady = true) {
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Waiting for the first question...');
  const [retryCount, setRetryCount] = useState({});
  const [needsManualRetry, setNeedsManualRetry] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [audioError, setAudioError] = useState('');

  const ttsLockRef = useRef(false);
  const voicesReadyRef = useRef(false);
  const questionSessionRef = useRef({});
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceStartRef = useRef(null);
  const rafRef = useRef(null);
  const speechStartedRef = useRef(false);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => { voicesReadyRef.current = (window.speechSynthesis.getVoices() || []).length > 0; };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { try { window.speechSynthesis.onvoiceschanged = null; } catch {} };
  }, []);

  const updateStatus = useCallback((message) => {
    setStatusMessage(message);
    setAudioError('');
  }, []);

  const speakAcknowledgment = useCallback((message, onEnd) => {
    if (ttsLockRef.current) {
      onEnd?.();
      return;
    }
    ttsLockRef.current = true;
    setIsAcknowledging(true);
    speakWithVoice(message, null, () => {
      setIsAcknowledging(false);
      ttsLockRef.current = false;
      onEnd?.();
    });
  }, []);

  const handleAnswerAccepted = useCallback((cleanedTranscript) => {
    const index = currentQuestionIndex;
    setAnswers((prev) => ({ ...prev, [index]: cleanedTranscript }));
    setNeedsManualRetry(false);
    setStatusMessage('Nice answer. Moving to the next question...');

    speakAcknowledgment('Great. I heard that clearly.', () => {
      if (index < questions.length - 1) {
        setCurrentQuestionIndex((current) => current + 1);
      } else {
        setStatusMessage('That was the last question. You can submit your interview now.');
      }
    });
  }, [currentQuestionIndex, questions.length, speakAcknowledgment]);

  const cleanupAudioSession = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
  }, []);

  const stopRecordingAndProcess = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
  }, []);

  const processAudioBlob = useCallback(async (blob) => {
    setIsProcessingAudio(true);
    setStatusMessage('Processing your answer...');
    setLastTranscript('');
    setAudioError('');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          let base64 = reader.result.toString().replace(/^data:(.*,)?/, '');
          if ((base64.length % 4) > 0) base64 += '='.repeat(4 - (base64.length % 4));
          const rawText = await evaluateAudioTurn(base64, 'webm');
          const cleaned = cleanTranscript(rawText);
          const validation = validateTranscript(rawText);
          setLastTranscript(rawText || '');

          if (!validation.valid) {
            const attempt = (retryCount[currentQuestionIndex] || 0) + 1;
            setRetryCount((prev) => ({ ...prev, [currentQuestionIndex]: attempt }));

            if (attempt <= MAX_RETRY_ATTEMPTS) {
              setStatusMessage('I did not understand you clearly. Let’s try that question again.');
              speakAcknowledgment('I did not understand that clearly. Please answer again.', () => {
                questionSessionRef.current[currentQuestionIndex] = false;
                setNeedsManualRetry(false);
              });
            } else {
              setNeedsManualRetry(true);
              setStatusMessage('I could not capture a clear answer. Please re-record manually.');
            }
          } else {
            handleAnswerAccepted(cleaned);
          }
        } catch (error) {
          console.error('Audio processing failed:', error);
          setAudioError('Unable to transcribe your answer. Please try again.');
          setStatusMessage('Audio processing failed. Please re-record.');
          setNeedsManualRetry(true);
        } finally {
          setIsProcessingAudio(false);
        }
      };
    } catch (error) {
      console.error('Failed reading audio blob:', error);
      setIsProcessingAudio(false);
      setAudioError('Could not read the recorded audio. Please try again.');
      setStatusMessage('Failed to read audio. Please re-record.');
      setNeedsManualRetry(true);
    }
  }, [currentQuestionIndex, handleAnswerAccepted, retryCount, speakAcknowledgment]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    setAudioError('');

    try {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        processAudioBlob(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatusMessage('Listening for your response... (tap to stop)');
    } catch (error) {
      console.error('Recording failed:', error);
      setAudioError('Unable to start microphone recording. Please allow microphone access and try again.');
      setStatusMessage('Microphone access required.');
      setIsRecording(false);
    }
  }, [isRecording, processAudioBlob]);

  const speakQuestion = useCallback((text) => {
    if (ttsLockRef.current) return;
    if (!text) return;

    questionSessionRef.current[currentQuestionIndex] = true;
    speechStartedRef.current = false;
    setStatusMessage('Asking the question...');
    speakWithVoice(text, () => {
      speechStartedRef.current = true;
      setIsSpeaking(true);
    }, () => {
      setIsSpeaking(false);
      if (speechStartedRef.current) {
        setStatusMessage('Waiting for your response...');
        if (!answers[currentQuestionIndex]) {
          startRecording();
        }
      } else {
        questionSessionRef.current[currentQuestionIndex] = false;
        setAudioError('Question audio could not play. Please replay the question.');
        setStatusMessage('Audio did not play. Tap replay to hear the question again.');
      }
    });
  }, [answers, currentQuestionIndex, startRecording]);

  const startCurrentQuestion = useCallback(() => {
    if (!isSessionReady) return;
    if (!questions[currentQuestionIndex]) return;
    if (answers[currentQuestionIndex]) return;
    if (needsManualRetry) return;
    if (isSpeaking || isRecording || isProcessingAudio) return;
    if (questionSessionRef.current[currentQuestionIndex]) return;

    speakQuestion(questions[currentQuestionIndex]);
  }, [answers, currentQuestionIndex, isProcessingAudio, isRecording, isSpeaking, isSessionReady, needsManualRetry, questions, speakQuestion]);

  useEffect(() => {
    if (!questions.length || !isSessionReady) return;
    startCurrentQuestion();
  }, [currentQuestionIndex, questions.length, isSessionReady, startCurrentQuestion]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecordingAndProcess();
      return;
    }
    startRecording();
  }, [isRecording, startRecording, stopRecordingAndProcess]);

  const handleReRecord = useCallback(() => {
    cleanupAudioSession();
    setAnswers((prev) => ({ ...prev, [currentQuestionIndex]: undefined }));
    setNeedsManualRetry(false);
    questionSessionRef.current[currentQuestionIndex] = false;
    setStatusMessage('Please speak your answer when ready.');
    setTimeout(() => {
      startRecording();
    }, 300);
  }, [cleanupAudioSession, currentQuestionIndex, startRecording]);

  const handleDoneAndNext = useCallback(() => {
    cleanupAudioSession();
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((current) => current + 1);
    } else {
      setStatusMessage('All questions completed. Submit your interview when ready.');
    }
  }, [cleanupAudioSession, currentQuestionIndex, questions.length]);

  const handleNext = useCallback(() => {
    cleanupAudioSession();
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((current) => current + 1);
    }
  }, [cleanupAudioSession, currentQuestionIndex, questions.length]);

  return {
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    setAnswers,
    isSpeaking,
    isRecording,
    isProcessingAudio,
    isAcknowledging,
    statusMessage,
    retryCount,
    needsManualRetry,
    lastTranscript,
    audioError,
    speakQuestion,
    toggleRecording,
    handleReRecord,
    handleDoneAndNext,
    handleNext
  };
}

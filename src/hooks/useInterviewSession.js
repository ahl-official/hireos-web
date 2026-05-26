import { useState, useCallback, useEffect, useRef } from 'react';
import { useAudioRecorder } from './useAudioRecorder';
import { useAlisaVoice } from './useAlisaVoice';
import { processAnswerAudio, saveConfirmedAnswer, submitInterview } from '../services/interviewApi';
import { INTERVIEW_STATUS } from '../utils/interviewStates';

export function useInterviewSession(
  questions = [],
  sttInterviewId = null,
  candidateId = '',
  candidateName = ''
) {
  console.log('[useInterviewSession] Hook initialized v2.1');
  const [status, setStatus] = useState(INTERVIEW_STATUS.IDLE);
  const statusRef = useRef(INTERVIEW_STATUS.IDLE);

  // Keep statusRef in sync for stable logging
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [statusMessage, setStatusMessage] = useState('');
  const [audioError, setAudioError] = useState('');

  // Review Transcripts
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentMatchScore, setCurrentMatchScore] = useState(0);
  const [transcriptSource, setTranscriptSource] = useState(''); // 'streaming' or 'batch'
  const [isDraft, setIsDraft] = useState(false);

  const {
    isRecording,
    audioBlob,
    durationSeconds,
    volumeLevel,
    maxVolumeReached,
    startRecording: startMic,
    stopRecording: stopMic,
    resetRecording,
    blobToBase64,
  } = useAudioRecorder();
  const { speak, isSpeaking, stopSpeaking, unlockAudio } = useAlisaVoice();

  const transitionTo = useCallback((newStatus) => {
    const oldStatus = statusRef.current;
    if (oldStatus === newStatus) return; // Prevent redundant transitions
    console.log(`[useInterviewSession] transitionTo: ${oldStatus} -> ${newStatus}`);

    statusRef.current = newStatus;
    setStatus(newStatus);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      stopMic();
    };
  }, [stopSpeaking, stopMic]);

  const speakQuestion = useCallback(
    (text, onEnd) => {
      console.log('[useInterviewSession] speakQuestion INVOKED', {
        text: text?.substring(0, 40) + '...',
        currentStatus: statusRef.current,
      });

      transitionTo(INTERVIEW_STATUS.SPEAKING);

      speak(text, () => {
        console.log('[useInterviewSession] speak CALLBACK fired, moving to READY_TO_ANSWER');
        transitionTo(INTERVIEW_STATUS.READY_TO_ANSWER);
        if (onEnd) {
          console.log('[useInterviewSession] executing additional onEnd callback');
          onEnd();
        }
      });
    },
    [speak, transitionTo]
  );

  const startAnswerRecording = useCallback(async () => {
    if (import.meta.env.DEV) {
      console.log(
        '[useInterviewSession] startAnswerRecording invoked. Current status:',
        statusRef.current
      );
    }

    if (statusRef.current === INTERVIEW_STATUS.RECORDING || isRecording) {
      if (import.meta.env.DEV) {
        console.warn('[useInterviewSession] startAnswerRecording skipped: already recording.');
      }
      return;
    }

    try {
      setAudioError('');
      transitionTo(INTERVIEW_STATUS.RECORDING);

      await startMic(() => {
        // Streaming chunks disabled in Phase 1
      });
    } catch (e) {
      console.error('[useInterviewSession] Microphone Error:', e);
      setAudioError(e.message || 'Microphone error.');
      transitionTo(INTERVIEW_STATUS.ERROR);
    }
  }, [startMic, transitionTo, isRecording]);

  const finishAnswerRecording = useCallback(
    async (questionText, isPractice) => {
      console.log('[useInterviewSession] finishAnswerRecording called', { isPractice });
      setAudioError('');
      const capturedBlob = await stopMic();

      transitionTo(INTERVIEW_STATUS.PROCESSING_AUDIO);
      setIsDraft(false);

      const finalBlob = capturedBlob || audioBlob;

      if (!finalBlob || finalBlob.size < 500) {
        console.error('[useInterviewSession] Audio capture failed or empty.');
        setAudioError("Microphone didn't capture any sound. Please check your settings.");
        transitionTo(INTERVIEW_STATUS.READY_TO_ANSWER);
        return;
      }

      console.log('[useInterviewSession] Recording Stats:', {
        size: (finalBlob.size / 1024).toFixed(2) + 'KB',
        duration: durationSeconds + 's',
        peak: maxVolumeReached.toFixed(1) + '%',
      });

      // 1.5s is enough for "Yes", "No", or a name
      if (durationSeconds < 1.5) {
        setAudioError('Recording was too short. Please speak for at least 2-3 seconds.');
        transitionTo(INTERVIEW_STATUS.READY_TO_ANSWER);
        return;
      }

      // Silence check
      if (maxVolumeReached < 4) {
        setAudioError("We couldn't hear you. Please speak louder or move closer to the mic.");
        transitionTo(INTERVIEW_STATUS.READY_TO_ANSWER);
        return;
      }

      try {
        const base64 = await blobToBase64(finalBlob);
        const qType = isPractice ? 'practice' : currentQuestionIndex < 8 ? 'hr' : 'technical';

        const result = await processAnswerAudio({
          interviewId: sttInterviewId,
          candidateId,
          candidateName,
          questionNo: isPractice ? 'PRACTICE' : currentQuestionIndex + 1,
          questionId: isPractice ? 'PRACTICE' : `Q${currentQuestionIndex + 1}`,
          questionText: questionText,
          questionType: qType,
          audioBase64: base64,
          mimeType: finalBlob.type,
          browserPreviewTranscript: '',
          audioDurationSeconds: durationSeconds,
          retryCount: 0,
        });

        if (result.status === 'error') {
          throw new Error(result.message || 'Transcription failed');
        }

        const stt = result.transcription || {};

        // If AssemblyAI returned success but empty text, it's usually because it's just noise/silence
        if (!stt.transcript || stt.transcript.trim().length === 0) {
          setAudioError(
            "We couldn't detect any words in your answer. Please try again and speak clearly."
          );
          transitionTo(INTERVIEW_STATUS.READY_TO_ANSWER);
          return;
        }

        if (statusRef.current === INTERVIEW_STATUS.PROCESSING_AUDIO) {
          setCurrentTranscript(stt.transcript);
          setCurrentMatchScore(stt.confidence || 0);
          setTranscriptSource('assemblyai');
          setIsDraft(false);
          transitionTo(INTERVIEW_STATUS.TRANSCRIPT_REVIEW);
        }
      } catch (e) {
        console.error('[useInterviewSession] Transcription Process Error:', e);
        setAudioError(
          e.message || 'We encountered a technical issue while transcribing. Please try again.'
        );
        // We stay in PROCESSING_AUDIO so the InteractionProcessing component
        // shows the transcriptError state with its own retry buttons.
      }
    },
    [
      audioBlob,
      blobToBase64,
      candidateId,
      candidateName,
      currentQuestionIndex,
      durationSeconds,
      sttInterviewId,
      stopMic,
      transitionTo,
      maxVolumeReached,
    ]
  );

  const retryAnswer = useCallback(() => {
    setAudioError('');
    resetRecording();
    transitionTo(INTERVIEW_STATUS.READY_TO_ANSWER);
  }, [resetRecording, transitionTo]);

  const jumpToQuestion = useCallback(
    (index) => {
      setCurrentQuestionIndex(index);
      transitionTo(INTERVIEW_STATUS.TRANSCRIPT_REVIEW);
      setCurrentTranscript(answers[index] || '');
    },
    [answers, transitionTo]
  );

  const confirmAnswerAction = useCallback(
    async (confirmedTranscript, isPractice, questionText) => {
      if (statusRef.current === INTERVIEW_STATUS.SAVING_ANSWER) {
        console.warn('[useInterviewSession] Prevented double click on confirmAnswerAction');
        return;
      }

      console.log('[useInterviewSession] confirmAnswerAction START', {
        transcriptLen: confirmedTranscript?.length,
        currentIdx: currentQuestionIndex,
        isPractice,
        totalQuestions: questions.length,
      });

      unlockAudio();
      transitionTo(INTERVIEW_STATUS.SAVING_ANSWER);

      if (isPractice) {
        console.log('[useInterviewSession] Practice confirm - going to INSTRUCTIONS');
        transitionTo(INTERVIEW_STATUS.INSTRUCTIONS);
        return;
      }

      try {
        console.log('[useInterviewSession] Calling saveConfirmedAnswer API...');
        const saveStartTime = Date.now();
        const qType = isPractice ? 'practice' : currentQuestionIndex < 8 ? 'hr' : 'technical';

        const result = await saveConfirmedAnswer({
          interviewId: sttInterviewId,
          candidateId,
          candidateName,
          questionNo: currentQuestionIndex + 1,
          questionId: `Q${currentQuestionIndex + 1}`,
          questionType: qType,
          questionText,
          browserPreviewTranscript: '', // DISABLED
          finalTranscript: confirmedTranscript,
          cleanedTranscript: confirmedTranscript,
          candidateConfirmed: 'Yes',
          audioFileName: '',
          audioFileLink: '',
          driveFileId: '',
          audioDurationSeconds: durationSeconds,
          retryCount: 0,
          sttConfidence: currentMatchScore,
          languageDetected: 'en',
          answerStatus:
            transcriptSource === 'streaming' ? 'Confirmed (Streaming)' : 'Confirmed (Batch)',
        });
        console.log(
          `[useInterviewSession] API Response (took ${Date.now() - saveStartTime}ms):`,
          result
        );

        console.log('[useInterviewSession] Updating answers local state...');
        setAnswers((prev) => ({ ...prev, [currentQuestionIndex]: confirmedTranscript }));

        if (currentQuestionIndex < questions.length - 1) {
          const nextIdx = currentQuestionIndex + 1;
          setCurrentQuestionIndex(nextIdx);

          // Brief 1s transition for human-like realism
          transitionTo(INTERVIEW_STATUS.NEXT_QUESTION);

          setTimeout(() => {
            const nextQuestionText = questions[nextIdx];
            if (nextQuestionText) {
              speakQuestion(nextQuestionText);
            } else {
              transitionTo(INTERVIEW_STATUS.ERROR);
            }
          }, 1000);
        } else {
          console.log(
            '[useInterviewSession] All questions finished. Transitioning to FINAL_REVIEW'
          );
          transitionTo(INTERVIEW_STATUS.FINAL_REVIEW);
        }
      } catch (e) {
        console.error('[useInterviewSession] confirmAnswerAction CATCH error:', e);
        setAudioError('Failed to save answer. Please try again.');
        transitionTo(INTERVIEW_STATUS.TRANSCRIPT_REVIEW);
      }
    },
    [
      candidateId,
      candidateName,
      currentMatchScore,
      currentQuestionIndex,
      durationSeconds,
      questions,
      speakQuestion,
      sttInterviewId,
      transitionTo,
      transcriptSource,
      unlockAudio,
    ]
  );

  // ── Long Answer Guardrails ──
  useEffect(() => {
    if (status === INTERVIEW_STATUS.RECORDING) {
      if (durationSeconds >= 120) {
        console.warn('[useInterviewSession] Hard stop reached (120s)');
        setTimeout(() => {
          finishAnswerRecording(
            currentQuestionIndex === -1 ? 'Practice' : questions[currentQuestionIndex],
            currentQuestionIndex === -1
          );
        }, 0);
      } else if (durationSeconds >= 90 && !audioError.includes('90 seconds')) {
        setTimeout(() => {
          setAudioError('Wrap up your answer soon (90 seconds reached)');
        }, 0);
      }
    }
  }, [status, durationSeconds, currentQuestionIndex, questions, finishAnswerRecording, audioError]);

  return {
    status,
    setStatus: transitionTo,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    statusMessage,
    audioError,

    // Recording state
    isRecording,
    recordingTime: durationSeconds,
    volumeLevel,
    // LEGACY properties
    liveTranscript: '',
    interimTranscript: '',

    // Review state
    transcript: currentTranscript,
    setCurrentTranscript,
    isDraft,

    // Actions
    speak,
    speakQuestion,
    stopSpeaking,
    unlockAudio,
    startAnswerRecording,
    finishAnswerRecording,
    retryAnswer,
    confirmAnswerAction,
    jumpToQuestion,
  };
}

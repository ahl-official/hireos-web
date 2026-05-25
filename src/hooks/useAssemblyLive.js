import { useState, useRef, useCallback, useEffect } from 'react';
import { getAssemblyAITemporaryToken } from '../services/interviewApi';

/**
 * Hook for real-time AssemblyAI WebSocket streaming.
 * NOTE: AssemblyAI requires raw 16-bit PCM mono audio at a specific sample rate.
 * The current MediaRecorder webm/opus output is NOT natively supported.
 * This hook acts as a POC / Shadow Mode infrastructure.
 */
export function useAssemblyLive() {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState('');

  const socketRef = useRef(null);
  const isConnectingRef = useRef(false);
  const activeSessionIdRef = useRef(null);
  const sessionCounterRef = useRef(0);
  const transcriptPartsRef = useRef([]);

  const cleanup = useCallback((caller = 'unknown') => {
    if (import.meta.env.DEV) {
      console.log(`AssemblyAI Live: cleanup() called by ${caller}`);
    }
    isConnectingRef.current = false;
    activeSessionIdRef.current = null;

    if (socketRef.current) {
      const socket = socketRef.current;
      socketRef.current = null;

      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        try {
          // AssemblyAI graceful close
          socket.send(JSON.stringify({ terminate_session: true }));
          socket.close();
        } catch (e) {
          // Ignore
        }
      }
    }
  }, []);

  const reset = useCallback(() => {
    cleanup('reset');
    setStatus('idle');
    setError(null);
    setTranscript('');
    transcriptPartsRef.current = [];
  }, [cleanup]);

  const connect = useCallback(async () => {
    const sessionId = ++sessionCounterRef.current;

    if (socketRef.current || isConnectingRef.current) {
      if (import.meta.env.DEV) {
        console.log(`AssemblyAI Live [S:${sessionId}]: Already in progress. skipping.`);
      }
      return;
    }

    activeSessionIdRef.current = sessionId;
    isConnectingRef.current = true;
    setStatus('connecting');
    setError(null);

    try {
      if (import.meta.env.DEV) {
        console.log(`AssemblyAI Live [S:${sessionId}]: Fetching token...`);
      }
      const tokenData = await getAssemblyAITemporaryToken();

      if (activeSessionIdRef.current !== sessionId) return;

      const token = tokenData.token;

      // AssemblyAI Real-time URL
      // Using 16000 as default sample rate.
      const url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`;

      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (activeSessionIdRef.current !== sessionId) {
          socket.close();
          return;
        }
        if (import.meta.env.DEV) {
          console.log(`AssemblyAI Live [S:${sessionId}]: Connected.`);
        }
        setStatus('open');
        isConnectingRef.current = false;
      };

      socket.onmessage = (message) => {
        if (activeSessionIdRef.current !== sessionId) return;

        const data = JSON.parse(message.data);

        // AssemblyAI message types: SessionBegins, PartialTranscript, FinalTranscript, Error
        if (data.message_type === 'FinalTranscript') {
          if (data.text) {
            transcriptPartsRef.current.push(data.text);
            const fullTranscript = transcriptPartsRef.current.join(' ');
            setTranscript(fullTranscript);
            if (import.meta.env.DEV) {
              console.log(`AssemblyAI Live [S:${sessionId}] Final:`, data.text);
            }
          }
        } else if (data.message_type === 'SessionBegins') {
          if (import.meta.env.DEV) {
            console.log(
              `AssemblyAI Live [S:${sessionId}]: Session Started. ID: ${data.session_id}`
            );
          }
        } else if (data.message_type === 'Error') {
          console.error(`AssemblyAI Live [S:${sessionId}] Server Error:`, data.error);
          setError(data.error);
        }
      };

      socket.onerror = (err) => {
        if (activeSessionIdRef.current !== sessionId) return;
        if (import.meta.env.DEV) {
          console.error(`AssemblyAI Live [S:${sessionId}] WebSocket Error:`, err);
        }
        setError('WebSocket error');
        setStatus('error');
        isConnectingRef.current = false;
      };

      socket.onclose = (event) => {
        if (activeSessionIdRef.current !== sessionId) return;
        if (import.meta.env.DEV) {
          console.log(`AssemblyAI Live [S:${sessionId}]: Closed (${event.code})`);
        }
        setStatus('closed');
        isConnectingRef.current = false;
      };
    } catch (err) {
      if (activeSessionIdRef.current !== sessionId) return;
      setError(err.message);
      setStatus('error');
      isConnectingRef.current = false;
    }
  }, []);

  const sendAudioChunk = useCallback((chunk) => {
    if (!activeSessionIdRef.current) return;

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      // ASSEMBLYAI WARNING: This chunk is likely WebM/Opus.
      // It will likely cause a "Session Terminated" error on AssemblyAI's side
      // unless converted to PCM.

      // Convert Blob to ArrayBuffer if needed (MediaRecorder usually gives Blob)
      if (chunk instanceof Blob) {
        chunk.arrayBuffer().then((buffer) => {
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            // AssemblyAI expects base64 encoded audio in a JSON message or raw binary?
            // Actually AssemblyAI Realtime expects raw binary data.
            socketRef.current.send(
              JSON.stringify({ audio_data: btoa(String.fromCharCode(...new Uint8Array(buffer))) })
            );
          }
        });
      } else {
        // Assume ArrayBuffer or similar
        socketRef.current.send(
          JSON.stringify({ audio_data: btoa(String.fromCharCode(...new Uint8Array(chunk))) })
        );
      }
    }
  }, []);

  const finish = useCallback(() => {
    return new Promise((resolve) => {
      const fullTranscript = transcriptPartsRef.current.join(' ');
      cleanup('finish');
      resolve({ transcript: fullTranscript });
    });
  }, [cleanup]);

  useEffect(() => {
    return () => cleanup('unmount');
  }, [cleanup]);

  return {
    connect,
    sendAudioChunk,
    finish,
    reset,
    transcript,
    status,
    error,
    isConnected: status === 'open',
  };
}

import axios from 'axios';

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_APP_SCRIPT_URL;

const post = async (payload) => {
  try {
    const response = await axios.post(SCRIPT_URL, payload, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    });
    return response.data;
  } catch (error) {
    console.error('Interview API Error:', error);
    throw error;
  }
};

export const getAssemblyAITemporaryToken = async () => {
  const data = await post({ action: 'getAssemblyAITemporaryToken' });
  if (data.status === 'error') {
    const error = new Error(data.message || 'Failed to get AssemblyAI temporary token.');
    error.backendResponse = data;
    throw error;
  }
  return data;
};

export const startInterviewSession = async (payload) => {
  const data = await post({ action: 'startInterviewSession', ...payload });
  if (data.status === 'error') {
    const error = new Error(data.message || 'Failed to initialize secure interview session.');
    error.backendResponse = data;
    throw error;
  }
  return data;
};

export const processAnswerAudio = async (payload) => {
  const data = await post({ action: 'processAnswerAudio', ...payload });
  if (data.status === 'error') {
    const error = new Error(data.message || 'Failed to process audio.');
    error.backendResponse = data;
    throw error;
  }
  return data;
};

export const saveConfirmedAnswer = async (payload) => {
  const data = await post({ action: 'saveConfirmedAnswer', ...payload });
  if (data.status === 'error') {
    const error = new Error(data.message || 'Failed to save answer.');
    error.backendResponse = data;
    throw error;
  }
  return data;
};

export const saveInterviewAuditEvent = async (payload) => {
  // Fire and forget, don't throw on error to prevent blocking UX
  post({ action: 'saveInterviewAuditEvent', ...payload }).catch(() => {});
};

export const submitInterview = async (payload) => {
  const data = await post({ action: 'submitInterview', ...payload });
  if (data.status === 'error') {
    const error = new Error(data.message || 'Failed to submit interview.');
    error.backendResponse = data;
    throw error;
  }
  return data;
};

export const setupNewHireOSInterviewSystem = async () => {
  const data = await post({ action: 'setupNewHireOSInterviewSystem' });
  if (data.status === 'error') throw new Error(data.message);
  return data;
};

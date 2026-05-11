import axios from 'axios';

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_APP_SCRIPT_URL;

const post = (payload) => axios.post(SCRIPT_URL, payload, {
  headers: { 'Content-Type': 'text/plain;charset=utf-8' }
});

// ==========================================
// AI ACTIONS (via Apps Script proxy)
// ==========================================
export const generateQuestions = async (cvText, position = '', timeLimit = 15) => {
  try {
    const res = await post({ action: 'generateQuestions', cvText, position, timeLimit });
    if (res.data.status === 'error') throw new Error(res.data.message);
    return res.data.data;
  } catch (error) {
    console.error('Error generating questions:', error);
    throw error;
  }
};

export const gradeTest = async (questions, correctAnswers, topics, candidateAnswers, questionTypes = []) => {
  try {
    const res = await post({ 
      action: 'gradeTest', 
      questions, 
      correctAnswers, 
      topics, 
      candidateAnswers,
      questionTypes 
    });
    if (res.data.status === 'error') throw new Error(res.data.message);
    return res.data.data;
  } catch (error) {
    console.error('Error grading test:', error);
    throw error;
  }
};

// ==========================================
// DATABASE ACTIONS
// ==========================================
export const addCandidate = async (candidateData) => {
  try {
    const res = await post({ ...candidateData, action: 'addCandidate' });
    return res.data;
  } catch (error) {
    console.error('Error adding candidate:', error);
    throw error;
  }
};

export const getTest = async (id) => {
  try {
    const res = await post({ action: 'getTest', id });
    return res.data;
  } catch (error) {
    console.error('Error fetching test:', error);
    throw error;
  }
};

export const submitTest = async (submitData) => {
  try {
    const res = await post({ ...submitData, action: 'submitTest' });
    return res.data;
  } catch (error) {
    console.error('Error submitting test:', error);
    throw error;
  }
};

export const getAllCandidates = async () => {
  try {
    const res = await post({ action: 'getAllCandidates' });
    return res.data.data || [];
  } catch (error) {
    console.error('Error fetching candidates:', error);
    throw error;
  }
};

export const getCandidateDetails = async (id) => {
  try {
    const res = await post({ action: 'getCandidateDetails', id });
    return res.data.candidate || null;
  } catch (error) {
    console.error('Error fetching candidate details:', error);
    throw error;
  }
};

export const regenerateReport = async (id) => {
  try {
    const res = await post({ action: 'regenerateReport', id });
    if (res.data.status === 'error') throw new Error(res.data.message);
    return res.data.data;
  } catch (error) {
    console.error('Error regenerating report:', error);
    throw error;
  }
};

export const generateDetailedSummary = async (questions, candidateAnswers, perQuestionScores, questionTypes, topics) => {
  try {
    const res = await post({ 
      action: 'generateDetailedSummary',
      questions,
      candidateAnswers,
      perQuestionScores,
      questionTypes,
      topics
    });
    if (res.data.status === 'error') throw new Error(res.data.message);
    return res.data.data;
  } catch (error) {
    console.error('Error generating detailed summary:', error);
    throw error;
  }
};

export const processAudioReview = async (payload) => {
  try {
    const res = await post({ action: 'processAudioReview', ...payload });
    if (res.data.status === 'error') throw new Error(res.data.message);
    return res.data.data;
  } catch (error) {
    console.error('Error processing audio review:', error);
    throw error;
  }
};

export const evaluateAudioTurn = async (audioBase64, format = 'webm') => {
  try {
    const res = await post({ action: 'evaluateAudioTurn', audioBase64, format });
    if (res.data.status === 'error') throw new Error(res.data.message);
    return res.data.text;
  } catch (error) {
    console.error('Error evaluating audio turn:', error);
    throw error;
  }
};

export const getAllAudioReviews = async () => {
  try {
    const res = await post({ action: 'getAllAudioReviews' });
    if (res.data.status === 'error') throw new Error(res.data.message);
    return res.data.data || [];
  } catch (error) {
    console.error('Error fetching audio reviews:', error);
    throw error;
  }
};

export const getAudioReviewDetails = async (id) => {
  try {
    const res = await post({ action: 'getAudioReviewDetails', id });
    if (res.data.status === 'error') throw new Error(res.data.message);
    return res.data.data || null;
  } catch (error) {
    console.error('Error fetching audio review details:', error);
    throw error;
  }
};

export const regenerateAudioReview = async (id) => {
  try {
    const res = await post({ action: 'regenerateAudioReview', id });
    if (res.data.status === 'error') throw new Error(res.data.message);
    return res.data.data;
  } catch (error) {
    console.error('Error regenerating audio review:', error);
    throw error;
  }
};

export const deleteCandidate = async (id) => {
  try {
    const res = await post({ action: 'deleteCandidate', id });
    if (res.data.status === 'error') throw new Error(res.data.message);
    return res.data;
  } catch (error) {
    console.error('Error deleting candidate:', error);
    throw error;
  }
};

export const deleteCandidates = async (ids) => {
  try {
    const res = await post({ action: 'deleteCandidates', ids });
    if (res.data.status === 'error') throw new Error(res.data.message);
    return res.data;
  } catch (error) {
    console.error('Error deleting candidates:', error);
    throw error;
  }
};

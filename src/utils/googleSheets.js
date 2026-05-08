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

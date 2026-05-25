export const tutorialSteps = [
  {
    id: 'meet_alisa',
    title: 'Meet Alisa',
    description:
      'Alisa is your AI interviewer. She will guide you through the interview one question at a time.',
    alisaScript:
      'Hi, I am Alisa, your AI interviewer. I will ask you questions one by one. Please listen carefully and answer naturally.',
    highlightTarget: null,
  },
  {
    id: 'listen_first',
    title: 'Listen To The Question',
    description:
      'When Alisa is speaking, please do not answer yet. Wait until you see "You can answer now."',
    alisaScript:
      'When I am speaking, please listen to the full question. Start answering only when the screen says, you can answer now.',
    highlightTarget: 'question-card',
  },
  {
    id: 'start_answer',
    title: 'Start Your Answer',
    description: 'Click the Start Answer button when you are ready to speak.',
    alisaScript: 'When you are ready, click the Start Answer button and speak clearly.',
    highlightTarget: 'start-answer-button',
  },
  {
    id: 'finish_answer',
    title: 'Finish Your Answer',
    description: 'After completing your answer, click Finish Answer.',
    alisaScript:
      'When your answer is complete, click the Finish Answer button. This will stop recording and save your answer for transcription.',
    highlightTarget: 'finish-answer-button',
  },
  {
    id: 'transcript_review',
    title: 'Check Your Transcript',
    description:
      'After recording, we will show what we heard. Please check your transcript before confirming.',
    alisaScript:
      'After you finish speaking, I will show you the transcript. Please check if it matches what you said.',
    highlightTarget: 'transcript-box',
  },
  {
    id: 'confirm_or_retry',
    title: 'Confirm Or Try Again',
    description:
      'If the transcript is correct, click Confirm Answer. If it is wrong, click Record Again.',
    alisaScript:
      'If the transcript is correct, click Confirm Answer. If something is wrong, click Record Again and answer once more.',
    highlightTarget: 'confirm-answer-button',
  },
  {
    id: 'stay_on_page',
    title: 'Stay On This Page',
    description: 'Do not switch tabs, refresh, copy, paste, or leave the interview page.',
    alisaScript:
      'Please stay on this interview page until the interview is complete. If you switch tabs, this activity may be recorded for HR.',
    highlightTarget: 'warning-banner',
  },
  {
    id: 'practice_first',
    title: 'Practice First',
    description: 'Before the real interview, you will try one practice question.',
    alisaScript:
      'Before we start the real interview, you will get one practice question. This is only for practice and will not affect your score.',
    highlightTarget: null,
  },
  {
    id: 'ready',
    title: 'You Are Ready',
    description: 'You have completed the tutorial. Now you can start the practice question.',
    alisaScript:
      'You are ready now. Let us start with a practice question before the real interview begins.',
    highlightTarget: null,
  },
];

# HireOS Local Google Sheets Schema Documentation

## Overview
This document describes the Google Sheets structure for the local HireOS AI Interview Platform. The backend is designed to automatically initialize and maintain this schema using header-based mapping.

## Setup Instructions
1.  **Open Google Sheets**: Create a new Google Sheet.
2.  **Bind Apps Script**: Open the Apps Script editor from the sheet (Extensions > Apps Script) and paste the `Code.gs` content.
3.  **Configure ID**: 
    - In the Apps Script editor, go to **Project Settings** > **Script Properties**.
    - Add a property with Key: `HIREOS_LOCAL_SPREADSHEET_ID` and Value: `[YOUR_SHEET_ID]`.
    - Alternatively, if the script is bound to the sheet, it will auto-detect it.
4.  **Run Setup**: Run the function `setupHireOSLocalSheets()` (found in `ConfigAndSchema.gs`) manually in the Apps Script editor. This will create all required tabs and headers.

## Sheet Tabs and Columns

### 1. Candidates (Legacy Compatibility)
*   **Purpose**: Stores candidate data for the main technical assessment flow.
*   **Columns**: `ID`, `Name`, `Email`, `WhatsApp`, `Questions`, `Correct Answers`, `Topics`, `Difficulty`, `Candidate Answers`, `Per Question Scores`, `Score`, `Tab Switches`, `Status`, `Timestamp`, `Position`, `Time Limit`, `Submitted At`, `Question Types`, `Detailed Summary`.

### 2. AudioReviews
*   **Purpose**: Stores data for the HR Audio Review tool.
*   **Columns**: `ID`, `Candidate Name`, `Role`, `HR Notes`, `Audio File Name`, `Audio Mime Type`, `Audio Drive File ID`, `Audio Drive URL`, `Transcript`, `Transcript Model`, `Report JSON`, `Recommendation`, `Final Verdict`, `PDF Drive File ID`, `PDF Drive URL`, `Status`, `Timestamp`, `Updated At`, `Error Message`.

### 3. Interview Results (New STT System)
*   **Purpose**: High-level results for the modern AI interview flow.
*   **Columns**: `Interview ID`, `Candidate ID`, `Candidate Name`, `Candidate Email`, `Candidate Phone`, `Role Applied`, `Interview Start Time`, `Interview End Time`, `Interview Duration`, `Final Score`, `Status`, `Audio Folder Link`, `Final Transcript Link`, `Total Questions`, `Answered Questions`, `Total Retry Count`, `Tab Switch Count`, `Audio Quality Status`, `STT Provider`, `HR Review Required`, `AI Summary`, `Created At`, `Updated At`.

### 4. Interview Answers
*   **Purpose**: Granular question-by-question data and transcripts.
*   **Columns**: `Interview ID`, `Candidate ID`, `Question No`, `Question ID`, `Question Type`, `Question Text`, `Browser Preview Transcript`, `Final Transcript`, `Cleaned Transcript`, `Candidate Confirmed`, `Audio File Name`, `Audio File Link`, `Google Drive File ID`, `Audio Duration Seconds`, `Word Count`, `Retry Count`, `STT Confidence`, `Language Detected`, `Answer Status`, `AI Score`, `AI Feedback`, `Created At`, `Updated At`.

### 5. Interview Audit Log
*   **Purpose**: Anti-cheating and system event tracking.
*   **Columns**: `Interview ID`, `Candidate ID`, `Event Type`, `Event Time`, `Question No`, `Details`, `Tab Switch Count`, `Mic Permission Status`, `Browser Name`, `Device Info`, `User Agent`.

### 6. System Logs
*   **Purpose**: Internal backend debugging.
*   **Columns**: `Log Time`, `Log Type`, `Function Name`, `Interview ID`, `Candidate ID`, `Message`, `Details`.

### 7. Interview Config
*   **Purpose**: Key-value pairs for system configuration.
*   **Columns**: `Key`, `Value`, `Description`, `Updated At`.

## Developer Notes
- **Header-based Mapping**: Always use `appendRowByHeaders_` or `updateRowByHeaders_` to interact with sheets. This prevents breakage if columns are reordered.
- **Do Not Rename**: Do not rename headers in the Google Sheet manually. If renaming is required, update `HIREOS_SHEET_SCHEMA` in `Code.gs` first.
- **Safety**: The setup function will never delete or clear your data. It only adds missing tabs or missing headers.

# Voice Interview Performance Testing Plan

- [x] Navigate to http://localhost:5173/ and log in using 'Developer Sandbox Login'.
- [x] Configure and start a Voice Interview.
- [x] Allow the first question to load.
- [x] Provide answer (typed response).
- [ ] Submit the answer and verify the next question generates.
- [ ] Verify next question generates and starts speaking in under 2 seconds.
- [ ] Monitor console logs for warnings and errors.
- [ ] Report latency observations.

## Observations
1. Developer Sandbox Login works, providing 99 credits after initial runs.
2. Interview setup works and starting a new interview successfully transitions to the interview screen.
3. The interview UI displays "Question 1 of 5", but the interview finishes and redirects to the dashboard after Question 2, meaning it is a 2-question interview in this mode.
4. When we type an answer and click "Submit Answer", the application transitions to `State: PROCESSING`.
5. However, immediately after processing the first question, the second question is automatically submitted due to voice recognition ending automatically, and the interview ends.


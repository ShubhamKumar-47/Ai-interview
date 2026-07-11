# Verification Plan for Automated Timeout Progression

We will perform the following steps to verify the automated timeout progression logic:
1. Verify the current login status (we seem to be logged in and at `/interview`).
2. If needed, go to `http://localhost:5173/` and login/bypass.
3. Configure a Voice Interview:
   - Enter Role (e.g. "Software Engineer")
   - Enter Experience (e.g. "3 years")
   - Select "Technical Interview" (already selected by default)
   - Interaction Medium: select "Smart Voice Interaction" (already selected by default)
   - Click "Start Interview"
4. Wait for the interview to load.
5. Identify the timer on the page.
6. Wait for the timer to reach 0.
7. Observe behavior:
   - Does speech recognition stop?
   - Does it display the custom loading overlay ("Time's up!", "Submitting your answer...", etc.)?
   - Does it submit "No response" if transcript is empty?
   - Does it transition automatically to the next question?
   - Does the next question load and start speaking?
8. Repeat/observe for Voice, Chat, and Coding modes if possible or requested.

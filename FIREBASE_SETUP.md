# Homeschoolable Family Planner — Firebase setup

The planner continues working locally until you configure Firebase. No Firebase service account or private key belongs in this public repository.

## Firebase Console steps
1. Create a Firebase project, add a Web app, and copy its **web config** into `scripts/firebase-config.js`. The web config is designed to be public.
2. Authentication > Sign-in method: enable **Email/Password**. Authentication > Settings > Authorized domains: ensure `homeschoolable.ca` is listed.
3. Firestore Database: create database in **production mode** (choose a region thoughtfully).
4. Firestore Database > Rules: paste `firestore.rules` and **Publish**.
5. Authentication > Users: add an email/password user for each family member who needs a login (or start with one adult).
6. Copy each new user's **UID**. Firestore Database > Data: create document `families/home/members/UID` for each UID, with field `role` (string) set to `adult` or `child`. Replace UID with the actual Authentication UID. Membership documents are administered in Firebase Console, not by the browser.
7. Visit `https://homeschoolable.ca/family-daily-planner.html` and sign in. On the first device, click **Upload this day** to put its schedule in Firestore. On another device, sign in with a member account; changes will appear in real time.

## Important
- Back up schedules using **Export backup** before first synchronization.
- The first successful cloud load becomes authoritative for the selected day. **Upload this day** replaces the selected day's cloud data; use it only to intentionally initialize or replace that day.
- Existing local-only days are not automatically uploaded. Initialize days as needed.
- Every member can currently edit every schedule; a future role-based permission model can restrict this.
- Firebase's free tier has usage limits. Review billing before enabling any paid plan.
- Firestore access is enforced by rules; hiding UI controls is not a security boundary.
- GitHub Pages serves static files. Do not store service account JSON, private keys, or passwords in the repository.

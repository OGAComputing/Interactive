/**
 * classroom.js — Shared Google Classroom integration for all activity pages.
 *
 * Usage in any activity HTML file (all are 2 levels deep: Y*/Topic/file.html):
 *   <script src="../../classroom.js"></script>
 *
 * When the page URL contains ?courseId=X&courseWorkId=Y (set by index.html when
 * a teacher assigns the activity), this script:
 *   1. Injects a sticky login banner at the top of the page
 *   2. Loads the Google Sign-In library and initialises the OAuth token client
 *   3. Exposes window.Classroom.verifyAuth() — call at the start of Check Answer
 *      handlers to block unauthenticated students when in a Classroom context
 *   4. Exposes window.Classroom.submitGrade(percent, activityName) — call when
 *      an activity is complete to post the draft grade and a private comment
 *
 * If no Classroom URL params are present, nothing is injected and all API calls
 * are no-ops, so activities work identically for students not using Classroom.
 */
(function () {
  'use strict';

  const CLIENT_ID = '379663437881-iukh6qnkq8jmqtqko3qog0n6ohuhemmq.apps.googleusercontent.com';
  const SCOPE = 'https://www.googleapis.com/auth/classroom.coursework.students';

  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get('courseId');
  const courseWorkId = urlParams.get('courseWorkId');
  const isClassroomContext = !!(courseId && courseWorkId);

  let tokenClient = null;
  let accessToken = null;

  // ── Login banner ────────────────────────────────────────────────────────────

  function injectBanner() {
    const style = document.createElement('style');
    style.textContent = `
      #classroom-banner {
        position: sticky; top: 0; z-index: 9999;
        background: #111827; color: #d1d5db;
        padding: 10px 20px;
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        font-family: 'Segoe UI', system-ui, sans-serif; font-size: 0.85rem;
        border-bottom: 2px solid #374151;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      }
      #classroom-banner-msg { display: flex; align-items: center; gap: 10px; }
      #classroom-dot {
        width: 9px; height: 9px; border-radius: 50%;
        background: #ef4444; flex-shrink: 0;
        transition: background 0.3s, box-shadow 0.3s;
      }
      #classroom-dot.online { background: #10b981; box-shadow: 0 0 8px #10b981; }
      #classroom-signin-btn {
        background: #fff; color: #111827; border: none;
        padding: 6px 14px; border-radius: 4px;
        font-weight: 700; font-size: 0.82rem; cursor: pointer;
        white-space: nowrap; flex-shrink: 0;
        animation: classroom-pulse-btn 1.5s infinite;
      }
      #classroom-signin-btn:hover { background: #f3f4f6; }
      #classroom-signin-btn.hidden { display: none; }
      @keyframes classroom-pulse-btn {
        0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
        50%      { box-shadow: 0 0 0 5px rgba(245,158,11,0.45); }
      }
      #classroom-toast {
        position: fixed; bottom: 24px; right: 24px; z-index: 99999;
        background: #10b981; color: #fff;
        padding: 12px 20px; border-radius: 8px;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 0.9rem; font-weight: 600;
        box-shadow: 0 4px 16px rgba(0,0,0,0.35);
        transform: translateY(80px); opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
        pointer-events: none;
      }
      #classroom-toast.show { transform: translateY(0); opacity: 1; }
    `;
    document.head.appendChild(style);

    const banner = document.createElement('div');
    banner.id = 'classroom-banner';
    banner.innerHTML = `
      <div id="classroom-banner-msg">
        <span id="classroom-dot"></span>
        <span id="classroom-text">⚠️ This activity is linked to Google Classroom — sign in to record your results.</span>
      </div>
      <button id="classroom-signin-btn" onclick="window._classroomSignIn()">Sign in with Google</button>
    `;

    // Insert as first child of body so it appears above all content
    if (document.body.firstChild) {
      document.body.insertBefore(banner, document.body.firstChild);
    } else {
      document.body.appendChild(banner);
    }

    // Toast element (hidden until needed)
    const toast = document.createElement('div');
    toast.id = 'classroom-toast';
    document.body.appendChild(toast);
  }

  function setBannerConnected() {
    const dot = document.getElementById('classroom-dot');
    const text = document.getElementById('classroom-text');
    const btn = document.getElementById('classroom-signin-btn');
    if (dot) dot.classList.add('online');
    if (text) text.textContent = '✅ Connected to Google Classroom — your results will be recorded automatically.';
    if (btn) btn.classList.add('hidden');
  }

  function showClassroomToast(msg) {
    const toast = document.getElementById('classroom-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // ── OAuth ───────────────────────────────────────────────────────────────────

  function initTokenClient() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (tokenResponse) => {
        if (tokenResponse.error !== undefined) {
          console.error('Classroom OAuth error:', tokenResponse);
          return;
        }
        accessToken = tokenResponse.access_token;
        setBannerConnected();
      },
    });
  }

  // Called by the dynamically-loaded GSI script's onload
  window.initClassroomTokenClient = function () {
    initTokenClient();
  };

  // Called by the Sign in button
  window._classroomSignIn = function () {
    if (tokenClient) tokenClient.requestAccessToken();
  };

  // ── Public API ──────────────────────────────────────────────────────────────

  window.Classroom = {
    /** True when the page URL contains courseId + courseWorkId params. */
    get isClassroomContext() { return isClassroomContext; },

    /** True once the student has authenticated with Google. */
    get isAuthenticated() { return !!accessToken; },

    /**
     * Call at the start of every Check Answer handler.
     * If the activity was opened from Classroom but the student hasn't signed in,
     * alerts them and returns false so the handler can abort.
     * Returns true in all other cases (not a Classroom context, or already signed in).
     */
    verifyAuth() {
      if (isClassroomContext && !accessToken) {
        alert("This assignment is linked to Google Classroom.\nPlease click 'Sign in with Google' at the top of the page to record your results.");
        return false;
      }
      return true;
    },

    /**
     * Submit a draft grade and private comment to Classroom.
     * Safe to call unconditionally — silently does nothing when not in a
     * Classroom context or when the student hasn't authenticated.
     *
     * @param {number} gradePercent  0–100
     * @param {string} activityName  Used in the private comment text
     */
    async submitGrade(gradePercent, activityName) {
      if (!accessToken || !isClassroomContext) return;
      try {
        const base = `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`;
        const listRes = await fetch(`${base}?userId=me`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await listRes.json();
        if (!data.studentSubmissions || data.studentSubmissions.length === 0) return;
        const submissionId = data.studentSubmissions[0].id;

        await fetch(`${base}/${submissionId}?updateMask=draftGrade`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftGrade: gradePercent })
        });

        await fetch(`${base}/${submissionId}/comments`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `${activityName} completed with ${gradePercent}% accuracy.` })
        });

        showClassroomToast('Classroom Updated! ✅');
        console.log(`Classroom grade synced: ${gradePercent}% for "${activityName}"`);
      } catch (err) {
        console.error('Classroom sync failed:', err);
      }
    }
  };

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  function bootstrap() {
    if (!isClassroomContext) return;

    injectBanner();

    // Dynamically load the Google Sign-In library
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => window.initClassroomTokenClient();
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

}());

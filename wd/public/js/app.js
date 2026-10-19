// ==========================================
// Student Management System - Frontend App
// Course: Web Designing (WD) - Viva Project
// Technology: Vanilla JavaScript (ES6+), HTML5, CSS3
// ==========================================

/**
 * ARCHITECTURE OVERVIEW:
 * ----------------------
 * This Single Page Application (SPA) manages authentication, student registry,
 * departmental analytics, and 5-subject semestral grade sheets.
 * It interfaces with an Express/Node.js REST API with session cookies.
 *
 * Section Breakdown:
 *  1. State & Utilities (Central state, Fetch wrapper, Toast & Loading handlers)
 *  2. Authentication (Login, Logout, Session verification, Role switching)
 *  3. Navigation & Router (SPA View switching, Sidebar collapse on mobile)
 *  4. Dashboard (Institutional statistics, KPI calculation, Department distribution)
 *  5. Students Management (CRUD operations, Table rendering, Live search & filters)
 *  6. Marks Management (5-Subject grading, Live total/percentage/grade preview)
 *  7. Initialization (DOM Event bindings, Session bootstrap)
 */

'use strict';

// ==========================================================================
// SECTION 1: STATE & UTILITIES
// ==========================================================================

/**
 * Global Application State
 */
const AppState = {
  currentUser: null,       // Authenticated user object: { id, username, role, student_id }
  currentView: 'dashboard',// Active view identifier ('dashboard', 'students', 'student-form', 'marks', 'profile')
  studentsList: [],        // Cached list of student records
  marksList: [],           // Cached list of marks records
  editingStudentId: null,  // ID of student currently being edited (null for creation)
  editingMarksId: null,    // ID of mark currently being edited (null for creation)
  searchDebounceTimer: null// Timer handle for live filter debouncing
};

/**
 * Reusable API Request Wrapper
 * Handles JSON serialization, HTTP headers, session credentials,
 * automatic 401 unauthorized handling, and unified error parsing.
 *
 * @param {string} url - API Endpoint relative or absolute URL
 * @param {object} options - Fetch configuration options (method, headers, body)
 * @returns {Promise<any>} - Resolved JSON response data
 */

async function apiRequest(url, options = {}) {
  const defaultHeaders = {
    Accept: 'application/json'
  };

  if (options.body && typeof options.body === 'string') {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  };

  try {
    const response = await fetch(url, config);

    let data = null;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => '');
      data = { message: text };
    }

    if (response.status === 401) {
      // Verify the session before deciding to log out.
      let sessionValid = false;

      try {
        const sessionResponse = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: { Accept: 'application/json' }
        });

        sessionValid = sessionResponse.ok;
      } catch (sessionError) {
        console.warn('Could not verify session:', sessionError.message);
      }

      if (!sessionValid) {
        AppState.currentUser = null;
        showLogin();
        showNotification(
          'Your session has expired. Please sign in again.',
          'warning'
        );
      }

      const errorMessage =
        (data && (data.message || data.error)) ||
        `Request failed with status ${response.status}`;

      throw new Error(errorMessage);
    }

    if (!response.ok) {
      const errorMessage =
        (data && (data.message || data.error)) ||
        `Server returned status ${response.status}`;

      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.warn(`[API Error: ${options.method || 'GET'} ${url}]`, error.message);
    throw error;
  }
}


/**
 * Toast Notification System
 * Displays temporary animated notifications in the top-right corner.
 *
 * @param {string} message - Notification text
 * @param {'success'|'error'|'warning'|'info'} type - Semantic style category
 * @param {number} duration - Auto-dismiss timeout in milliseconds (default: 4000ms)
 */
function showNotification(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Select appropriate SVG icon for category
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
    </svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>`;
  } else if (type === 'warning') {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
    </svg>`;
  } else {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>`;
  }

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-message">${escapeHtml(message)}</div>
    <button type="button" class="toast-close" aria-label="Dismiss">&times;</button>
  `;

  // Attach close button click handler
  const closeBtn = toast.querySelector('.toast-close');
  const dismiss = () => {
    toast.classList.add('toast-out');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  };

  closeBtn.addEventListener('click', dismiss);
  container.appendChild(toast);

  // Auto-dismiss timer
  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
}

/**
 * Display Global Loading Spinner Overlay
 * @param {string} msg - Optional custom message
 */
function showLoading(msg = 'Processing, please wait...') {
  const overlay = document.getElementById('loading-overlay');
  const messageEl = document.getElementById('loading-message');
  if (messageEl) messageEl.textContent = msg;
  if (overlay) overlay.classList.remove('hidden');
}

/**
 * Hide Global Loading Spinner Overlay
 */
function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.add('hidden');
}

/**
 * Confirmation Modal Helper
 * Opens modal dialog and returns a Promise resolved with true (confirmed) or false (cancelled).
 *
 * @param {string} title - Modal heading
 * @param {string} message - Explanatory message
 * @param {string} confirmText - Button label
 * @returns {Promise<boolean>}
 */
function showConfirmModal(title = 'Confirm Action', message = 'Are you sure?', confirmText = 'Confirm Delete') {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const closeBtn = document.getElementById('modal-close-btn');

    if (!modal) {
      resolve(confirm(message));
      return;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;
    confirmBtn.textContent = confirmText;

    modal.classList.remove('hidden');

    const cleanUp = () => {
      modal.classList.add('hidden');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
    };

    const onConfirm = () => {
      cleanUp();
      resolve(true);
    };

    const onCancel = () => {
      cleanUp();
      resolve(false);
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
  });
}

/**
 * HTML Escaping Utility to prevent XSS in dynamic table renderings
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Academic Grade Calculator
 * Standard 5-subject grading criteria out of 500
 */
function calculateGrade(percentage) {
  const p = parseFloat(percentage);
  if (isNaN(p)) return { grade: 'N/A', badgeClass: 'badge-secondary' };

  if (p >= 90) return { grade: 'A+', badgeClass: 'badge-success' };
  if (p >= 80) return { grade: 'A', badgeClass: 'badge-success' };
  if (p >= 70) return { grade: 'B', badgeClass: 'badge-primary' };
  if (p >= 60) return { grade: 'C', badgeClass: 'badge-info' };
  if (p >= 50) return { grade: 'D', badgeClass: 'badge-warning' };
  if (p >= 40) return { grade: 'E', badgeClass: 'badge-warning' };
  return { grade: 'F (Fail)', badgeClass: 'badge-danger' };
}


// ==========================================================================
// SECTION 2: AUTHENTICATION
// ==========================================================================

/**
 * Submit handler for login form
 */
async function handleLogin(e) {
  if (e) e.preventDefault();

  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const submitBtn = document.getElementById('login-submit-btn');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!username || !password) {
    showNotification('Please fill in both username and password.', 'warning');
    return;
  }

  showLoading('Verifying credentials...');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    // Extract user profile from server response
    const user = data.user || data;
    AppState.currentUser = user;

    showNotification(`Welcome back, ${user.username}!`, 'success');

    // Switch view to Main App Dashboard
    showApp();
    navigateTo('dashboard');

    // Clear password input for security
    if (passwordInput) passwordInput.value = '';
  } catch (error) {
    showNotification(error.message || 'Login failed. Please verify credentials.', 'error');
  } finally {
    hideLoading();
    if (submitBtn) submitBtn.disabled = false;
  }
}


/**
 * Restore the existing server-side session on page load.
 * Keep the current SPA view when possible.
 */
async function checkAuth() {
  showLoading('Restoring your session...');

  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json'
      }
    });

    if (response.status === 401) {
      // No valid session exists; login is genuinely required.
      AppState.currentUser = null;
      showLogin();
      return;
    }

    if (!response.ok) {
      // A server error is not proof that the user is logged out.
      showNotification(
        'Unable to verify your session. Please try refreshing again.',
        'warning'
      );
      return;
    }

    const data = await response.json();
    const user = data.user || data;

    if (!user || !user.id || !user.role) {
      AppState.currentUser = null;
      showLogin();
      return;
    }

    AppState.currentUser = user;
    showApp();

    // Restore the last view for this page session.
    const savedView = sessionStorage.getItem('edumanage_current_view');
    const allowedViews = ['dashboard', 'students', 'marks', 'profile'];
    const isAdmin = user.role.toLowerCase() === 'admin';

    let viewToRestore = allowedViews.includes(savedView)
      ? savedView
      : 'dashboard';

    // Students must not enter the administrator-only directory.
    if (!isAdmin && viewToRestore === 'students') {
      viewToRestore = 'dashboard';
    }

    navigateTo(viewToRestore);
  } catch (error) {
    // A network/server failure must not automatically destroy the UI state.
    console.error('Session restoration failed:', error);
    showNotification(
      'Could not verify your session. Check that the server is running and retry.',
      'warning'
    );
  } finally {
    hideLoading();
  }
}


/**
 * Logout handler - Terminate server session
 */
async function handleLogout() {
  const confirmed = await showConfirmModal(
    'Confirm Sign Out',
    'Are you sure you want to log out of your session?',
    'Yes, Sign Out'
  );
  if (!confirmed) return;

  showLoading('Signing out...');
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    showNotification('You have logged out successfully.', 'info');
  } catch (error) {
    console.warn('Logout notification error:', error.message);
  } finally {
    AppState.currentUser = null;
    AppState.studentsList = [];
    AppState.marksList = [];
    hideLoading();
    showLogin();
  }
}

/**
 * Toggle UI to show Login view
 */
function showLogin() {
  const loginSection = document.getElementById('login-section');
  const appSection = document.getElementById('app-section');

  if (loginSection) loginSection.classList.remove('hidden');
  if (appSection) appSection.classList.add('hidden');

  // Reset title
  document.title = 'EduManage | Sign In';
}

/**
 * Toggle UI to show Main Application
 */
function showApp() {
  const loginSection = document.getElementById('login-section');
  const appSection = document.getElementById('app-section');

  if (loginSection) loginSection.classList.add('hidden');
  if (appSection) appSection.classList.remove('hidden');

  // Update User Profile indicators in UI
  updateUserInfoUI();
  updateSidebarForRole();
}

/**
 * Sync UI elements with Current User Profile
 */
function updateUserInfoUI() {
  const user = AppState.currentUser;
  if (!user) return;

  const displayName = user.username || 'User';
  const role = (user.role || 'STUDENT').toUpperCase();
  const avatarChar = displayName.charAt(0).toUpperCase();

  // Topbar
  const topbarUser = document.getElementById('topbar-user-name');
  const topbarBadge = document.getElementById('topbar-role-badge');
  if (topbarUser) topbarUser.textContent = displayName;
  if (topbarBadge) {
    topbarBadge.textContent = role;
    topbarBadge.className = `badge ${role === 'ADMIN' ? 'badge-primary' : 'badge-dept'}`;
  }

  // Sidebar
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  const sidebarUsername = document.getElementById('sidebar-username');
  const sidebarRole = document.getElementById('sidebar-role');
  if (sidebarAvatar) sidebarAvatar.textContent = avatarChar;
  if (sidebarUsername) sidebarUsername.textContent = displayName;
  if (sidebarRole) sidebarRole.textContent = role;

  // Profile View
  const profileAvatar = document.getElementById('profile-avatar');
  const profileUsername = document.getElementById('profile-username');
  const profileRoleBadge = document.getElementById('profile-role-badge');
  const profileUserId = document.getElementById('profile-user-id');
  const profileRoleDesc = document.getElementById('profile-role-desc');

  if (profileAvatar) profileAvatar.textContent = avatarChar;
  if (profileUsername) profileUsername.textContent = displayName;
  if (profileRoleBadge) {
    profileRoleBadge.textContent = role;
    profileRoleBadge.className = `badge ${role === 'ADMIN' ? 'badge-primary' : 'badge-dept'}`;
  }
  if (profileUserId) profileUserId.textContent = user.id || 'N/A';
  if (profileRoleDesc) {
    profileRoleDesc.textContent = role === 'ADMIN'
      ? 'System Administrator with full permissions to enroll students, edit profiles, input marks, and run institutional reports.'
      : 'Student Account with access to personal academic performance, published scorecards, and directory view.';
  }
}

/**
 * Show / Hide elements based on logged-in user role
 */
function updateSidebarForRole() {
  const user = AppState.currentUser;
  const isAdmin = user && (user.role || '').toLowerCase() === 'admin';

  // Toggle all elements marked with class '.admin-only'
  const adminElements = document.querySelectorAll('.admin-only');
  adminElements.forEach(el => {
    if (isAdmin) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}


// ==========================================================================
// SECTION 3: NAVIGATION & ROUTER
// ==========================================================================

/**
 * Navigate to a specific view panel
 * @param {'dashboard'|'students'|'student-form'|'marks'|'profile'} viewName
 */
function navigateTo(viewName) {
  // If user tries to access admin-only view without admin privileges, bounce to dashboard
  const user = AppState.currentUser;
  const isAdmin = user && (user.role || '').toLowerCase() === 'admin';
  if (viewName === 'student-form' && !isAdmin) {
    showNotification('Access denied: Administrator permissions required.', 'error');
    viewName = 'dashboard';
  }

  AppState.currentView = viewName;
  if (['dashboard', 'students', 'marks', 'profile'].includes(viewName)) {
  sessionStorage.setItem('edumanage_current_view', viewName);
}

  // Update breadcrumb text
  const breadcrumb = document.getElementById('breadcrumb-current-view');
  if (breadcrumb) {
    const titles = {
      'dashboard': 'Dashboard Overview',
      'students': 'Students Directory',
      'student-form': AppState.editingStudentId ? 'Edit Student' : 'Add New Student',
      'marks': 'Academic Marks Management',
      'profile': 'User Profile'
    };
    breadcrumb.textContent = titles[viewName] || 'Dashboard';
  }

  // Update Page Title
  document.title = `EduManage | ${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`;

  // Update Active Link in Sidebar
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Hide all view panels and show requested one
  const viewPanels = document.querySelectorAll('.view-panel');
  viewPanels.forEach(panel => {
    if (panel.id === `${viewName}-view`) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });

  // Close mobile sidebar if open
  closeMobileSidebar();

  // Trigger relevant view loader
  switch (viewName) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'students':
      loadStudents();
      break;
    case 'student-form':
      // Form view prepared by showStudentForm()
      break;
    case 'marks':
      loadMarks();
      break;
    case 'profile':
      loadProfileDetails();
      break;
  }
}

/**
 * Mobile Sidebar Drawer Toggles
 */
function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.add('open');
  if (backdrop) backdrop.classList.remove('hidden');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.add('hidden');
}


// ==========================================================================
// SECTION 4: DASHBOARD
// ==========================================================================

/**
 * Fetch summary statistics, student distribution, and recent activity
 */



async function loadDashboard() {
  showLoading('Loading dashboard statistics...');

  try {
    const user = AppState.currentUser;

    if (!user || !user.role) {
      throw new Error('Your session is unavailable. Please sign in again.');
    }

    const role = String(user.role).toLowerCase();
    const isStudent = role === 'student';
    const isAdmin = role === 'admin';

    if (!isStudent && !isAdmin) {
      throw new Error('Your account does not have a recognized role.');
    }

    // A student must have a valid linked student ID.
    let studentId = null;

    if (isStudent) {
      studentId = Number(user.student_id);

      if (
        user.student_id === null ||
        user.student_id === undefined ||
        user.student_id === '' ||
        !Number.isSafeInteger(studentId) ||
        studentId <= 0
      ) {
        throw new Error(
          'Your account is not linked to a valid student record. ' +
          'Please contact your administrator.'
        );
      }
    }

    // Update dashboard labels according to account role.
    const dashboardLabels = isStudent
      ? {
          students: 'My Student Record',
          departments: 'My Semester',
          marks: 'My Scorecards',
          average: 'My Performance'
        }
      : {
          students: 'Total Enrolled Students',
          departments: 'Academic Departments',
          marks: 'Published Scorecards',
          average: 'Average Performance'
        };

    const setText = (id, value) => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = value;
      }
    };

    setText('label-stat-students', dashboardLabels.students);
    setText('label-stat-departments', dashboardLabels.departments);
    setText('label-stat-marks', dashboardLabels.marks);
    setText('label-stat-average', dashboardLabels.average);

    setText(
      'label-stat-performance-description',
      isStudent ? 'My academic average' : 'Institutional Score Index'
    );

    // Hide institution-wide panels from student accounts.
    const departmentCard = document.getElementById(
      'dashboard-department-card'
    );

    const recentStudentsCard = document.getElementById(
      'dashboard-recent-students-card'
    );

    if (departmentCard) {
      departmentCard.style.display = isStudent ? 'none' : '';
    }

    if (recentStudentsCard) {
      recentStudentsCard.style.display = isStudent ? 'none' : '';
    }

    setText(
      'trend-stat-students',
      isStudent
        ? 'Your personal academic record'
        : '↑ Active Academic Database'
    );

    setText(
      'trend-stat-marks',
      isStudent
        ? 'Your recorded subject results'
        : '5 Subject Semestral Records'
    );

    const heroDescription = document.querySelector(
      '.dashboard-hero .hero-content p'
    );

    if (heroDescription) {
      heroDescription.textContent = isStudent
        ? 'Track your academic records, semester results, and personal performance.'
        : 'Here is your institutional summary, performance metrics, and quick student record statistics.';
    }

    /*
     * IMPORTANT:
     * Students request only their own record and marks.
     * Administrators retain access to the complete directory and marks list.
     *
     * Backend authorization must enforce these restrictions too.
     */
    const studentsEndpoint = isStudent
      ? `/api/students/${studentId}`
      : '/api/students';

    const marksEndpoint = isStudent
      ? `/api/marks/student/${studentId}`
      : '/api/marks';

    const [studentsResult, marksResult] = await Promise.all([
      apiRequest(studentsEndpoint),
      apiRequest(marksEndpoint)
    ]);

    // Normalize the student API response.
    let students = [];

    if (Array.isArray(studentsResult)) {
      students = studentsResult;
    } else if (
      studentsResult &&
      studentsResult.student &&
      typeof studentsResult.student === 'object'
    ) {
      students = [studentsResult.student];
    } else if (
      studentsResult &&
      Array.isArray(studentsResult.students)
    ) {
      students = studentsResult.students;
    } else if (
      studentsResult &&
      typeof studentsResult === 'object' &&
      studentsResult.id !== undefined
    ) {
      students = [studentsResult];
    } else if (isAdmin && studentsResult !== null) {
      throw new Error('The student API returned an unexpected response.');
    }

    // Require an array instead of silently hiding an API error.
    let marks;

    if (Array.isArray(marksResult)) {
      marks = marksResult;
    } else if (
      marksResult &&
      Array.isArray(marksResult.marks)
    ) {
      marks = marksResult.marks;
    } else {
      throw new Error('The marks API returned an unexpected response.');
    }

    // Defense in depth: never render records belonging to other students.
    if (isStudent) {
      students = students.filter(
        student => Number(student.id) === studentId
      );

      marks = marks.filter(
        mark => Number(mark.student_id) === studentId
      );

      if (students.length === 0) {
        throw new Error(
          'Your linked student record could not be found. ' +
          'Please contact your administrator.'
        );
      }
    }

    // Update shared state only after both API responses are validated.
    AppState.studentsList = students;
    AppState.marksList = marks;

    // Student profile card.
    const profileCard = document.getElementById(
      'student-profile-card'
    );

    if (profileCard) {
      profileCard.style.display = isStudent ? '' : 'none';
    }

    if (isStudent) {
      const student = students[0];

      setText(
        'profile-full-name',
        student.name ||
          [student.first_name, student.last_name]
            .filter(Boolean)
            .join(' ') ||
          '—'
      );

      setText(
        'profile-roll-number',
        student.roll_number || student.roll_no || '—'
      );

      setText('profile-email', student.email || '—');

      setText(
        'profile-course',
        student.department || student.course || '—'
      );

      setText(
        'profile-academic-year',
        student.year
          ? `Year ${student.year}`
          : student.academic_year
            ? `Year ${student.academic_year}`
            : '—'
      );

      setText(
        'profile-semester',
        student.semester
          ? `Semester ${student.semester}`
          : '—'
      );
    }

    // Dashboard statistics.
    if (isStudent) {
      const student = students[0];

      setText(
        'stat-total-students',
        String(students.length)
      );

      setText(
        'stat-total-departments',
        student.semester
          ? `Sem ${student.semester}`
          : '--'
      );

      setText(
        'stat-total-marks',
        String(marks.length)
      );

      const percentages = marks
        .map(mark => Number(mark.percentage))
        .filter(value => Number.isFinite(value));

      const average = percentages.length
        ? percentages.reduce((sum, value) => sum + value, 0) /
          percentages.length
        : null;

      setText(
        'stat-average-marks',
        average === null ? '--' : `${average.toFixed(1)}%`
      );

      // Do not expose institution-wide student information here.
      const departmentMap = {};

      if (student.course) {
        departmentMap[student.course] = 1;
      }

      renderDepartmentDistribution(departmentMap, students.length);

      // The student list contains only this student's record.
      renderDashboardRecentStudents(students);
    } else {
      // Administrator: institution-wide statistics.
      setText(
        'stat-total-students',
        String(students.length)
      );

      const departmentMap = {};

      students.forEach(student => {
        const department =
          student.department || student.course || 'General';

        departmentMap[department] =
          (departmentMap[department] || 0) + 1;
      });

      setText(
        'stat-total-departments',
        String(Object.keys(departmentMap).length)
      );

      renderDepartmentDistribution(
        departmentMap,
        students.length
      );

      setText(
        'stat-total-marks',
        String(marks.length)
      );

      const percentages = marks
        .map(mark => Number(mark.percentage))
        .filter(value => Number.isFinite(value));

      const average = percentages.length
        ? percentages.reduce((sum, value) => sum + value, 0) /
          percentages.length
        : null;

      setText(
        'stat-average-marks',
        average === null ? '--' : `${average.toFixed(1)}%`
      );

      renderDashboardRecentStudents(
        students.slice(-5).reverse()
      );
    }

    setText(
      'dashboard-welcome-heading',
      `Welcome back, ${user.username}!`
    );

  } catch (error) {
    console.error('Dashboard loading error:', error);

    showNotification(
      'Failed to refresh dashboard: ' + error.message,
      'error'
    );
  } finally {
    hideLoading();
  }
}




/**
 * Render Department Enrollment breakdown in Dashboard
 */
function renderDepartmentDistribution(deptMap, totalStudents) {
  const container = document.getElementById('dept-distribution-list');
  if (!container) return;

  const entries = Object.entries(deptMap);
  if (entries.length === 0 || totalStudents === 0) {
    container.innerHTML = '<div class="empty-state-sm text-muted">No departmental enrollment records yet.</div>';
    return;
  }

  container.innerHTML = entries.map(([dept, count]) => {
    const percent = Math.round((count / totalStudents) * 100);
    return `
      <div class="dept-item">
        <div class="dept-item-header">
          <span>${escapeHtml(dept)}</span>
          <span class="text-muted">${count} Student${count > 1 ? 's' : ''} (${percent}%)</span>
        </div>
        <div class="dept-progress-bar">
          <div class="dept-progress-fill" style="width: ${percent}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render Recent Students table preview in Dashboard
 */
function renderDashboardRecentStudents(recentList) {
  const tbody = document.getElementById('dashboard-recent-students-tbody');
  if (!tbody) return;

  if (recentList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No students currently registered.</td></tr>`;
    return;
  }

  tbody.innerHTML = recentList.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.roll_number)}</strong></td>
      <td>${escapeHtml(s.name)}</td>
      <td><span class="badge badge-dept">${escapeHtml(s.department || '-')}</span></td>
      <td>Year ${escapeHtml(s.year || '-')}</td>
    </tr>
  `).join('');
}


// ==========================================================================
// SECTION 5: STUDENTS MANAGEMENT
// ==========================================================================

/**
 * Load student records with active search/filter queries
 */
async function loadStudents() {
  const searchInput = document.getElementById('filter-search');
  const deptSelect = document.getElementById('filter-department');
  const yearSelect = document.getElementById('filter-year');

  const search = searchInput ? encodeURIComponent(searchInput.value.trim()) : '';
  const department = deptSelect ? encodeURIComponent(deptSelect.value) : '';
  const year = yearSelect ? encodeURIComponent(yearSelect.value) : '';

  const queryParams = new URLSearchParams();
  if (search) queryParams.append('search', search);
  if (department) queryParams.append('department', department);
  if (year) queryParams.append('year', year);

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  showLoading('Fetching student directory...');
  try {
    const data = await apiRequest(`/api/students${queryString}`);
    const students = Array.isArray(data) ? data : (data.students || []);
    AppState.studentsList = students;

    renderStudentsTable(students);

    // Update Counter Label
    const countLabel = document.getElementById('students-count-label');
    if (countLabel) {
      countLabel.textContent = `Showing ${students.length} student record${students.length === 1 ? '' : 's'}`;
    }
  } catch (error) {
    showNotification('Failed to load students: ' + error.message, 'error');
    const tbody = document.getElementById('students-table-body');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">Error loading students: ${escapeHtml(error.message)}</td></tr>`;
    }
  } finally {
    hideLoading();
  }
}

/**
 * Render dynamic rows in the Students Directory Table
 */
function renderStudentsTable(students) {
  const tbody = document.getElementById('students-table-body');
  if (!tbody) return;

  if (!students || students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5 text-muted">
          No student records found matching the criteria.
        </td>
      </tr>
    `;
    return;
  }

  const user = AppState.currentUser;
  const isAdmin = user && (user.role || '').toLowerCase() === 'admin';

  tbody.innerHTML = students.map(s => {
    const editBtn = isAdmin
      ? `<button class="action-btn edit" onclick="showStudentForm(${s.id})" title="Edit Student">
           Edit
         </button>`
      : '';

    const deleteBtn = isAdmin
      ? `<button class="action-btn delete" onclick="deleteStudent(${s.id}, '${escapeHtml(s.name).replace(/'/g, "\\'")}')" title="Delete Student">
           Delete
         </button>`
      : '';

    const marksBtn = `<button class="action-btn marks" onclick="openMarksForStudent(${s.id})" title="Manage Marks">
                        Marks
                      </button>`;

    return `
      <tr>
        <td><strong>${escapeHtml(s.roll_number)}</strong></td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(s.name)}</div>
          <small class="text-muted">${escapeHtml(s.address || '')}</small>
        </td>
        <td>${escapeHtml(s.email)}</td>
        <td>${escapeHtml(s.phone)}</td>
        <td><span class="badge badge-dept">${escapeHtml(s.department)}</span></td>
        <td>Year ${escapeHtml(s.year)}</td>
        <td class="text-right">
          <div class="action-btn-group">
            ${marksBtn}
            ${editBtn}
            ${deleteBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Open Add/Edit Student Form
 * @param {number|null} studentId - If provided, pre-fills for edit mode
 */
async function showStudentForm(studentId = null) {
  AppState.editingStudentId = studentId;

  const titleEl = document.getElementById('student-form-title');
  const submitTextEl = document.getElementById('student-submit-btn-text');
  const form = document.getElementById('student-form');

  if (form) form.reset();

  if (studentId) {
    if (titleEl) titleEl.textContent = 'Edit Student Record';
    if (submitTextEl) submitTextEl.textContent = 'Update Student Details';

    showLoading('Loading student details for editing...');
    try {
      const data = await apiRequest(`/api/students/${studentId}`);
      const student = data.student || data;

      document.getElementById('student-id').value = student.id || studentId;
      document.getElementById('student-roll').value = student.roll_number || '';
      document.getElementById('student-name').value = student.name || '';
      document.getElementById('student-email').value = student.email || '';
      document.getElementById('student-phone').value = student.phone || '';
      document.getElementById('student-department').value = student.department || '';
      document.getElementById('student-year').value = student.year || '';
      document.getElementById('student-address').value = student.address || '';
    } catch (error) {
      showNotification('Failed to load student details: ' + error.message, 'error');
      return;
    } finally {
      hideLoading();
    }
  } else {
    if (titleEl) titleEl.textContent = 'Add New Student';
    if (submitTextEl) submitTextEl.textContent = 'Save Student';
    document.getElementById('student-id').value = '';
  }

  navigateTo('student-form');
}

/**
 * Form Submit Handler: Create or Update Student
 */
async function handleStudentSubmit(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('student-id').value;
  const roll_number = document.getElementById('student-roll').value.trim();
  const name = document.getElementById('student-name').value.trim();
  const email = document.getElementById('student-email').value.trim();
  const phone = document.getElementById('student-phone').value.trim();
  const department = document.getElementById('student-department').value;
  const year = document.getElementById('student-year').value;
  const address = document.getElementById('student-address').value.trim();

  // Basic client-side validation
  if (!roll_number || !name || !email || !phone || !department || !year) {
    showNotification('Please fill in all required fields marked with *', 'warning');
    return;
  }

  const payload = {
    roll_number,
    name,
    email,
    phone,
    department,
    year,
    address
  };

  const isEditing = Boolean(id);
  const endpoint = isEditing ? `/api/students/${id}` : '/api/students';
  const method = isEditing ? 'PUT' : 'POST';

  showLoading(isEditing ? 'Updating student profile...' : 'Registering new student...');
  try {
    await apiRequest(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    showNotification(
      isEditing ? 'Student record updated successfully!' : 'Student enrolled successfully!',
      'success'
    );

    // Return to students table view and refresh records
    navigateTo('students');
  } catch (error) {
    showNotification(error.message || 'Operation failed. Please try again.', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Delete a student record with confirmation
 */
async function deleteStudent(id, studentName) {
  const confirmed = await showConfirmModal(
    'Delete Student Record',
    `Are you sure you want to permanently delete student "${studentName}"? All connected academic marks and scorecards will also be deleted.`,
    'Permanently Delete'
  );
  if (!confirmed) return;

  showLoading('Deleting student record...');
  try {
    await apiRequest(`/api/students/${id}`, { method: 'DELETE' });
    showNotification('Student record deleted successfully.', 'success');
    loadStudents();
  } catch (error) {
    showNotification('Failed to delete student: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Filter students triggered by live search inputs
 */
function searchStudents() {
  clearTimeout(AppState.searchDebounceTimer);
  AppState.searchDebounceTimer = setTimeout(() => {
    loadStudents();
  }, 350);
}


// ==========================================================================
// SECTION 6: MARKS MANAGEMENT
// ==========================================================================

/**
 * Fetch and render all academic marks records
 */

async function loadMarks() {
  showLoading('Loading academic scorecards...');

  try {
    const user = AppState.currentUser;
    const isStudent =
      user && (user.role || '').toLowerCase() === 'student';

    // Only admins can access the complete student directory.
    if (!isStudent) {
      if (AppState.studentsList.length === 0) {
        const data = await apiRequest('/api/students');
        AppState.studentsList = Array.isArray(data)
          ? data
          : (data.students || []);
      }

      populateStudentSelects();
    }

    // Students can fetch only their own marks.
    let endpoint = '/api/marks';

    if (isStudent) {
      if (!user.student_id) {
        throw new Error('Your account is not linked to a student record.');
      }

      endpoint = `/api/marks/student/${user.student_id}`;
    }

    const marksData = await apiRequest(endpoint);
    const marks = Array.isArray(marksData)
      ? marksData
      : (marksData.marks || []);

    AppState.marksList = marks;

    filterAndRenderMarks();
  } catch (error) {
    showNotification(
      'Failed to load marks: ' + error.message,
      'error'
    );

    const tbody = document.getElementById('marks-table-body');

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="12" class="text-center py-4 text-danger">
            Error: ${escapeHtml(error.message)}
          </td>
        </tr>`;
    }
  } finally {
    hideLoading();
  }
}


/**
 * Populate student selection dropdowns in Marks form and Filter bar
 */
function populateStudentSelects() {
  const formSelect = document.getElementById('marks-student-id');
  const filterSelect = document.getElementById('marks-filter-student');

  if (formSelect) {
    formSelect.innerHTML = '<option value="" disabled selected>-- Choose Enrolled Student --</option>' +
      AppState.studentsList.map(s => `
        <option value="${s.id}">${escapeHtml(s.name)} (Roll: ${escapeHtml(s.roll_number)})</option>
      `).join('');
  }

  if (filterSelect) {
    filterSelect.innerHTML = '<option value="">All Students</option>' +
      AppState.studentsList.map(s => `
        <option value="${s.id}">${escapeHtml(s.name)} (Roll: ${escapeHtml(s.roll_number)})</option>
      `).join('');
  }
}

/**
 * Filter Marks table according to active filter controls
 */
function filterAndRenderMarks() {
  const studentFilter = document.getElementById('marks-filter-student')?.value;
  const semFilter = document.getElementById('marks-filter-semester')?.value;

  let filtered = [...AppState.marksList];

  if (studentFilter) {
    filtered = filtered.filter(m => String(m.student_id) === String(studentFilter));
  }

  if (semFilter) {
    filtered = filtered.filter(m => String(m.semester) === String(semFilter));
  }

  renderMarksTable(filtered);

  const countLabel = document.getElementById('marks-count-label');
  if (countLabel) {
    countLabel.textContent = `Showing ${filtered.length} grade scorecard${filtered.length === 1 ? '' : 's'}`;
  }
}

/**
 * Render Marks Data Table
 */
function renderMarksTable(marks) {
  const tbody = document.getElementById('marks-table-body');
  if (!tbody) return;

  if (!marks || marks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="text-center py-5 text-muted">
          No marks recorded for the selected filter.
        </td>
      </tr>
    `;
    return;
  }

  const user = AppState.currentUser;
  const isAdmin = user && (user.role || '').toLowerCase() === 'admin';

  tbody.innerHTML = marks.map(m => {
    // Find matching student name and roll
    const student = AppState.studentsList.find(s => String(s.id) === String(m.student_id)) || {};
    const studentName = m.student_name || student.name || `Student #${m.student_id}`;
    const studentRoll = m.roll_number || student.roll_number || '-';

    const s1 = Number(m.subject1) || 0;
    const s2 = Number(m.subject2) || 0;
    const s3 = Number(m.subject3) || 0;
    const s4 = Number(m.subject4) || 0;
    const s5 = Number(m.subject5) || 0;

    const total = s1 + s2 + s3 + s4 + s5;
    const percentage = (total / 5).toFixed(2);
    const { grade, badgeClass } = calculateGrade(percentage);

    const editBtn = isAdmin
      ? `<button class="action-btn edit" onclick="showMarksForm(${m.id})" title="Edit Marks">Edit</button>`
      : '';
    const deleteBtn = isAdmin
      ? `<button class="action-btn delete" onclick="deleteMarks(${m.id})" title="Delete Marks">Delete</button>`
      : '';

    return `
      <tr>
        <td><strong>${escapeHtml(studentName)}</strong></td>
        <td><code>${escapeHtml(studentRoll)}</code></td>
        <td>Sem ${escapeHtml(m.semester)}</td>
        <td>${s1}</td>
        <td>${s2}</td>
        <td>${s3}</td>
        <td>${s4}</td>
        <td>${s5}</td>
        <td><strong>${total} / 500</strong></td>
        <td><strong>${percentage}%</strong></td>
        <td><span class="badge ${badgeClass}">${grade}</span></td>
        <td class="text-right">
          <div class="action-btn-group">
            ${editBtn}
            ${deleteBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Toggle visibility of Marks Form Container
 */
function toggleMarksForm(show = null) {
  const container = document.getElementById('marks-form-container');
  if (!container) return;

  if (show === null) {
    container.classList.toggle('hidden');
  } else if (show) {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }

  // Scroll to form smoothly if opened
  if (!container.classList.contains('hidden')) {
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Open Marks Form for Adding or Editing
 */
function showMarksForm(marksId = null) {
  AppState.editingMarksId = marksId;
  const form = document.getElementById('marks-form');
  const title = document.getElementById('marks-form-title');
  const studentSelect = document.getElementById('marks-student-id');

  if (form) form.reset();

  toggleMarksForm(true);

  if (marksId) {
    if (title) title.textContent = 'Edit Student Marks';

    const mark = AppState.marksList.find(m => String(m.id) === String(marksId));
    if (mark) {
      document.getElementById('marks-id').value = mark.id;
      if (studentSelect) studentSelect.value = mark.student_id;
      document.getElementById('marks-semester').value = mark.semester;
      document.getElementById('marks-sub1').value = mark.subject1;
      document.getElementById('marks-sub2').value = mark.subject2;
      document.getElementById('marks-sub3').value = mark.subject3;
      document.getElementById('marks-sub4').value = mark.subject4;
      document.getElementById('marks-sub5').value = mark.subject5;
    }
  } else {
    if (title) title.textContent = 'Record Student Marks';
    document.getElementById('marks-id').value = '';
  }

  updateLiveMarksCalculation();
}

/**
 * Quick shortcut to open marks form with preselected student
 */
function openMarksForStudent(studentId) {
  navigateTo('marks');
  showMarksForm();
  const select = document.getElementById('marks-student-id');
  if (select) select.value = studentId;
}

/**
 * Live Marks Calculation for Total, Percentage, and Grade Badge
 */
function updateLiveMarksCalculation() {
  const s1 = Math.min(100, Math.max(0, Number(document.getElementById('marks-sub1')?.value) || 0));
  const s2 = Math.min(100, Math.max(0, Number(document.getElementById('marks-sub2')?.value) || 0));
  const s3 = Math.min(100, Math.max(0, Number(document.getElementById('marks-sub3')?.value) || 0));
  const s4 = Math.min(100, Math.max(0, Number(document.getElementById('marks-sub4')?.value) || 0));
  const s5 = Math.min(100, Math.max(0, Number(document.getElementById('marks-sub5')?.value) || 0));

  const total = s1 + s2 + s3 + s4 + s5;
  const percentage = (total / 5).toFixed(2);
  const { grade, badgeClass } = calculateGrade(percentage);

  const totalEl = document.getElementById('preview-total');
  const percEl = document.getElementById('preview-percentage');
  const gradeEl = document.getElementById('preview-grade');

  if (totalEl) totalEl.textContent = `${total} / 500`;
  if (percEl) percEl.textContent = `${percentage}%`;
  if (gradeEl) {
    gradeEl.textContent = grade;
    gradeEl.className = `badge ${badgeClass}`;
  }
}

/**
 * Submit handler for Marks Form (Create or Update)
 */
async function handleMarksSubmit(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('marks-id').value;
  const student_id = document.getElementById('marks-student-id').value;
  const semester = document.getElementById('marks-semester').value;
  const subject1 = Number(document.getElementById('marks-sub1').value);
  const subject2 = Number(document.getElementById('marks-sub2').value);
  const subject3 = Number(document.getElementById('marks-sub3').value);
  const subject4 = Number(document.getElementById('marks-sub4').value);
  const subject5 = Number(document.getElementById('marks-sub5').value);

  // Validation
  if (!student_id || !semester) {
    showNotification('Please select student and semester.', 'warning');
    return;
  }

  const subjects = [subject1, subject2, subject3, subject4, subject5];
  for (let i = 0; i < subjects.length; i++) {
    if (isNaN(subjects[i]) || subjects[i] < 0 || subjects[i] > 100) {
      showNotification(`Subject ${i + 1} score must be between 0 and 100.`, 'warning');
      return;
    }
  }

  const payload = {
    student_id,
    semester,
    subject1,
    subject2,
    subject3,
    subject4,
    subject5
  };

  const isEditing = Boolean(id);
  const endpoint = isEditing ? `/api/marks/${id}` : '/api/marks';
  const method = isEditing ? 'PUT' : 'POST';

  showLoading(isEditing ? 'Updating score record...' : 'Saving marks record...');
  try {
    await apiRequest(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    showNotification(
      isEditing ? 'Marks updated successfully!' : 'Marks recorded successfully!',
      'success'
    );

    toggleMarksForm(false);
    loadMarks();
  } catch (error) {
    showNotification(error.message || 'Failed to save marks.', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Delete a marks entry
 */
async function deleteMarks(id) {
  const confirmed = await showConfirmModal(
    'Delete Marks Record',
    'Are you sure you want to delete this scorecard record? This cannot be undone.',
    'Delete Record'
  );
  if (!confirmed) return;

  showLoading('Deleting scorecard...');
  try {
    await apiRequest(`/api/marks/${id}`, { method: 'DELETE' });
    showNotification('Marks record removed successfully.', 'success');
    loadMarks();
  } catch (error) {
    showNotification('Failed to delete marks: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}


// ==========================================================================
// SECTION 7: PROFILE & INITIALIZATION
// ==========================================================================

/**
 * Load User Profile and linked Student Information (if applicable)
 */

async function loadProfileDetails() {
  const user = AppState.currentUser;
  if (!user) return;

  const infoContainer = document.getElementById('profile-student-info');
  const titleEl = document.getElementById('profile-linked-title');

  if (!infoContainer) return;

  if (user.role === 'admin') {
    if (titleEl) titleEl.textContent = 'Administrator Privileges';

    infoContainer.innerHTML = `
      <div class="profile-info-grid">
        <div class="profile-field-item">
          <span class="profile-field-label">Access Level</span>
          <span class="profile-field-value text-blue">Full Institutional Admin</span>
        </div>
        <div class="profile-field-item">
          <span class="profile-field-label">Student Management</span>
          <span class="profile-field-value text-emerald">Create, Edit, Delete</span>
        </div>
        <div class="profile-field-item">
          <span class="profile-field-label">Academic Grading</span>
          <span class="profile-field-value text-purple">Semester Marksheets</span>
        </div>
        <div class="profile-field-item">
          <span class="profile-field-label">Analytics Scope</span>
          <span class="profile-field-value">All Departments</span>
        </div>
      </div>
    `;
    return;
  }

  if (!user.student_id) {
    if (titleEl) titleEl.textContent = 'Enrolled Student Details';
    infoContainer.innerHTML =
      `<p class="text-muted">No student enrollment record linked to this account.</p>`;
    return;
  }

  if (titleEl) titleEl.textContent = 'Enrolled Student Details';
  infoContainer.innerHTML =
    `<p class="text-muted">Loading linked student record...</p>`;

  try {
    const data = await apiRequest(`/api/students/${user.student_id}`);
    const s = data.student || data;

    const fullName = s.name ||
      [s.first_name, s.last_name].filter(Boolean).join(' ') ||
      'Not specified';

    const academicYear = s.year || s.academic_year || 'Not specified';

    const fields = [
      ['Roll Number', s.roll_number || s.roll_no],
      ['Student Name', fullName],
      ['Email', s.email],
      ['Phone', s.phone],
      ['Course / Department', s.department || s.course],
      ['Academic Year', academicYear === 'Not specified'
        ? academicYear
        : `Year ${academicYear}`],
      ['Semester', s.semester ? `Semester ${s.semester}` : 'Not specified'],
      ['Date of Birth', s.dob
        ? String(s.dob).slice(0, 10)
        : 'Not specified'],
      ['Gender', s.gender],
      ['Registered Address', s.address]
    ];

    infoContainer.innerHTML = `
      <div class="profile-info-grid">
        ${fields.map(([label, value]) => `
          <div class="profile-field-item">
            <span class="profile-field-label">${escapeHtml(label)}</span>
            <span class="profile-field-value">${escapeHtml(value || 'Not specified')}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Unable to load student profile:', error);
    infoContainer.innerHTML =
      `<p class="text-muted">Student profile information could not be retrieved. Please try again.</p>`;
  }
}


/**
 * Global Initialization on DOM Ready
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Attach Form Event Listeners
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const studentForm = document.getElementById('student-form');
  if (studentForm) studentForm.addEventListener('submit', handleStudentSubmit);

  const marksForm = document.getElementById('marks-form');
  if (marksForm) marksForm.addEventListener('submit', handleMarksSubmit);

  // 2. Attach Live Marks Calculation listeners
  ['marks-sub1', 'marks-sub2', 'marks-sub3', 'marks-sub4', 'marks-sub5'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateLiveMarksCalculation);
    }
  });

  // 3. Attach Navigation Click Handlers
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.getAttribute('data-view');
      if (view) navigateTo(view);
    });
  });

  // 4. Attach Logout Buttons
  const topbarLogout = document.getElementById('btn-topbar-logout');
  if (topbarLogout) topbarLogout.addEventListener('click', handleLogout);

  const sidebarLogout = document.getElementById('btn-sidebar-logout');
  if (sidebarLogout) sidebarLogout.addEventListener('click', handleLogout);

  // 5. Mobile Sidebar Drawer Controls
  const mobileToggle = document.getElementById('mobile-toggle-btn');
  if (mobileToggle) mobileToggle.addEventListener('click', openMobileSidebar);

  const sidebarClose = document.getElementById('sidebar-close-btn');
  if (sidebarClose) sidebarClose.addEventListener('click', closeMobileSidebar);

  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

  // 6. Search & Filters in Students View
  const filterSearch = document.getElementById('filter-search');
  if (filterSearch) filterSearch.addEventListener('input', searchStudents);

  const filterDept = document.getElementById('filter-department');
  if (filterDept) filterDept.addEventListener('change', loadStudents);

  const filterYear = document.getElementById('filter-year');
  if (filterYear) filterYear.addEventListener('change', loadStudents);

  const resetFiltersBtn = document.getElementById('btn-reset-filters');
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      if (filterSearch) filterSearch.value = '';
      if (filterDept) filterDept.value = '';
      if (filterYear) filterYear.value = '';
      loadStudents();
    });
  }

  // 7. Marks View Filters
  const marksStudentFilter = document.getElementById('marks-filter-student');
  if (marksStudentFilter) marksStudentFilter.addEventListener('change', filterAndRenderMarks);

  const marksSemFilter = document.getElementById('marks-filter-semester');
  if (marksSemFilter) marksSemFilter.addEventListener('change', filterAndRenderMarks);

  // 8. Bootstrap Session Verification
  checkAuth();
});


// ============================================================================
// EDUMANAGE GLOBAL — FRONT-END EXPERIENCE & ACCESSIBILITY ENHANCEMENTS
// ----------------------------------------------------------------------------
// Additive UI layer only. This section intentionally does not replace or alter
// authentication, API endpoints, CRUD handlers, grade rules, data calculations,
// or role permissions defined above. It progressively enhances the existing UI.
// ============================================================================

(() => {
  'use strict';

  const UX = {
    initialized: false,
    lastFocusedElement: null,
    observer: null,
    reducedMotion: false
  };

  const byId = (id) => document.getElementById(id);
  const all = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  /** Safely add semantic affordances without replacing existing handlers. */
  function enhanceSemantics() {
    document.documentElement.classList.add('edumanage-js-ready');
    document.body.classList.add('edumanage-experience-enhanced');
    UX.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const main = byId('main-content');
    if (main && !main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    if (main && !main.hasAttribute('aria-label')) main.setAttribute('aria-label', 'Main application content');

    const nav = document.querySelector('.sidebar-nav');
    if (nav && !nav.hasAttribute('aria-label')) nav.setAttribute('aria-label', 'Main navigation');

    all('.sidebar-nav .nav-item').forEach((item) => {
      if (!item.hasAttribute('aria-current') && item.classList.contains('active')) {
        item.setAttribute('aria-current', 'page');
      }
      item.addEventListener('click', () => {
        all('.sidebar-nav .nav-item').forEach((link) => {
          link.removeAttribute('aria-current');
        });
        item.setAttribute('aria-current', 'page');
      });
    });

    const sidebar = byId('sidebar');
    const mobileToggle = byId('mobile-toggle-btn');
    if (mobileToggle) {
      mobileToggle.setAttribute('aria-controls', 'sidebar');
      mobileToggle.setAttribute('aria-expanded', String(Boolean(sidebar && sidebar.classList.contains('open'))));
    }

    const password = byId('login-password');
    const passwordToggle = byId('password-toggle');
    if (password && passwordToggle) {
      passwordToggle.setAttribute('aria-controls', password.id);
      if (!passwordToggle.hasAttribute('aria-label')) passwordToggle.setAttribute('aria-label', 'Show or hide password');
    }

    const loading = byId('loading-overlay');
    if (loading) {
      loading.setAttribute('role', 'status');
      loading.setAttribute('aria-live', 'polite');
    }

    const toastContainer = byId('toast-container');
    if (toastContainer) {
      toastContainer.setAttribute('role', 'region');
      toastContainer.setAttribute('aria-label', 'Notifications');
      toastContainer.setAttribute('aria-live', 'polite');
      toastContainer.setAttribute('aria-relevant', 'additions text');
    }

    const modal = byId('confirm-modal');
    if (modal) {
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('role', 'dialog');
    }

    all('button:not([type])').forEach((button) => button.setAttribute('type', 'button'));
    all('input, select, textarea').forEach((field) => {
      if (field.disabled) field.setAttribute('aria-disabled', 'true');
      if (field.required && !field.hasAttribute('aria-required')) field.setAttribute('aria-required', 'true');
    });
  }

  /** Apply interaction states to dynamically-created controls too. */
  function enhanceDynamicContent(root = document) {
    all('.content-card, .stat-card, .filter-card, .dashboard-hero', root).forEach((card) => {
      if (!card.hasAttribute('data-ux-enhanced')) card.setAttribute('data-ux-enhanced', 'true');
    });

    all('.stat-card', root).forEach((card) => {
      if (!card.hasAttribute('tabindex') && card.querySelector('a, button')) {
        card.setAttribute('tabindex', '0');
      }
    });

    all('table', root).forEach((table) => {
      if (!table.hasAttribute('role')) table.setAttribute('role', 'table');
      const wrapper = table.closest('.table-responsive');
      if (wrapper && !wrapper.hasAttribute('tabindex')) {
        wrapper.setAttribute('tabindex', '0');
        wrapper.setAttribute('role', 'region');
        const heading = table.id === 'marks-table'
          ? 'Academic marks table'
          : table.id === 'students-table'
            ? 'Student records table'
            : 'Data table';
        wrapper.setAttribute('aria-label', heading + '. Scroll horizontally to view all columns.');
      }
    });

    all('.action-btn, .btn, .chip', root).forEach((button) => {
      if (!button.hasAttribute('data-ux-boundary')) button.setAttribute('data-ux-boundary', 'true');
    });
  }

  /** Small visual polish through existing classes and safe inline properties. */
  function enhanceInteractionFeedback() {
    document.addEventListener('pointerdown', (event) => {
      const target = event.target.closest('.btn, .action-btn, .chip, .nav-item');
      if (!target || target.disabled || UX.reducedMotion) return;
      target.classList.add('ux-pressed');
      window.setTimeout(() => target.classList.remove('ux-pressed'), 160);
    }, { passive: true });

    document.addEventListener('focusin', (event) => {
      const field = event.target;
      if (!field.matches('input, select, textarea')) return;
      const group = field.closest('.form-group');
      if (group) group.classList.add('ux-field-active');
    });

    document.addEventListener('focusout', (event) => {
      const field = event.target;
      if (!field.matches('input, select, textarea')) return;
      const group = field.closest('.form-group');
      if (group) group.classList.remove('ux-field-active');
    });
  }

  /** Keep current navigation semantics synchronized with SPA route changes. */
  function syncNavigationState() {
    const observerTarget = byId('app-section') || document.body;
    if (UX.observer) UX.observer.disconnect();
    UX.observer = new MutationObserver(() => {
      const sidebar = byId('sidebar');
      const toggle = byId('mobile-toggle-btn');
      if (sidebar && toggle) {
        toggle.setAttribute('aria-expanded', String(sidebar.classList.contains('open')));
      }
      const active = document.querySelector('.sidebar-nav .nav-item.active');
      all('.sidebar-nav .nav-item').forEach((item) => {
        if (item === active) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
      });
      enhanceDynamicContent(document);
    });
    UX.observer.observe(observerTarget, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  /** Keyboard conveniences; existing buttons and application handlers remain authoritative. */
  function bindKeyboardExperience() {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const sidebar = byId('sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
          if (typeof closeMobileSidebar === 'function') closeMobileSidebar();
        }

        const modal = byId('confirm-modal');
        if (modal && !modal.classList.contains('hidden')) {
          const cancel = byId('modal-cancel-btn');
          if (cancel) cancel.click();
        }
      }

      // Ctrl/Cmd + K focuses the student search when that view is available.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        const search = byId('filter-search');
        const studentsView = byId('students-view');
        if (search && studentsView && !studentsView.classList.contains('hidden')) {
          event.preventDefault();
          search.focus();
          search.select();
        }
      }
    });

    const modal = byId('confirm-modal');
    if (!modal) return;
    const observer = new MutationObserver(() => {
      const isOpen = !modal.classList.contains('hidden');
      if (isOpen) {
        if (!modal.dataset.uxOpen) {
          UX.lastFocusedElement = document.activeElement;
          modal.dataset.uxOpen = 'true';
          const preferred = byId('modal-cancel-btn') || byId('modal-confirm-btn') || byId('modal-close-btn');
          if (preferred) preferred.focus({ preventScroll: true });
        }
      } else if (modal.dataset.uxOpen) {
        delete modal.dataset.uxOpen;
        if (UX.lastFocusedElement && typeof UX.lastFocusedElement.focus === 'function') {
          UX.lastFocusedElement.focus({ preventScroll: true });
        }
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  /** Enhance the five-subject preview without changing its calculations. */
  function enhanceMarksPreview() {
    const preview = document.querySelector('.marks-calc-preview');
    if (!preview) return;
    preview.setAttribute('aria-label', 'Live marks calculation preview');
    preview.setAttribute('aria-live', 'polite');
    preview.setAttribute('aria-atomic', 'true');

    ['marks-sub1', 'marks-sub2', 'marks-sub3', 'marks-sub4', 'marks-sub5'].forEach((id, index) => {
      const field = byId(id);
      if (!field) return;
      field.setAttribute('inputmode', 'numeric');
      field.setAttribute('aria-describedby', field.getAttribute('aria-describedby') || 'marks-entry-guidance');
      if (!byId('marks-entry-guidance')) {
        const guidance = document.createElement('span');
        guidance.id = 'marks-entry-guidance';
        guidance.className = 'visually-hidden';
        guidance.textContent = 'Enter a score from 0 to 100 for each subject.';
        field.insertAdjacentElement('afterend', guidance);
      }
      field.dataset.subjectNumber = String(index + 1);
    });
  }

  /** Keep feedback unobtrusive and make the page's state discoverable. */
  function enhanceStatusAndForms() {
    const loginForm = byId('login-form');
    if (loginForm) loginForm.setAttribute('aria-label', 'Sign in to EduManage Global');
    const studentForm = byId('student-form');
    if (studentForm) studentForm.setAttribute('aria-label', 'Student enrollment details');
    const marksForm = byId('marks-form');
    if (marksForm) marksForm.setAttribute('aria-label', 'Academic marks entry');

    const headings = all('.view-panel h2');
    headings.forEach((heading) => {
      if (!heading.id) heading.id = `view-heading-${Math.random().toString(36).slice(2, 9)}`;
      const panel = heading.closest('.view-panel');
      if (panel && !panel.hasAttribute('aria-labelledby')) panel.setAttribute('aria-labelledby', heading.id);
    });

    const yearSelect = byId('student-year');
    if (yearSelect && !yearSelect.getAttribute('autocomplete')) yearSelect.setAttribute('autocomplete', 'off');
  }

  function initializeExperienceLayer() {
    if (UX.initialized) return;
    UX.initialized = true;
    enhanceSemantics();
    enhanceDynamicContent(document);
    enhanceInteractionFeedback();
    syncNavigationState();
    bindKeyboardExperience();
    enhanceMarksPreview();
    enhanceStatusAndForms();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExperienceLayer, { once: true });
  } else {
    initializeExperienceLayer();
  }
})();

/**
 * Popup UI for Chrome extension network traffic interceptor
 * Manages display of intercepted requests and interception rules
 */

// State
let currentTab = 'requests';
let interceptedRequests = [];
let rules = [];
let editingRuleId = null;

// DOM Elements
const requestsTab = document.getElementById('requests-tab');
const rulesTab = document.getElementById('rules-tab');
const requestsList = document.getElementById('requests-list');
const rulesList = document.getElementById('rules-list');
const requestCount = document.getElementById('request-count');
const ruleForm = document.getElementById('rule-form');
const formTitle = document.getElementById('form-title');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupButtons();
  await loadData();
  setupMessageListener();
});

/**
 * Setup tab switching functionality
 */
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });
}

/**
 * Switch between requests and rules tabs
 */
function switchTab(tabName) {
  currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  requestsTab.classList.toggle('active', tabName === 'requests');
  rulesTab.classList.toggle('active', tabName === 'rules');
}

/**
 * Setup button click handlers
 */
function setupButtons() {
  // Clear requests button
  document.getElementById('clear-requests').addEventListener('click', () => {
    interceptedRequests = [];
    renderRequests();
  });

  // Add rule button
  document.getElementById('add-rule').addEventListener('click', () => {
    showRuleForm();
  });

  // Save rule button
  document.getElementById('save-rule').addEventListener('click', async () => {
    await saveRule();
  });

  // Cancel rule button
  document.getElementById('cancel-rule').addEventListener('click', () => {
    hideRuleForm();
  });
}

/**
 * Load initial data from background script
 */
async function loadData() {
  try {
    // Load intercepted requests
    const requestsResponse = await chrome.runtime.sendMessage({
      type: 'GET_REQUESTS'
    });
    interceptedRequests = requestsResponse || [];

    // Load rules
    const rulesResponse = await chrome.runtime.sendMessage({
      type: 'GET_RULES'
    });
    rules = rulesResponse || [];

    renderRequests();
    renderRules();
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

/**
 * Setup listener for real-time updates from background script
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'REQUEST_INTERCEPTED') {
      interceptedRequests.unshift(message.payload);
      renderRequests();
    } else if (message.type === 'RESPONSE_INTERCEPTED') {
      const request = interceptedRequests.find(r => r.id === message.payload.id);
      if (request) {
        request.status = message.payload.status;
        renderRequests();
      }
    }
  });
}

/**
 * Render intercepted requests list
 */
function renderRequests() {
  requestCount.textContent = `${interceptedRequests.length} request${interceptedRequests.length !== 1 ? 's' : ''}`;

  if (interceptedRequests.length === 0) {
    requestsList.innerHTML = '<div class="empty-state">No intercepted requests yet</div>';
    return;
  }

  requestsList.innerHTML = interceptedRequests.map(req => {
    const time = formatTime(req.timestamp);
    const methodClass = `method-${req.method.toLowerCase()}`;
    const statusBadge = req.status
      ? `<span class="request-status ${req.status < 400 ? 'status-success' : 'status-error'}">${req.status}</span>`
      : '';

    return `
      <div class="request-item">
        <div class="request-header">
          <span class="request-method ${methodClass}">${req.method}</span>
          ${statusBadge}
          <span class="request-time">${time}</span>
        </div>
        <div class="request-url">${escapeHtml(req.url)}</div>
      </div>
    `;
  }).join('');
}

/**
 * Render rules list
 */
function renderRules() {
  if (rules.length === 0) {
    rulesList.innerHTML = '<div class="empty-state">No rules configured</div>';
    return;
  }

  rulesList.innerHTML = rules.map(rule => {
    const actionClass = `action-${rule.action}`;
    const disabledClass = rule.enabled ? '' : 'disabled';

    return `
      <div class="rule-item ${disabledClass}" data-rule-id="${rule.id}">
        <div class="rule-toggle">
          <input type="checkbox" ${rule.enabled ? 'checked' : ''}
                 onchange="toggleRule('${rule.id}')" />
        </div>
        <div class="rule-content">
          <div class="rule-pattern">${escapeHtml(rule.pattern)}</div>
          <span class="rule-action ${actionClass}">${rule.action}</span>
        </div>
        <div class="rule-actions">
          <button class="btn btn-small btn-secondary" onclick="editRule('${rule.id}')">Edit</button>
          <button class="btn btn-small btn-danger" onclick="deleteRule('${rule.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Show rule form for adding or editing
 */
function showRuleForm(rule = null) {
  editingRuleId = rule ? rule.id : null;

  if (rule) {
    formTitle.textContent = 'Edit Rule';
    document.getElementById('rule-pattern').value = rule.pattern;
    document.getElementById('rule-action').value = rule.action;
    document.getElementById('rule-enabled').checked = rule.enabled;
  } else {
    formTitle.textContent = 'Add New Rule';
    document.getElementById('rule-pattern').value = '';
    document.getElementById('rule-action').value = 'allow';
    document.getElementById('rule-enabled').checked = true;
  }

  ruleForm.classList.remove('hidden');
}

/**
 * Hide rule form
 */
function hideRuleForm() {
  ruleForm.classList.add('hidden');
  editingRuleId = null;
}

/**
 * Save rule (add or update)
 */
async function saveRule() {
  const pattern = document.getElementById('rule-pattern').value.trim();
  const action = document.getElementById('rule-action').value;
  const enabled = document.getElementById('rule-enabled').checked;

  if (!pattern) {
    alert('Please enter a URL pattern');
    return;
  }

  let updatedRules;

  if (editingRuleId) {
    // Update existing rule
    updatedRules = rules.map(r =>
      r.id === editingRuleId
        ? { ...r, pattern, action, enabled }
        : r
    );
  } else {
    // Add new rule
    const newRule = {
      id: generateId(),
      pattern,
      action,
      enabled
    };
    updatedRules = [...rules, newRule];
  }

  try {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_RULES',
      payload: updatedRules
    });

    rules = updatedRules;
    renderRules();
    hideRuleForm();
  } catch (error) {
    console.error('Error saving rule:', error);
    alert('Failed to save rule');
  }
}

/**
 * Toggle rule enabled/disabled
 */
window.toggleRule = async function(ruleId) {
  const updatedRules = rules.map(r =>
    r.id === ruleId
      ? { ...r, enabled: !r.enabled }
      : r
  );

  try {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_RULES',
      payload: updatedRules
    });

    rules = updatedRules;
    renderRules();
  } catch (error) {
    console.error('Error toggling rule:', error);
  }
};

/**
 * Edit rule
 */
window.editRule = function(ruleId) {
  const rule = rules.find(r => r.id === ruleId);
  if (rule) {
    showRuleForm(rule);
  }
};

/**
 * Delete rule
 */
window.deleteRule = async function(ruleId) {
  if (!confirm('Are you sure you want to delete this rule?')) {
    return;
  }

  const updatedRules = rules.filter(r => r.id !== ruleId);

  try {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_RULES',
      payload: updatedRules
    });

    rules = updatedRules;
    renderRules();
  } catch (error) {
    console.error('Error deleting rule:', error);
  }
};

/**
 * Generate unique ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format timestamp to readable time
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

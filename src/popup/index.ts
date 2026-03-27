/**
 * Popup UI for Chrome extension network traffic interceptor
 * Manages display of intercepted requests and interception rules
 */

import type { Rule, InterceptedRequest, Message, MessageResponse } from '../shared/types';

// State
let interceptedRequests: InterceptedRequest[] = [];
let rules: Rule[] = [];
let editingRuleId: string | null = null;

// DOM Elements
const requestsTab = document.getElementById('requests-tab') as HTMLElement;
const rulesTab = document.getElementById('rules-tab') as HTMLElement;
const requestsList = document.getElementById('requests-list') as HTMLElement;
const rulesList = document.getElementById('rules-list') as HTMLElement;
const requestCount = document.getElementById('request-count') as HTMLElement;
const ruleForm = document.getElementById('rule-form') as HTMLElement;
const formTitle = document.getElementById('form-title') as HTMLElement;

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
function setupTabs(): void {
  const tabButtons = document.querySelectorAll('.tab-btn');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = (btn as HTMLElement).dataset.tab;
      if (tabName) {
        switchTab(tabName as 'requests' | 'rules');
      }
    });
  });
}

/**
 * Switch between requests and rules tabs
 */
function switchTab(tabName: 'requests' | 'rules'): void {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.tab === tabName);
  });

  // Update tab content
  requestsTab.classList.toggle('active', tabName === 'requests');
  rulesTab.classList.toggle('active', tabName === 'rules');
}

/**
 * Setup button click handlers
 */
function setupButtons(): void {
  // Clear requests button
  document.getElementById('clear-requests')?.addEventListener('click', () => {
    interceptedRequests = [];
    renderRequests();
  });

  // Add rule button
  document.getElementById('add-rule')?.addEventListener('click', () => {
    showRuleForm();
  });

  // Save rule button
  document.getElementById('save-rule')?.addEventListener('click', async () => {
    await saveRule();
  });

  // Cancel rule button
  document.getElementById('cancel-rule')?.addEventListener('click', () => {
    hideRuleForm();
  });
}

/**
 * Load initial data from background script
 */
async function loadData(): Promise<void> {
  try {
    // Load intercepted requests
    const requestsResponse = await chrome.runtime.sendMessage({
      type: 'GET_REQUESTS'
    } as Message) as MessageResponse;
    interceptedRequests = requestsResponse.data || [];

    // Load rules
    const rulesResponse = await chrome.runtime.sendMessage({
      type: 'GET_RULES'
    } as Message) as MessageResponse;
    rules = rulesResponse.data || [];

    renderRequests();
    renderRules();
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

/**
 * Setup listener for real-time updates from background script
 */
function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message: Message) => {
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
function renderRequests(): void {
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
function renderRules(): void {
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
                 data-action="toggle" data-rule-id="${rule.id}" />
        </div>
        <div class="rule-content">
          <div class="rule-pattern">${escapeHtml(rule.pattern)}</div>
          <span class="rule-action ${actionClass}">${rule.action}</span>
        </div>
        <div class="rule-actions">
          <button class="btn btn-small btn-secondary" data-action="edit" data-rule-id="${rule.id}">Edit</button>
          <button class="btn btn-small btn-danger" data-action="delete" data-rule-id="${rule.id}">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  rulesList.querySelectorAll<HTMLInputElement>('input[data-action="toggle"]').forEach(el => {
    el.addEventListener('change', () => toggleRule(el.dataset.ruleId!));
  });
  rulesList.querySelectorAll<HTMLButtonElement>('button[data-action="edit"]').forEach(el => {
    el.addEventListener('click', () => editRule(el.dataset.ruleId!));
  });
  rulesList.querySelectorAll<HTMLButtonElement>('button[data-action="delete"]').forEach(el => {
    el.addEventListener('click', () => deleteRule(el.dataset.ruleId!));
  });
}

/**
 * Show rule form for adding or editing
 */
function showRuleForm(rule?: Rule): void {
  editingRuleId = rule ? rule.id : null;

  const patternInput = document.getElementById('rule-pattern') as HTMLInputElement;
  const actionSelect = document.getElementById('rule-action') as HTMLSelectElement;
  const enabledCheckbox = document.getElementById('rule-enabled') as HTMLInputElement;

  if (rule) {
    formTitle.textContent = 'Edit Rule';
    patternInput.value = rule.pattern;
    actionSelect.value = rule.action;
    enabledCheckbox.checked = rule.enabled;
  } else {
    formTitle.textContent = 'Add New Rule';
    patternInput.value = '';
    actionSelect.value = 'allow';
    enabledCheckbox.checked = true;
  }

  ruleForm.classList.remove('hidden');
}

/**
 * Hide rule form
 */
function hideRuleForm(): void {
  ruleForm.classList.add('hidden');
  editingRuleId = null;
}

/**
 * Save rule (add or update)
 */
async function saveRule(): Promise<void> {
  const patternInput = document.getElementById('rule-pattern') as HTMLInputElement;
  const actionSelect = document.getElementById('rule-action') as HTMLSelectElement;
  const enabledCheckbox = document.getElementById('rule-enabled') as HTMLInputElement;

  const pattern = patternInput.value.trim();
  const action = actionSelect.value as 'block' | 'allow' | 'modify';
  const enabled = enabledCheckbox.checked;

  if (!pattern) {
    alert('Please enter a URL pattern');
    return;
  }

  let updatedRules: Rule[];

  if (editingRuleId) {
    // Update existing rule
    updatedRules = rules.map(r =>
      r.id === editingRuleId
        ? { ...r, pattern, action, enabled }
        : r
    );
  } else {
    // Add new rule
    const newRule: Rule = {
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
    } as Message);

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
async function toggleRule(ruleId: string): Promise<void> {
  const updatedRules = rules.map(r =>
    r.id === ruleId
      ? { ...r, enabled: !r.enabled }
      : r
  );

  try {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_RULES',
      payload: updatedRules
    } as Message);

    rules = updatedRules;
    renderRules();
  } catch (error) {
    console.error('Error toggling rule:', error);
  }
}

/**
 * Edit rule
 */
function editRule(ruleId: string): void {
  const rule = rules.find(r => r.id === ruleId);
  if (rule) {
    showRuleForm(rule);
  }
}

/**
 * Delete rule
 */
async function deleteRule(ruleId: string): Promise<void> {
  if (!confirm('Are you sure you want to delete this rule?')) {
    return;
  }

  const updatedRules = rules.filter(r => r.id !== ruleId);

  try {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_RULES',
      payload: updatedRules
    } as Message);

    rules = updatedRules;
    renderRules();
  } catch (error) {
    console.error('Error deleting rule:', error);
  }
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format timestamp to readable time
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


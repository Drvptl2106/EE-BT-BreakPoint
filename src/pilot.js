// Demo mode ('fake' backend): these codes are checked in the browser. Demo only.
// Database mode ('api'): these start EMPTY and src/backend/api.js fills them in after sign-in
// from the profiles table, so the pages that import them keep working unchanged.
import { CONFIG } from './config.js?v=3c62140785';
const api = CONFIG.backend === 'api';
export const MANAGER_CODES = api ? {} : { 'MGR-001': 'Team lead' };
export const PILOT_USERS = api ? {} : { 'EE-001': 'Alex', 'EE-002': 'Priya', 'EE-003': 'Sam', 'EE-004': 'Jordan', 'EE-005': 'Chris', 'EE-006': 'Mo' };
export const SESSION_USER = 'bt-user-session';   // agents (localStorage)
export const SESSION_MGR = 'bt-mgr-session';     // managers (sessionStorage)

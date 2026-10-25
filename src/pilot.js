// Demo mode ('fake' backend): these codes are checked in the browser. Demo only.
// Database mode ('api'): these start EMPTY and src/backend/api.js fills them in after sign-in
// from the profiles table, so the pages that import them keep working unchanged.
import { CONFIG } from './config.js?v=f1a49e4a85';
const api = CONFIG.backend === 'api';
export const MANAGER_CODES = api ? {} : { 'MGR-001': 'Team lead' };
export const PILOT_USERS = api ? {} : { 'EE-001': 'User 1', 'EE-002': 'User 2', 'EE-003': 'User 3', 'EE-004': 'User 4', 'EE-005': 'User 5', 'EE-006': 'User 6' };
export const SESSION_USER = 'bt-user-session';   // agents (localStorage)
export const SESSION_MGR = 'bt-mgr-session';     // managers (sessionStorage)

// Demo mode ('fake' backend): these codes are checked in the browser. Demo only.
// Database mode ('api'): these start EMPTY and src/backend/api.js fills them in after sign-in
// from the profiles table, so the pages that import them keep working unchanged.
import { CONFIG } from './config.js';
const api = CONFIG.backend === 'api';
export const MANAGER_CODES = api ? {} : { 'MGR-7777': 'Team lead' };
export const PILOT_USERS = api ? {} : { 'EE-1001': 'Alex', 'EE-1002': 'Priya', 'EE-1003': 'Sam', 'EE-1004': 'Jordan', 'EE-1005': 'Chris' };
export const SESSION_USER = 'bt-user-session';   // agents (localStorage)
export const SESSION_MGR = 'bt-mgr-session';     // managers (sessionStorage)

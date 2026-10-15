// THE LOGIN CONTRACT. The screens only know these three methods.
//   getCurrentUser() => { id, name, role, team } | null
//   signIn({ name, code }) => { ok: true, user } | { ok: false, error }
//   signOut() => void
// Stage 3 adds an invite-only login behind the same three methods. IT later
// swaps in company single sign-on the same way. Whatever the implementation,
// the SERVER decides the role. The client is never trusted to say who is a manager.

export const AUTH_METHODS = ['getCurrentUser', 'signIn', 'signOut'];

export function assertAuthLayer(layer) {
  const missing = AUTH_METHODS.filter((m) => typeof layer[m] !== 'function');
  if (missing.length) throw new Error(`Auth layer is missing: ${missing.join(', ')}`);
  return layer;
}

const USERS_KEY = 'aces_users';
const SESSION_KEY = 'aces_session';
 
// Hash simples (não-criptográfico) só para não guardar senha em texto puro
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return String(h >>> 0);
}
 
function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); }
  catch { return {}; }
}
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
 
// Garante o usuário de teste (login e senha "teste")
export function ensureSeedUser() {
  const users = loadUsers();
  if (!users['teste']) {
    users['teste'] = { email: 'teste', pass: hash('teste'), createdAt: Date.now() };
    saveUsers(users);
  }
}
 
export function currentUser() {
  return localStorage.getItem(SESSION_KEY) || null;
}
 
export function signup(email, pass, confirm) {
  email = (email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Informe um e-mail.' };
  if (!pass || pass.length < 4) return { ok: false, error: 'A senha deve ter ao menos 4 caracteres.' };
  if (pass !== confirm) return { ok: false, error: 'As senhas não coincidem.' };
  const users = loadUsers();
  if (users[email]) return { ok: false, error: 'Este e-mail já está cadastrado.' };
  users[email] = { email, pass: hash(pass), createdAt: Date.now() };
  saveUsers(users);
  localStorage.setItem(SESSION_KEY, email);
  return { ok: true };
}
 
export function login(email, pass) {
  email = (email || '').trim().toLowerCase();
  const users = loadUsers();
  const u = users[email];
  if (!u || u.pass !== hash(pass)) return { ok: false, error: 'E-mail ou senha incorretos.' };
  localStorage.setItem(SESSION_KEY, email);
  return { ok: true };
}
 
export function logout() {
  localStorage.removeItem(SESSION_KEY);
}
 
// Chave de armazenamento por usuário (dados separados)
export function userKey(base) {
  const u = currentUser() || 'anon';
  return base + '__' + u;
}

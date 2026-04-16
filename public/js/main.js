// Main JavaScript File
const AppState = { theme: localStorage.getItem('theme') || 'dark', user: null };
document.addEventListener('DOMContentLoaded', () => { initTheme(); });
function initTheme() { const s = document.getElementById('themeSwitch'); if(s) { if(AppState.theme==='light') { document.body.classList.add('light'); s.classList.add('active'); } s.addEventListener('click', toggleTheme); } }
function toggleTheme() { document.body.classList.toggle('light'); const s = document.getElementById('themeSwitch'); if(s) s.classList.toggle('active'); AppState.theme = document.body.classList.contains('light')?'light':'dark'; localStorage.setItem('theme', AppState.theme); }
function toggleSidebar() { const s = document.getElementById('sidebar'), o = document.getElementById('overlay'); if(s&&o) { s.classList.toggle('active'); o.classList.toggle('active'); } }
function showToast(m, t='info') { const toast = document.createElement('div'); toast.className = `toast ${t}`; toast.textContent = m; document.body.appendChild(toast); setTimeout(()=>{ toast.style.animation='slideDown 0.3s ease'; setTimeout(()=>toast.remove(),300); },3000); }
function formatDate(d) { return new Date(d).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' }); }
function formatFileSize(b) { if(b<1024) return b+' B'; if(b<1024*1024) return (b/1024).toFixed(2)+' KB'; return (b/(1024*1024)).toFixed(2)+' MB'; }
window.toggleSidebar = toggleSidebar;
window.showToast = showToast;
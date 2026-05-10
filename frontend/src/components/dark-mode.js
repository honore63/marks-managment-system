function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('mms_dark_mode', isDark);
    const moonIcons = document.querySelectorAll('i[data-lucide="moon"], i[data-lucide="sun"]');
    moonIcons.forEach(icon => {
        icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    });
    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('mms_dark_mode') === 'true') {
        document.body.classList.add('dark-mode');
        const moonIcons = document.querySelectorAll('i[data-lucide="moon"]');
        moonIcons.forEach(i => i.setAttribute('data-lucide', 'sun'));
        if (window.lucide && typeof lucide.createIcons === 'function') {
            lucide.createIcons();
        }
    }
});

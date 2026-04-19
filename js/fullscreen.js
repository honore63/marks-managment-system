// Full Screen Functionality for MMS Portal
document.addEventListener('DOMContentLoaded', () => {
    // Check if running as PWA (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || document.referrer.includes('android-app://');
    
    // Create the floating Fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.id = 'toggle-fullscreen-btn';
    fullscreenBtn.title = 'Toggle Full Screen';
    fullscreenBtn.innerHTML = `
        <svg id="fs-icon-enter" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
        <svg id="fs-icon-exit" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
    `;
    
    // Style the button
    Object.assign(fullscreenBtn.style, {
        position: 'fixed',
        bottom: '25px',
        right: '25px',
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        backgroundColor: '#0F172A',
        color: 'white',
        border: 'none',
        boxShadow: '0 8px 25px rgba(15, 23, 42, 0.4)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '999999',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    });

    // Add hover effect
    fullscreenBtn.onmouseenter = () => {
        fullscreenBtn.style.transform = 'scale(1.1) translateY(-2px)';
        fullscreenBtn.style.backgroundColor = '#2563EB';
        fullscreenBtn.style.boxShadow = '0 10px 30px rgba(37, 99, 235, 0.5)';
    };
    fullscreenBtn.onmouseleave = () => {
        fullscreenBtn.style.transform = 'scale(1) translateY(0)';
        fullscreenBtn.style.backgroundColor = '#0F172A';
        fullscreenBtn.style.boxShadow = '0 8px 25px rgba(15, 23, 42, 0.4)';
    };

    document.body.appendChild(fullscreenBtn);

    const iconEnter = document.getElementById('fs-icon-enter');
    const iconExit = document.getElementById('fs-icon-exit');

    // Toggle logic
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement &&
            !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement ) {
            // Enter fullscreen
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                elem.mozRequestFullScreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            }
            iconEnter.style.display = 'none';
            iconExit.style.display = 'block';
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
            iconEnter.style.display = 'block';
            iconExit.style.display = 'none';
        }
    });

    // Update icons on change (e.g. user pressed Escape to exit)
    const handleFullscreenChange = () => {
        if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
            iconEnter.style.display = 'none';
            iconExit.style.display = 'block';
        } else {
            iconEnter.style.display = 'block';
            iconExit.style.display = 'none';
        }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
});

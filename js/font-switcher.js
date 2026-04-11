/**
 * MMS Font Switcher Engine v2
 * Floating panel for live font & size switching.
 * Persists to localStorage. Works on all portals.
 */
(function () {
    'use strict';

    const FONT_GROUPS = [
        {
            group: 'Recommended',
            fonts: [
                { label: 'Inter (Default)', value: 'Inter, sans-serif' },
                { label: 'Poppins', value: 'Poppins, sans-serif' },
                { label: 'Roboto', value: 'Roboto, sans-serif' },
                { label: 'Montserrat', value: 'Montserrat, sans-serif' },
                { label: 'DM Sans', value: 'DM Sans, sans-serif' },
                { label: 'Nunito', value: 'Nunito, sans-serif' },
                { label: 'Open Sans', value: 'Open Sans, sans-serif' },
            ]
        },
        {
            group: 'Clean & Modern',
            fonts: [
                { label: 'Outfit', value: 'Outfit, sans-serif' },
                { label: 'Lexend', value: 'Lexend, sans-serif' },
                { label: 'Manrope', value: 'Manrope, sans-serif' },
                { label: 'Space Grotesk', value: 'Space Grotesk, sans-serif' },
                { label: 'Raleway', value: 'Raleway, sans-serif' },
                { label: 'Work Sans', value: 'Work Sans, sans-serif' },
                { label: 'Mulish', value: 'Mulish, sans-serif' },
                { label: 'Karla', value: 'Karla, sans-serif' },
                { label: 'Plus Jakarta Sans', value: 'Plus Jakarta Sans, sans-serif' },
                { label: 'Quicksand', value: 'Quicksand, sans-serif' },
                { label: 'Lato', value: 'Lato, sans-serif' },
                { label: 'Ubuntu', value: 'Ubuntu, sans-serif' },
                { label: 'Cabin', value: 'Cabin, sans-serif' },
                { label: 'Rubik', value: 'Rubik, sans-serif' },
                { label: 'IBM Plex Sans', value: 'IBM Plex Sans, sans-serif' },
                { label: 'Fira Sans', value: 'Fira Sans, sans-serif' },
                { label: 'Red Hat Display', value: 'Red Hat Display, sans-serif' },
                { label: 'Noto Sans', value: 'Noto Sans, sans-serif' },
                { label: 'Josefin Sans', value: 'Josefin Sans, sans-serif' },
                { label: 'Heebo', value: 'Heebo, sans-serif' },
                { label: 'Kumbh Sans', value: 'Kumbh Sans, sans-serif' },
                { label: 'Varela Round', value: 'Varela Round, sans-serif' },
                { label: 'Questrial', value: 'Questrial, sans-serif' },
                { label: 'Prompt', value: 'Prompt, sans-serif' },
            ]
        },
        {
            group: 'Serif (Reports)',
            fonts: [
                { label: 'Merriweather', value: 'Merriweather, serif' },
                { label: 'Playfair Display', value: 'Playfair Display, serif' },
                { label: 'Lora', value: 'Lora, serif' },
                { label: 'EB Garamond', value: 'EB Garamond, serif' },
                { label: 'Libre Baskerville', value: 'Libre Baskerville, serif' },
                { label: 'Crimson Text', value: 'Crimson Text, serif' },
                { label: 'PT Serif', value: 'PT Serif, serif' },
                { label: 'Spectral', value: 'Spectral, serif' },
                { label: 'Arvo', value: 'Arvo, serif' },
                { label: 'Georgia', value: 'Georgia, serif' },
                { label: 'Vollkorn', value: 'Vollkorn, serif' },
            ]
        },
        {
            group: 'Bold & Display',
            fonts: [
                { label: 'Bebas Neue', value: 'Bebas Neue, sans-serif' },
                { label: 'Oswald', value: 'Oswald, sans-serif' },
                { label: 'Exo 2', value: 'Exo 2, sans-serif' },
                { label: 'League Spartan', value: 'League Spartan, sans-serif' },
                { label: 'Archivo Black', value: 'Archivo Black, sans-serif' },
                { label: 'Rajdhani', value: 'Rajdhani, sans-serif' },
                { label: 'Titillium Web', value: 'Titillium Web, sans-serif' },
                { label: 'Anton', value: 'Anton, sans-serif' },
                { label: 'Righteous', value: 'Righteous, sans-serif' },
            ]
        },
        {
            group: 'Tech & Futuristic',
            fonts: [
                { label: 'Orbitron', value: 'Orbitron, sans-serif' },
                { label: 'Russo One', value: 'Russo One, sans-serif' },
                { label: 'Audiowide', value: 'Audiowide, sans-serif' },
                { label: 'Chakra Petch', value: 'Chakra Petch, sans-serif' },
                { label: 'Syncopate', value: 'Syncopate, sans-serif' },
                { label: 'Michroma', value: 'Michroma, sans-serif' },
                { label: 'Exo', value: 'Exo, sans-serif' },
            ]
        },
        {
            group: 'Creative & Fun',
            fonts: [
                { label: 'Pacifico', value: 'Pacifico, cursive' },
                { label: 'Dancing Script', value: 'Dancing Script, cursive' },
                { label: 'Lobster', value: 'Lobster, cursive' },
                { label: 'Fredoka', value: 'Fredoka, sans-serif' },
                { label: 'Comfortaa', value: 'Comfortaa, sans-serif' },
                { label: 'Great Vibes', value: 'Great Vibes, cursive' },
                { label: 'Bangers', value: 'Bangers, cursive' },
            ]
        },
        {
            group: 'Monospace',
            fonts: [
                { label: 'JetBrains Mono', value: 'JetBrains Mono, monospace' },
                { label: 'Fira Code', value: 'Fira Code, monospace' },
                { label: 'Inconsolata', value: 'Inconsolata, monospace' },
                { label: 'Space Mono', value: 'Space Mono, monospace' },
            ]
        }
    ];

    const DEFAULT_FONT = 'Inter, sans-serif';
    const DEFAULT_SIZE = 100;
    const KEY_FONT = 'mms_font_family';
    const KEY_SIZE = 'mms_font_size';

    function getSaved() {
        return {
            font: localStorage.getItem(KEY_FONT) || DEFAULT_FONT,
            size: parseInt(localStorage.getItem(KEY_SIZE) || DEFAULT_SIZE, 10)
        };
    }

    function applyFont(v) {
        document.documentElement.style.setProperty('--font-body', v);
        document.documentElement.style.setProperty('--font-main', v);
        document.body.style.fontFamily = v;
        localStorage.setItem(KEY_FONT, v);
    }

    function applySize(pct) {
        document.documentElement.style.fontSize = (16 * pct / 100) + 'px';
        localStorage.setItem(KEY_SIZE, pct);
        const lbl = document.getElementById('mms-size-lbl');
        if (lbl) lbl.textContent = pct + '%';
        const sl = document.getElementById('mms-slider');
        if (sl) sl.value = pct;
    }

    function buildOptions(savedFont) {
        return FONT_GROUPS.map(function(g) {
            var opts = g.fonts.map(function(f) {
                return '<option value="' + f.value + '"' + (f.value === savedFont ? ' selected' : '') + '>' + f.label + '</option>';
            }).join('');
            return '<optgroup label="' + g.group + '">' + opts + '</optgroup>';
        }).join('');
    }

    function injectStyles() {
        if (document.getElementById('mms-fs-style')) return;
        var s = document.createElement('style');
        s.id = 'mms-fs-style';
        s.textContent = [
            '#mms-fs-root{position:fixed!important;top:16px!important;right:16px!important;z-index:999999!important;font-family:Inter,sans-serif!important;}',
            '#mms-fs-btn{width:54px;height:54px;border-radius:16px;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;border:none;cursor:pointer;',
            'display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:900;letter-spacing:-1px;',
            'box-shadow:0 8px 24px rgba(37,99,235,.5);transition:transform .25s,box-shadow .25s;animation:mmsPulse 2.5s ease-in-out infinite;}',
            '@keyframes mmsPulse{0%,100%{box-shadow:0 8px 24px rgba(37,99,235,.5);}50%{box-shadow:0 8px 36px rgba(37,99,235,.8);}}',
            '#mms-fs-btn:hover{transform:scale(1.12) rotate(-6deg);animation:none;box-shadow:0 12px 36px rgba(37,99,235,.65);}',
            '#mms-fs-panel{display:none;position:absolute!important;top:62px!important;right:0!important;width:300px;',
            'background:#fff;border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.18),0 4px 16px rgba(0,0,0,.08);',
            'border:1px solid #e2e8f0;overflow:hidden;}',
            '#mms-fs-panel.mms-open{display:block!important;animation:mmsIn .22s ease;}',
            '@keyframes mmsIn{from{opacity:0;transform:scale(.88) translateY(8px);}to{opacity:1;transform:scale(1) translateY(0);}}',
            '.mms-ph{background:linear-gradient(135deg,#1e293b,#0f172a);color:#fff;padding:14px 18px;',
            'display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:.88rem;}',
            '.mms-ph button{background:rgba(255,255,255,.12);border:none;color:#fff;cursor:pointer;border-radius:8px;',
            'width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:.85rem;transition:background .2s;}',
            '.mms-ph button:hover{background:rgba(255,255,255,.25);}',
            '.mms-pb{padding:16px;display:flex;flex-direction:column;gap:14px;}',
            '.mms-lbl{font-size:.68rem;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;}',
            '.mms-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}',
            '.mms-sbtn{width:38px;height:38px;border:2px solid #2563eb;border-radius:10px;background:#fff;color:#2563eb;',
            'font-weight:900;font-size:.82rem;cursor:pointer;flex-shrink:0;transition:all .18s;display:flex;align-items:center;justify-content:center;}',
            '.mms-sbtn:hover{background:#2563eb;color:#fff;}',
            '#mms-size-lbl{flex:1;text-align:center;font-weight:900;font-size:1rem;color:#1e293b;}',
            '#mms-slider{width:100%;height:5px;-webkit-appearance:none;appearance:none;background:#e2e8f0;border-radius:99px;outline:none;cursor:pointer;}',
            '#mms-slider::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;background:#2563eb;',
            'border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(37,99,235,.4);cursor:pointer;}',
            '#mms-font-sel{width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;',
            'font-size:.88rem;color:#0f172a;background:#f8fafc;cursor:pointer;outline:none;transition:border .2s;}',
            '#mms-font-sel:focus{border-color:#2563eb;background:#fff;}',
            '#mms-preview{padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;',
            'font-size:.82rem;color:#334155;line-height:1.5;margin-top:6px;transition:font-family .3s;}',
            '#mms-reset-btn{width:100%;padding:9px;border:1.5px solid #e2e8f0;border-radius:10px;background:#f8fafc;',
            'color:#475569;font-weight:800;font-size:.78rem;cursor:pointer;transition:all .2s;}',
            '#mms-reset-btn:hover{background:#fef2f2;border-color:#fca5a5;color:#dc2626;}',
            '@media(max-width:480px){#mms-fs-panel{width:calc(100vw - 16px);}#mms-fs-root{top:10px;right:10px;}}'
        ].join('');
        document.head.appendChild(s);
    }

    function init() {
        var saved = getSaved();
        applyFont(saved.font);
        applySize(saved.size);
        injectStyles();

        // Remove old instance
        var old = document.getElementById('mms-fs-root');
        if (old) old.remove();

        var root = document.createElement('div');
        root.id = 'mms-fs-root';

        var panelHtml = '<div id="mms-fs-panel">' +
            '<div class="mms-ph"><span>Display Settings</span><button id="mms-close-btn">X</button></div>' +
            '<div class="mms-pb">' +
            '<div><div class="mms-lbl">Font Size</div>' +
            '<div class="mms-row"><button class="mms-sbtn" id="mms-dn">A-</button>' +
            '<span id="mms-size-lbl">' + saved.size + '%</span>' +
            '<button class="mms-sbtn" id="mms-up">A+</button></div>' +
            '<input type="range" id="mms-slider" min="75" max="150" step="5" value="' + saved.size + '"></div>' +
            '<div><div class="mms-lbl">Font Type</div>' +
            '<select id="mms-font-sel">' + buildOptions(saved.font) + '</select>' +
            '<div id="mms-preview" style="font-family:' + saved.font + '">The quick brown fox jumps. Marks: 98/100</div></div>' +
            '<button id="mms-reset-btn">Reset to Defaults</button>' +
            '</div></div>';

        root.innerHTML = panelHtml + '<button id="mms-fs-btn">Aa</button>';
        document.body.appendChild(root);

        var panel  = document.getElementById('mms-fs-panel');
        var btn    = document.getElementById('mms-fs-btn');
        var closeB = document.getElementById('mms-close-btn');
        var sel    = document.getElementById('mms-font-sel');
        var upBtn  = document.getElementById('mms-up');
        var dnBtn  = document.getElementById('mms-dn');
        var slider = document.getElementById('mms-slider');
        var reset  = document.getElementById('mms-reset-btn');
        var preview= document.getElementById('mms-preview');
        var curSize = saved.size;

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            panel.classList.toggle('mms-open');
        });
        closeB.addEventListener('click', function() { panel.classList.remove('mms-open'); });
        document.addEventListener('click', function(e) {
            if (!root.contains(e.target)) panel.classList.remove('mms-open');
        });

        function doSize(pct) {
            curSize = Math.max(75, Math.min(150, pct));
            applySize(curSize);
        }

        upBtn.addEventListener('click', function() { doSize(curSize + 5); });
        dnBtn.addEventListener('click', function() { doSize(curSize - 5); });
        slider.addEventListener('input', function() { doSize(parseInt(slider.value, 10)); });

        sel.addEventListener('change', function() {
            applyFont(sel.value);
            preview.style.fontFamily = sel.value;
        });

        reset.addEventListener('click', function() {
            doSize(DEFAULT_SIZE);
            applyFont(DEFAULT_FONT);
            preview.style.fontFamily = DEFAULT_FONT;
            for (var i = 0; i < sel.options.length; i++) {
                if (sel.options[i].value === DEFAULT_FONT) { sel.selectedIndex = i; break; }
            }
        });
    }

    if (document.body) {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

})();

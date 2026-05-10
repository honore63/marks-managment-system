/**
 * MMS AI AGENT & CHATBOT ENGINE v3
 * Strategy: "Chatbot explains, Agent does."
 * Architecture: Intent Detection -> Action Execution -> Contextual Feedback
 */

(function() {
    'use strict';

    // ────────────────────────────────────────────────────────────────────────
    // 1. CONFIGURATION & AGENT BRAIN
    // ────────────────────────────────────────────────────────────────────────
    
    const GROQ_CONFIG = {
        enabled: true,
        model: "llama-3-70b-8192", 
        proxyUrl: null, 
        apiKey: "", 
    };

    let chatHistory = [];
    let isThinking = false;

    // The "Brain" Instructions (Strategy: Think before you act)
    const AGENT_SYSTEM_PROMPT = `
You are the MMS Intelligent Agent, an expert assistant for the Marks Management System in Rwanda.

YOUR PERSONA:
- GREETINGS: Respond warmly and professionally (e.g., "Hello! 👋 How can I assist you today?"). Use the user's name if provided in context.
- APPRECIATION: Be polite and brief (e.g., "You're welcome! 😊 Glad I could help. Is there anything else?"). Do not overreact to praise.
- TONE: Friendly, respectful, clear, and efficient. Avoid storytelling or unnecessary fluff.
- HELPFULNESS: Always prioritize solving the user's task over starting a long conversation.

YOUR CORE MODES:
1. CHATBOT MODE (Teacher explaining): Answer educational questions about MMS, calculations, or pedagogy.
2. AGENT MODE (Teacher doing): Execute actions. If the user asks to "Open...", "Generate...", "Show...", "Navigate to...", you MUST trigger an action.

ACTION SPECIFICATION:
To perform an action, append a JSON block at the very end of your response.
Format: [[[ACTION:{"type":"NAVIGATE|GENERATE|SEARCH","params":{}}}]]]
`;

    // ────────────────────────────────────────────────────────────────────────
    // 3. UI INITIALIZATION
    // ────────────────────────────────────────────────────────────────────────

    function initUI() {
        const container = document.createElement('div');
        container.id = 'mms-ai-container';
        container.innerHTML = `
            <div id="ai-chat-window">
                <div class="ai-header">
                    <div class="ai-header-info">
                        <div class="ai-status-dot"></div>
                        <span class="ai-header-title">MMS AI Assistant</span>
                    </div>
                    <div class="ai-header-btns">
                        <button class="ai-header-btn" id="ai-clear" title="Clear Chat">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                        <button class="ai-header-btn" id="ai-close">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>
                <div id="ai-messages">
                    <div class="msg msg-bot">
                        <b>Hello 👋 I am the MMS Intelligent Agent</b>, your smart assistant for the Marks Management System.<br><br>
                        I am here to help teachers, students, and administrators manage academic information quickly and efficiently.<br><br>
                        <b>🎯 What I can help you with:</b><br>
                        • Managing and analyzing student marks<br>
                        • Supporting teacher operations and records<br>
                        • Assisting administrators with system control<br>
                        • Generating performance insights and reports<br>
                        • Answering questions about how MMS works<br><br>
                        <b>💡 How to interact with me:</b><br>
                        Type commands like: <i>"Show student performance"</i>, <i>"Register a teacher"</i>, or <i>"Generate class report."</i><br><br>
                        I am always ready to support your academic management tasks. Let’s make learning and administration smarter together 🚀
                    </div>
                </div>
                <div class="typing" id="ai-typing">
                    <span></span><span></span><span></span>
                </div>
                <div class="ai-input-area">
                    <div class="ai-input-wrapper">
                        <textarea id="ai-input" placeholder="Ask or Command (e.g. 'Generate P5 Reports')" rows="1"></textarea>
                        <button id="ai-send">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </button>
                    </div>
                </div>
            </div>
            <button id="ai-chat-toggle" title="Open MMS Agent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    <path d="M9 10h.01"></path>
                    <path d="M15 10h.01"></path>
                    <path d="M12 10h.01"></path>
                </svg>
            </button>
        `;
        document.body.appendChild(container);

        // Bind Events (Toggle, Close, Clear, Send)
        const toggle = document.getElementById('ai-chat-toggle');
        const win = document.getElementById('ai-chat-window');
        const close = document.getElementById('ai-close');
        const send = document.getElementById('ai-send');
        const input = document.getElementById('ai-input');
        const clear = document.getElementById('ai-clear');

        toggle.addEventListener('click', () => {
            const isActive = win.classList.toggle('active');
            // Change toggle button icon
            toggle.innerHTML = isActive ? 
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>` : 
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M9 10h.01"></path><path d="M15 10h.01"></path><path d="M12 10h.01"></path></svg>`;
        });

        close.addEventListener('click', () => {
            win.classList.remove('active');
            toggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M9 10h.01"></path><path d="M15 10h.01"></path><path d="M12 10h.01"></path></svg>`;
        });
        clear.addEventListener('click', () => {
            document.getElementById('ai-messages').innerHTML = '<div class="msg msg-bot">History cleared. I\'m ready for your next command.</div>';
            chatHistory = [];
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        send.addEventListener('click', handleSend);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. AGENT CONTROLLER (The Intent Processor)
    // ────────────────────────────────────────────────────────────────────────

    async function handleSend() {
        const input = document.getElementById('ai-input');
        const text = input.value.trim();
        if (!text || isThinking) return;

        input.value = '';
        addMessage(text, 'user');
        
        await processAI(text);
    }

    function addMessage(text, role) {
        const msgs = document.getElementById('ai-messages');
        const div = document.createElement('div');
        div.className = `msg msg-${role}`;
        div.innerHTML = text.replace(/\n/g, '<br>'); // Support line breaks
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
    }

    async function processAI(userText) {
        setThinking(true);

        try {
            const school = window.SCHOOL_INFO || {};
            const contextText = `[CONTEXT] School: ${school.name || 'MMS Pro'}. Term: ${school.active_term || '1'}. User: ${window.MY_PROFILE?.full_name || 'Staff'}.`;
            
            const messages = [
                { role: "system", content: AGENT_SYSTEM_PROMPT + "\n" + contextText },
                ...chatHistory,
                { role: "user", content: userText }
            ];

            const responseText = await callGroqAPI(messages);
            const cleanText = parseAndExecuteActions(responseText);
            
            addMessage(cleanText, 'bot');
            chatHistory.push({ role: "user", content: userText });
            chatHistory.push({ role: "assistant", content: responseText });

            if (chatHistory.length > 20) chatHistory.splice(0, 2); 

        } catch (err) {
            console.error("Agent Engine Error:", err);
            addMessage("I encountered a technical hurdle. Please ensure your institutional connectivity settings are active.", 'bot');
        } finally {
            setThinking(false);
        }
    }

    async function callGroqAPI(messages) {
        // If the user hasn't set an API key, fallback to a smart mock for demo purposes
        if (!GROQ_CONFIG.apiKey && !GROQ_CONFIG.proxyUrl) {
            return mockResponse(messages[messages.length-1].content);
        }

        const endpoint = GROQ_CONFIG.proxyUrl || "https://api.groq.com/openai/v1/chat/completions";
        const headers = { "Content-Type": "application/json" };
        if (!GROQ_CONFIG.proxyUrl) headers["Authorization"] = `Bearer ${GROQ_CONFIG.apiKey}`;

        const res = await fetch(endpoint, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                model: GROQ_CONFIG.model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        const data = await res.json();
        return data.choices[0].message.content;
    }

    function setThinking(val) {
        isThinking = val;
        document.getElementById('ai-typing').style.display = val ? 'block' : 'none';
        document.getElementById('ai-send').disabled = val;
    }

    // ────────────────────────────────────────────────────────────────────────
    // 5. AGENT ACTION ENGINE
    // ────────────────────────────────────────────────────────────────────────

    function parseAndExecuteActions(text) {
        const regex = /\[\[\[ACTION:(.*?)\]\]\]/s;
        const match = text.match(regex);
        
        if (match) {
            let actionJson = match[1].trim();
            try {
                // Remove the block from visible text immediately
                const cleanedText = text.replace(regex, "").trim();
                
                const action = JSON.parse(actionJson);
                executeAction(action);
                
                return cleanedText; 
            } catch (e) {
                console.error("Action Parse Fail:", e, "Payload:", actionJson);
                // Even if it fails to parse, we should probably hide the block from the user
                return text.replace(regex, "").trim();
            }
        }
        return text;
    }

    function executeAction(action) {
        console.log("AGENT EXECUTING:", action);
        
        switch(action.type) {
            case 'NAVIGATE':
                if (typeof window.switchView === 'function') {
                    window.switchView(action.params.view);
                    toastAI(`Navigating to ${action.params.view}...`);
                }
                break;
            case 'GENERATE':
                toastAI(`Initiating Report Engine for ${action.params.class_name || 'Class'}...`);
                // Find class in DB and trigger batch or search marks
                handleAgentSearchOrReport(action.params);
                break;
            case 'SEARCH':
                toastAI(`Filtering records for: ${action.params.query}...`);
                // Custom filter logic
                break;
        }
    }

    function handleAgentSearchOrReport(params) {
        // This hooks into teacher.js or admin.js existing functions
        if (typeof window.DB === 'undefined' || !window.DB) return;
        
        // Example: If user says "Show P4 marks", navigate to marks and select P4
        if (params.class_name) {
            // Logic to find class_id from name and set UI state
            console.log("Attempting to isolate data for:", params.class_name);
        }
    }

    function toastAI(msg) {
        if (typeof window.toast === 'function') window.toast(msg, 'info');
        else alert(msg);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 6. SMART MOCK (For instant demo if no API Key provided)
    // ────────────────────────────────────────────────────────────────────────

    function mockResponse(query) {
        return new Promise(resolve => {
            setTimeout(() => {
                const q = query.toLowerCase().trim();
                
                // 1. GREETINGS & INTRODUCTION (High Priority)
                if (q === 'hi' || q === 'hello' || q.includes('hey') || q.includes('morning') || q.includes('evening') || q.includes('hi ') || q.includes('introduce') || q.includes('who are you')) {
                    const name = window.MY_PROFILE?.full_name?.split(' ')[0] || 'there';
                    resolve(`Hello, ${name}! 👋 I am the **MMS Intelligent Agent**, your smart assistant for the Marks Management System. I help you manage marks, teachers, students, and reports quickly and easily.\n\nType a command like *"Show student performance"* or *"Generate class report"* to get started!`);
                    return;
                }

                // 2. APPRECIATION
                if (q.includes('thank') || q.includes('good job') || q.includes('perfect') || q.includes('best') || q.includes('nice')) {
                    resolve("You're very welcome! 😊 Glad I could help. Let me know if there's anything else you'd like to work on.");
                    return;
                }

                // 3. REPORT GENERATION INTENT
                if (q.includes('report') || q.includes('generate') || q.includes('proclamation')) {
                    resolve('To generate reports in MMS, follow these steps:\n\n1. Go to the **Reports** section.\n2. Select your **Class** and the current **Term**.\n3. Click **Preview Report**.\n4. Use the **Print** button to save as PDF.\n\nWould you like me to open the Reports section for you? [[[ACTION:{"type":"NAVIGATE","params":{"view":"reports"}}]]] ');
                    return;
                }

                // 4. MARK ENTRY INTENT 
                if (q.includes('mark') || q.includes('entry') || q.includes('record')) {
                    resolve('Recording marks is simple:\n\n1. Select the **Marks** tab in your sidebar.\n2. Choose the **Class** and **Subject**.\n3. Enter the scores in the table.\n\nI can take you to the Marks Entry page now if you like. [[[ACTION:{"type":"NAVIGATE","params":{"view":"marks"}}]]] ');
                    return;
                }

                // 5. ANALYTICS / FAILURE INTENT
                if (q.includes('fail') || q.includes('performance') || q.includes('average')) {
                    resolve('I can help you analyze performance. The system automatically highlights failing students (those below 50%) in red.\n\nYou should check the **Analytics** section on your dashboard. Shall we take a look? [[[ACTION:{"type":"NAVIGATE","params":{"view":"dashboard"}}]]] ');
                    return;
                }

                // 6. NAVIGATION INTENT
                if (q.includes('go to') || q.includes('open') || q.includes('show')) {
                    let target = 'dashboard';
                    if (q.includes('student')) target = 'students';
                    if (q.includes('subject')) target = 'subjects';
                    if (q.includes('config') || q.includes('setting')) target = 'configuration';
                    
                    resolve(`Understood. I'm opening the ${target} view for you. [[[ACTION:{\"type\":\"NAVIGATE\",\"params\":{\"view\":\"${target}\"}}}]]]`);
                    return;
                }

                // 7. FALLBACK
                resolve("I've analyzed your query, but I need more specific details to take a system action. I can currently help you with:\n- **Reports**: Generate or preview P1-P6 cards.\n- **Marks**: Record or review scores.\n- **Navigation**: Open any dashboard view.");
            }, 1000);
        });
    }

    // Start the engine
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }

})();

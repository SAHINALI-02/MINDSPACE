document.addEventListener('DOMContentLoaded', () => {
    // State Management
    let state = {
        currentFeed: 'public',
        activeMood: 'All',
        token: localStorage.getItem('mindspace_token') || null,
        alias: localStorage.getItem('mindspace_alias') || null,
        posts: [],
        rating: 5
    };

    // DOM Elements
    const postsContainer = document.getElementById('postsContainer');
    const privateGateBanner = document.getElementById('privateGateBanner');
    
    const loggedOutState = document.getElementById('loggedOutState');
    const loggedInState = document.getElementById('loggedInState');
    const userAliasText = document.getElementById('userAliasText');
    const authModal = document.getElementById('authModal');
    const authForm = document.getElementById('authForm');
    const authAliasInput = document.getElementById('authAlias');
    const authPasswordInput = document.getElementById('authPassword');
    const authErrorMsg = document.getElementById('authErrorMsg');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    
    const tabPublicBtn = document.getElementById('tabPublicBtn');
    const tabPrivateBtn = document.getElementById('tabPrivateBtn');
    const navPublicTab = document.getElementById('navPublicTab');
    const navPrivateTab = document.getElementById('navPrivateTab');
    const moodFilters = document.getElementById('moodFilters');

    const postModal = document.getElementById('postModal');
    const postContent = document.getElementById('postContent');
    const postMoodTag = document.getElementById('postMoodTag');
    const postFeedType = document.getElementById('postFeedType');
    const postAlias = document.getElementById('postAlias');
    const safetyIndicator = document.getElementById('safetyIndicator');
    const safetyStatusText = document.getElementById('safetyStatusText');
    const submitPostBtn = document.getElementById('submitPostBtn');

    const crisisModal = document.getElementById('crisisModal');
    const helplinesContainer = document.getElementById('helplinesContainer');
    const crisisMindBotBtn = document.getElementById('crisisMindBotBtn');
    const closeCrisisBtn = document.getElementById('closeCrisisBtn');

    const mindbotDrawer = document.getElementById('mindbotDrawer');
    const mindbotMessages = document.getElementById('mindbotMessages');
    const mindbotInput = document.getElementById('mindbotInput');
    const sendMindBotMsgBtn = document.getElementById('sendMindBotMsgBtn');
    const mindbotTrigger = document.getElementById('mindbotTrigger');
    const closeMindBotBtn = document.getElementById('closeMindBotBtn');
    const openMindBotNavBtn = document.getElementById('openMindBotNavBtn');
    const heroMindBotBtn = document.getElementById('heroMindBotBtn');

    const feedbackModal = document.getElementById('feedbackModal');
    const openFeedbackBtn = document.getElementById('openFeedbackBtn');
    const closeFeedbackModalBtn = document.getElementById('closeFeedbackModalBtn');
    const cancelFeedbackBtn = document.getElementById('cancelFeedbackBtn');
    const submitFeedbackBtn = document.getElementById('submitFeedbackBtn');
    const starRating = document.getElementById('starRating');

    updateAuthUI();
    loadFeed();

    tabPublicBtn.addEventListener('click', () => switchFeed('public'));
    tabPrivateBtn.addEventListener('click', () => switchFeed('private'));
    navPublicTab.addEventListener('click', () => switchFeed('public'));
    navPrivateTab.addEventListener('click', () => switchFeed('private'));

    document.getElementById('openLoginBtn').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('openRegisterBtn').addEventListener('click', () => openAuthModal('register'));
    document.getElementById('gateLoginBtn').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    document.getElementById('authTabLogin').addEventListener('click', (e) => {
        e.preventDefault();
        setAuthTab('login');
    });
    document.getElementById('authTabRegister').addEventListener('click', (e) => {
        e.preventDefault();
        setAuthTab('register');
    });

    document.getElementById('closeAuthModalBtn').addEventListener('click', () => authModal.classList.add('hidden'));

    moodFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('chip')) {
            document.querySelectorAll('.mood-filters .chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            state.activeMood = e.target.dataset.mood;
            renderPosts();
        }
    });

    document.getElementById('openPostModalBtn').addEventListener('click', () => {
        postContent.value = '';
        safetyIndicator.className = 'safety-indicator';
        safetyStatusText.textContent = 'Clean';
        postAlias.value = state.alias || 'Anonymous Friend';
        postFeedType.value = state.currentFeed;
        postModal.classList.remove('hidden');
    });

    document.getElementById('closePostModalBtn').addEventListener('click', () => postModal.classList.add('hidden'));
    document.getElementById('cancelPostBtn').addEventListener('click', () => postModal.classList.add('hidden'));
    submitPostBtn.addEventListener('click', handlePostSubmit);

    let checkTimeout = null;
    postContent.addEventListener('input', () => {
        clearTimeout(checkTimeout);
        checkTimeout = setTimeout(checkLiveContentSafety, 400);
    });

    async function checkLiveContentSafety() {
        const text = postContent.value.trim();
        if (!text) {
            safetyIndicator.className = 'safety-indicator';
            safetyStatusText.textContent = 'Clean';
            return;
        }

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();

            if (data.status === 'clean') {
                safetyIndicator.className = 'safety-indicator';
                safetyStatusText.textContent = 'Clean & Safe';
            } else if (data.status === 'bad_word') {
                safetyIndicator.className = 'safety-indicator danger';
                safetyStatusText.textContent = `Offensive language detected ('${data.detected_words.join(', ')}')`;
            } else if (data.status === 'crisis') {
                safetyIndicator.className = 'safety-indicator danger';
                safetyStatusText.textContent = 'Emotional Distress / Crisis detected';
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handlePostSubmit() {
        const content = postContent.value.trim();
        const mood_tag = postMoodTag.value;
        const feed_type = postFeedType.value;

        if (!content) {
            showToast('Please enter your thought before posting.', 'error');
            return;
        }

        if (feed_type === 'private' && !state.token) {
            showToast('Please login to post in the Private Sector.', 'error');
            openAuthModal('login');
            return;
        }

        submitPostBtn.disabled = true;
        submitPostBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking Safety...';

        try {
            const endpoint = feed_type === 'private' ? '/api/posts/private' : '/api/posts/public';
            const headers = { 'Content-Type': 'application/json' };
            if (state.token) {
                headers['Authorization'] = `Bearer ${state.token}`;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    content: content,
                    mood_tag: mood_tag,
                    alias: state.alias || 'Anonymous Friend'
                })
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.reason === 'profanity_detected') {
                    showToast(data.message, 'error');
                } else if (data.reason === 'crisis_detected') {
                    postModal.classList.add('hidden');
                    openCrisisModal(data.resources);
                } else {
                    showToast(data.detail || 'Failed to submit post.', 'error');
                }
                return;
            }

            showToast('Thought posted anonymously!', 'success');
            postModal.classList.add('hidden');
            loadFeed();

        } catch (err) {
            showToast('Network error while posting.', 'error');
        } finally {
            submitPostBtn.disabled = false;
            submitPostBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Post Anonymously';
        }
    }

    function openCrisisModal(resources) {
        helplinesContainer.innerHTML = '';
        if (resources && resources.contacts) {
            resources.contacts.forEach(c => {
                const card = document.createElement('div');
                card.className = 'helpline-card';
                card.innerHTML = `
                    <h5>${c.name}</h5>
                    <p>${c.number || c.website}</p>
                `;
                helplinesContainer.appendChild(card);
            });
        }
        crisisModal.classList.remove('hidden');
    }

    closeCrisisBtn.addEventListener('click', () => crisisModal.classList.add('hidden'));
    crisisMindBotBtn.addEventListener('click', () => {
        crisisModal.classList.add('hidden');
        openMindBot();
    });

    let currentAuthMode = 'login';
    function openAuthModal(mode) {
        setAuthTab(mode);
        authErrorMsg.classList.add('hidden');
        authModal.classList.remove('hidden');
    }

    function setAuthTab(mode) {
        currentAuthMode = mode;
        if (mode === 'login') {
            document.getElementById('authTabLogin').classList.add('active');
            document.getElementById('authTabRegister').classList.remove('active');
            document.getElementById('authModalTitle').innerHTML = '<i class="fa-solid fa-user-shield"></i> Anonymous Login';
            authSubmitBtn.textContent = 'Login';
        } else {
            document.getElementById('authTabRegister').classList.add('active');
            document.getElementById('authTabLogin').classList.remove('active');
            document.getElementById('authModalTitle').innerHTML = '<i class="fa-solid fa-user-plus"></i> Join Anonymously';
            authSubmitBtn.textContent = 'Create Profile';
        }
    }

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alias = authAliasInput.value.trim();
        const password = authPasswordInput.value;

        const endpoint = currentAuthMode === 'register' ? '/api/auth/register' : '/api/auth/login';
        authSubmitBtn.disabled = true;

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alias, password })
            });
            const data = await res.json();

            if (!res.ok) {
                authErrorMsg.textContent = data.detail || 'Authentication failed.';
                authErrorMsg.classList.remove('hidden');
                return;
            }

            state.token = data.token;
            state.alias = data.alias;
            localStorage.setItem('mindspace_token', data.token);
            localStorage.setItem('mindspace_alias', data.alias);

            showToast(`Welcome back, ${data.alias}!`, 'success');
            authModal.classList.add('hidden');
            updateAuthUI();
            loadFeed();

        } catch (err) {
            authErrorMsg.textContent = 'Server connection error.';
            authErrorMsg.classList.remove('hidden');
        } finally {
            authSubmitBtn.disabled = false;
        }
    });

    function handleLogout() {
        state.token = null;
        state.alias = null;
        localStorage.removeItem('mindspace_token');
        localStorage.removeItem('mindspace_alias');
        updateAuthUI();
        showToast('Logged out of anonymous session.', 'success');
        if (state.currentFeed === 'private') {
            switchFeed('public');
        }
    }

    function updateAuthUI() {
        if (state.token && state.alias) {
            loggedOutState.classList.add('hidden');
            loggedInState.classList.remove('hidden');
            userAliasText.textContent = state.alias;
        } else {
            loggedOutState.classList.remove('hidden');
            loggedInState.classList.add('hidden');
        }
    }

    function switchFeed(type) {
        state.currentFeed = type;
        if (type === 'public') {
            tabPublicBtn.classList.add('active');
            tabPrivateBtn.classList.remove('active');
            navPublicTab.classList.add('active');
            navPrivateTab.classList.remove('active');
            privateGateBanner.classList.add('hidden');
        } else {
            tabPrivateBtn.classList.add('active');
            tabPublicBtn.classList.remove('active');
            navPrivateTab.classList.add('active');
            navPublicTab.classList.remove('active');

            if (!state.token) {
                privateGateBanner.classList.remove('hidden');
                postsContainer.innerHTML = '';
                return;
            } else {
                privateGateBanner.classList.add('hidden');
            }
        }
        loadFeed();
    }

    async function loadFeed() {
        if (state.currentFeed === 'private' && !state.token) {
            privateGateBanner.classList.remove('hidden');
            postsContainer.innerHTML = '';
            return;
        }

        postsContainer.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Fetching thoughts...</div>';

        try {
            const endpoint = state.currentFeed === 'private' ? '/api/posts/private' : '/api/posts/public';
            const headers = {};
            if (state.token) {
                headers['Authorization'] = `Bearer ${state.token}`;
            }

            const res = await fetch(endpoint, { headers });
            if (!res.ok) {
                if (res.status === 401) {
                    privateGateBanner.classList.remove('hidden');
                    postsContainer.innerHTML = '';
                    return;
                }
                postsContainer.innerHTML = '<div class="error-msg">Failed to load feed posts.</div>';
                return;
            }

            state.posts = await res.json();
            renderPosts();
        } catch (err) {
            postsContainer.innerHTML = '<div class="error-msg">Network error loading feed.</div>';
        }
    }

    function renderPosts() {
        let filtered = state.posts;
        if (state.activeMood !== 'All') {
            filtered = filtered.filter(p => p.mood_tag === state.activeMood);
        }

        if (filtered.length === 0) {
            postsContainer.innerHTML = '<div class="empty-state" style="text-align:center; padding: 3rem; color: #94a3b8;"><i class="fa-solid fa-wind" style="font-size: 2.5rem; margin-bottom: 1rem;"></i><p>No thoughts shared in this mood tag yet. Be the first!</p></div>';
            return;
        }

        postsContainer.innerHTML = '';
        filtered.forEach(post => {
            const card = document.createElement('div');
            card.className = 'post-card';
            
            const initials = (post.author_alias || 'A').substring(0, 2).toUpperCase();
            const timeAgo = formatTimeAgo(post.created_at);

            card.innerHTML = `
                <div class="post-header">
                    <div class="author-info">
                        <div class="avatar-circle">${initials}</div>
                        <div>
                            <div class="author-alias">${escapeHtml(post.author_alias)}</div>
                            <div class="post-time">${timeAgo}</div>
                        </div>
                    </div>
                    <span class="mood-tag-badge">${escapeHtml(post.mood_tag || 'Venting')}</span>
                </div>
                <div class="post-body">
                    ${escapeHtml(post.content)}
                </div>

                <div class="analysis-box">
                    <strong>🧠 AI Mental Analysis</strong>

                    <p><b>Emotion:</b> ${post.analysis?.emotion || "Neutral"}</p>

                    <p><b>Stress:</b> ${post.analysis?.stress_level || "Low"}</p>

                    <p><b>Risk:</b> ${post.analysis?.risk_level || "Safe"}</p>

                    <p><b>Recommendation:</b>
                        ${post.analysis?.recommendation || "Keep sharing your thoughts."}
                    </p>
                </div>
                <div class="post-footer">
                    <button class="reaction-btn hug-btn" data-id="${post.id}" data-type="hug">
                        <i class="fa-solid fa-heart-crack"></i> Send Hug (${post.hugs_count})
                    </button>
                    <button class="reaction-btn feel-btn" data-id="${post.id}" data-type="feel">
                        <i class="fa-solid fa-hand-holding-heart"></i> I Feel You (${post.feels_count})
                    </button>
                </div>
            `;

            postsContainer.appendChild(card);
        });

        document.querySelectorAll('.reaction-btn').forEach(btn => {
            btn.addEventListener('click', handleReaction);
        });
    }

    async function handleReaction(e) {
        const btn = e.currentTarget;
        const postId = btn.dataset.id;
        const type = btn.dataset.type;

        btn.disabled = true;
        try {
            const res = await fetch(`/api/posts/${postId}/react?reaction=${type}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                const targetPost = state.posts.find(p => p.id == postId);
                if (targetPost) {
                    targetPost.hugs_count = data.hugs;
                    targetPost.feels_count = data.feels;
                }
                renderPosts();
            }
        } catch (err) {
            console.error(err);
        }
    }

    function openMindBot() {
        mindbotDrawer.classList.remove('hidden');
    }

    mindbotTrigger.addEventListener('click', openMindBot);
    openMindBotNavBtn.addEventListener('click', openMindBot);
    heroMindBotBtn.addEventListener('click', openMindBot);
    closeMindBotBtn.addEventListener('click', () => mindbotDrawer.classList.add('hidden'));

    sendMindBotMsgBtn.addEventListener('click', sendMindBotMessage);
    mindbotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMindBotMessage();
    });

    async function sendMindBotMessage() {
        const text = mindbotInput.value.trim();
        if (!text) return;

        appendChatBubble(text, 'user');
        mindbotInput.value = '';

        try {
            const res = await fetch('/api/chat/mindbot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();

            console.log(data);

            if (data.reply) {
                appendChatBubble(data.reply, 'bot');
            } else {
                appendChatBubble("Sorry, I couldn't understand.", "bot");
            }

            if (data.analysis && data.analysis.status === 'crisis') {
                openCrisisModal(data.analysis.resources);
            }
        } catch (err) {
            appendChatBubble("I'm having a brief connection issue, but I'm still here with you.", 'bot');
        }
    }

    function appendChatBubble(text, sender) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${sender}-bubble`;
        bubble.textContent = text;
        mindbotMessages.appendChild(bubble);
        mindbotMessages.scrollTop = mindbotMessages.scrollHeight;
    }

    openFeedbackBtn.addEventListener('click', () => feedbackModal.classList.remove('hidden'));
    closeFeedbackModalBtn.addEventListener('click', () => feedbackModal.classList.add('hidden'));
    cancelFeedbackBtn.addEventListener('click', () => feedbackModal.classList.add('hidden'));

    starRating.addEventListener('click', (e) => {
        if (e.target.classList.contains('star')) {
            state.rating = parseInt(e.target.dataset.rating);
            document.querySelectorAll('#starRating .star').forEach(star => {
                const r = parseInt(star.dataset.rating);
                star.classList.toggle('active', r <= state.rating);
            });
        }
    });

    submitFeedbackBtn.addEventListener('click', async () => {
        const message = document.getElementById('feedbackMsg').value.trim();
        if (!message) {
            showToast('Please enter your feedback thoughts.', 'error');
            return;
        }

        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rating: state.rating,
                    message: message,
                    alias: state.alias || 'Anonymous Guest'
                })
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message, 'success');
                feedbackModal.classList.add('hidden');
                document.getElementById('feedbackMsg').value = '';
            }
        } catch (err) {
            showToast('Failed to submit feedback.', 'error');
        }
    });

    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fa-circle-info';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'error') icon = 'fa-circle-exclamation';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 4000);
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, "&amp;")
                           .replace(/</g, "&lt;")
                           .replace(/>/g, "&gt;")
                           .replace(/"/g, "&quot;")
                           .replace(/'/g, "&#039;");
    }

    function formatTimeAgo(isoString) {
        if (!isoString) return 'just now';
        const date = new Date(isoString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }
});
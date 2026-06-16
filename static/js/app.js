document.addEventListener('DOMContentLoaded', () => {
    // State management
    let releaseNotes = [];
    let filteredNotes = [];
    let activeFilters = new Set(['All']);
    let searchQuery = '';
    let currentSelectedNote = null;
    let modalTriggerElement = null;
    const itemsPerPage = 15;
    let visibleCount = itemsPerPage;

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const exportBtn = document.getElementById('export-btn');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeText = document.getElementById('theme-text');
    const sunIcon = document.querySelector('.theme-icon-sun');
    const moonIcon = document.querySelector('.theme-icon-moon');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const backToTopBtn = document.getElementById('back-to-top-btn');
    const typeFiltersContainer = document.getElementById('type-filters');
    const statsText = document.getElementById('stats-text');
    const sourceBadge = document.getElementById('source-badge');
    const feedList = document.getElementById('feed-list');
    const paginationContainer = document.getElementById('pagination-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    
    // State wrappers
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMsg = document.getElementById('error-msg');
    const emptyState = document.getElementById('empty-state');
    const retryBtn = document.getElementById('retry-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');

    // Modal elements
    const tweetModal = document.getElementById('tweet-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const sourceUpdateText = document.getElementById('source-update-text');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');
    const charWarning = document.getElementById('char-warning');
    const copyTweetBtn = document.getElementById('copy-tweet-btn');
    const sendTweetBtn = document.getElementById('send-tweet-btn');
    const hashtagChips = document.querySelectorAll('.hashtag-chip');

    // Toast
    const toast = document.getElementById('toast');

    // Initialize application
    initTheme();
    fetchReleaseNotes();

    // Event Listeners
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    exportBtn.addEventListener('click', exportToCSV);
    themeToggleBtn.addEventListener('click', toggleTheme);
    retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    resetFiltersBtn.addEventListener('click', resetFilters);
    
    loadMoreBtn.addEventListener('click', () => {
        const oldVisibleCount = visibleCount;
        visibleCount += itemsPerPage;
        filterAndRender(true, oldVisibleCount);
    });
    
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        if (searchQuery) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
        visibleCount = itemsPerPage;
        filterAndRender();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        visibleCount = itemsPerPage;
        filterAndRender();
        searchInput.focus();
    });

    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            backToTopBtn.classList.remove('hidden');
        } else {
            backToTopBtn.classList.add('hidden');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Close Modal Events
    closeModalBtn.addEventListener('click', hideTweetModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) hideTweetModal();
    });

    // Modal Character Counter & Validation
    tweetTextarea.addEventListener('input', updateCharCount);

    // Hashtag helpers
    hashtagChips.forEach(chip => {
        chip.setAttribute('tabindex', '0');
        chip.setAttribute('role', 'button');
        chip.setAttribute('aria-label', `Add hashtag ${chip.getAttribute('data-tag')}`);
        chip.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                chip.click();
            }
        });
        chip.addEventListener('click', () => {
            const hashtag = chip.getAttribute('data-tag');
            let text = tweetTextarea.value;
            
            if (!text.includes(hashtag)) {
                // Add space if needed
                if (text.length > 0 && !text.endsWith(' ')) {
                    text += ' ';
                }
                text += hashtag;
                tweetTextarea.value = text;
                updateCharCount();
                showToast(`Added ${hashtag}`);
            } else {
                showToast(`${hashtag} is already added`);
            }
        });
    });

    // Copy to Clipboard Action
    copyTweetBtn.addEventListener('click', (e) => {
        const text = tweetTextarea.value;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard!');
            const btn = e.currentTarget;
            const span = btn.querySelector('span');
            const origText = span.textContent;
            span.textContent = 'Copied!';
            btn.disabled = true;
            setTimeout(() => {
                span.textContent = origText;
                btn.disabled = false;
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy to clipboard.');
        });
    });

    // Post to Twitter Action
    sendTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
        hideTweetModal();
    });

    // Fetch Release Notes
    function fetchReleaseNotes(forceRefresh = false) {
        showState('loading');
        if (forceRefresh) {
            refreshBtn.classList.add('refreshing');
            refreshBtn.disabled = true;
        }

        const url = forceRefresh ? '/api/release-notes?refresh=true' : '/api/release-notes';

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`Server returned status ${res.status}`);
                return res.json();
            })
            .then(res => {
                if (res.status === 'success') {
                    releaseNotes = res.data;
                    
                    // Show source badge (Live or Cache fallback)
                    if (res.source) {
                        sourceBadge.textContent = res.source === 'live' ? 'Live Feed' : 'Cached';
                        sourceBadge.className = `badge badge-type ${res.source === 'live' ? 'badge-notice' : 'badge-general'}`;
                        sourceBadge.classList.remove('hidden');
                    }

                    // Populate filters
                    generateFilterButtons();
                    
                    // Reset pagination
                    visibleCount = itemsPerPage;
                    
                    // Filter and Render
                    filterAndRender();
                } else {
                    throw new Error(res.message || 'Unknown server error');
                }
            })
            .catch(err => {
                console.error(err);
                errorMsg.textContent = err.message || 'Failed to fetch release notes feed.';
                showState('error');
            })
            .finally(() => {
                if (forceRefresh) {
                    refreshBtn.classList.remove('refreshing');
                    refreshBtn.disabled = false;
                }
            });
    }

    // Generate Filter Tags based on data
    function generateFilterButtons() {
        // Find unique types
        const types = new Set(['All']);
        releaseNotes.forEach(note => {
            if (note.type) {
                types.add(note.type);
            }
        });

        typeFiltersContainer.innerHTML = '';
        types.forEach(type => {
            const chip = document.createElement('span');
            chip.className = `tag-chip ${activeFilters.has(type) ? 'active' : ''}`;
            chip.setAttribute('data-type', type);
            chip.setAttribute('tabindex', '0');
            chip.setAttribute('role', 'button');
            chip.setAttribute('aria-pressed', activeFilters.has(type) ? 'true' : 'false');
            chip.textContent = type;
            
            chip.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    chip.click();
                }
            });

            chip.addEventListener('click', () => {
                if (type === 'All') {
                    activeFilters.clear();
                    activeFilters.add('All');
                } else {
                    activeFilters.delete('All');
                    if (activeFilters.has(type)) {
                        activeFilters.delete(type);
                    } else {
                        activeFilters.add(type);
                    }
                    if (activeFilters.size === 0) {
                        activeFilters.add('All');
                    }
                }
                visibleCount = itemsPerPage;
                generateFilterButtons();
                filterAndRender();
            });

            typeFiltersContainer.appendChild(chip);
        });
    }

    // Filter and Render Feed
    function filterAndRender(keepFocus = false, oldVisibleCount = 0) {
        let filtered = releaseNotes;

        // Apply type filter
        if (!activeFilters.has('All')) {
            filtered = filtered.filter(note => activeFilters.has(note.type));
        }

        // Apply search query
        if (searchQuery) {
            filtered = filtered.filter(note => {
                return note.date.toLowerCase().includes(searchQuery) ||
                       note.type.toLowerCase().includes(searchQuery) ||
                       note.content_text.toLowerCase().includes(searchQuery);
            });
        }

        filteredNotes = filtered;

        // Render feed items
        if (filtered.length === 0) {
            showState('empty');
            paginationContainer.classList.add('hidden');
        } else {
            showState('feed');
            
            // Slice the notes based on pagination
            const notesToRender = filtered.slice(0, visibleCount);
            renderFeed(notesToRender);
            
            // Show or hide "Load More" button
            if (filtered.length > visibleCount) {
                paginationContainer.classList.remove('hidden');
                statsText.textContent = `Showing ${notesToRender.length} of ${filtered.length} updates (total ${releaseNotes.length})`;
            } else {
                paginationContainer.classList.add('hidden');
                statsText.textContent = `Showing ${filtered.length} of ${releaseNotes.length} updates`;
            }
            
            if (keepFocus && oldVisibleCount > 0) {
                const cards = feedList.querySelectorAll('.card');
                if (cards[oldVisibleCount]) {
                    cards[oldVisibleCount].setAttribute('tabindex', '-1');
                    cards[oldVisibleCount].focus();
                    cards[oldVisibleCount].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }
    }

    // Render Cards in DOM
    function renderFeed(notes) {
        feedList.innerHTML = '';
        
        notes.forEach(note => {
            const typeClass = `card-${note.type.toLowerCase().replace(/\s+/g, '-')}`;
            const badgeClass = `badge-${note.type.toLowerCase().replace(/\s+/g, '-')}`;
            
            const card = document.createElement('article');
            card.className = `card ${typeClass}`;
            
            // Format HTML body slightly if needed (ensure spacing etc)
            let bodyContent = note.content_html;
            
            const isLong = note.content_text && note.content_text.length > 300;
            const bodyHtml = isLong 
                ? `<div class="card-body collapsible-content">
                       ${bodyContent}
                       <div class="card-body-fade"></div>
                   </div>
                   <button class="btn-read-more" title="Expand release note content" aria-expanded="false">
                       <span>Read More</span>
                       <svg xmlns="http://www.w3.org/2005/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.3s ease; display: inline-block; vertical-align: middle; margin-left: 2px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                   </button>`
                : `<div class="card-body">
                       ${bodyContent}
                   </div>`;

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <span class="badge badge-type ${badgeClass}">${note.type}</span>
                        <span class="card-date">${note.date}</span>
                    </div>
                    <a href="${note.link}" class="badge badge-info" target="_blank" rel="noopener noreferrer">Source Link</a>
                </div>
                ${bodyHtml}
                <div class="card-footer">
                    <button class="btn btn-card-copy" title="Copy update text to clipboard">
                        <svg xmlns="http://www.w3.org/2005/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        <span>Copy Update</span>
                    </button>
                    <button class="btn btn-card-tweet" title="Share this release note">
                        <svg class="twitter-logo" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet Update</span>
                    </button>
                </div>
            `;
            
            // Add copy button listener
            card.querySelector('.btn-card-copy').addEventListener('click', (e) => {
                const textToCopy = `[${note.type}] BigQuery (${note.date}): ${note.content_text}\nSource: ${note.link}`;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showToast('Copied to clipboard!');
                    const btn = e.currentTarget;
                    const span = btn.querySelector('span');
                    const origText = span.textContent;
                    span.textContent = 'Copied!';
                    btn.disabled = true;
                    setTimeout(() => {
                        span.textContent = origText;
                        btn.disabled = false;
                    }, 1500);
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                    showToast('Failed to copy to clipboard.');
                });
            });

            // Add expand/collapse listener if long content
            if (isLong) {
                const readMoreBtn = card.querySelector('.btn-read-more');
                const readMoreSvg = readMoreBtn.querySelector('svg');
                const readMoreText = readMoreBtn.querySelector('span');
                readMoreBtn.addEventListener('click', () => {
                    const isExpanded = card.classList.toggle('expanded');
                    readMoreBtn.setAttribute('aria-expanded', isExpanded);
                    readMoreText.textContent = isExpanded ? 'Read Less' : 'Read More';
                    readMoreSvg.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
                });
            }

            // Add tweet button listener
            card.querySelector('.btn-card-tweet').addEventListener('click', () => {
                showTweetModal(note);
            });

            feedList.appendChild(card);
        });
    }

    // UI Helper to switch display states
    function showState(state) {
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        emptyState.classList.add('hidden');
        feedList.classList.add('hidden');

        if (state === 'loading') {
            loadingState.classList.remove('hidden');
        } else if (state === 'error') {
            errorState.classList.remove('hidden');
        } else if (state === 'empty') {
            emptyState.classList.remove('hidden');
        } else if (state === 'feed') {
            feedList.classList.remove('hidden');
        }
    }

    // Reset Filters
    function resetFilters() {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        
        activeFilters.clear();
        activeFilters.add('All');
        generateFilterButtons();
        
        visibleCount = itemsPerPage;
        filterAndRender();
    }

    // Export current filtered list to CSV
    function exportToCSV() {
        if (!filteredNotes || filteredNotes.length === 0) {
            showToast('No notes available to export.');
            return;
        }

        // CSV Header
        const headers = ['ID', 'Date', 'Updated', 'Type', 'Link', 'Content (Text)'];
        
        // Escape CSV values helper
        const escapeCSV = (val) => {
            if (val === null || val === undefined) return '';
            let stringVal = val.toString().trim();
            // Escape double quotes by doubling them
            if (stringVal.includes('"') || stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('\r')) {
                stringVal = `"${stringVal.replace(/"/g, '""')}"`;
            }
            return stringVal;
        };

        const csvRows = [
            headers.join(','),
            ...filteredNotes.map(note => [
                note.id,
                note.date,
                note.updated,
                note.type,
                note.link,
                note.content_text
            ].map(escapeCSV).join(','))
        ];

        const csvContent = csvRows.join('\r\n');
        
        try {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const sanitizedFilter = Array.from(activeFilters).map(f => f.toLowerCase().replace(/\s+/g, '-')).join('-');
            const dateStr = new Date().toISOString().slice(0, 10);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `bigquery_release_notes_${sanitizedFilter}_${dateStr}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast('Exported filtered notes to CSV!');
        } catch (err) {
            console.error('Failed to export CSV: ', err);
            showToast('Failed to export CSV.');
        }
    }

    // Focus Trapping and Escape Key Handler for Modal
    function onModalKeyDown(e) {
        if (e.key === 'Escape') {
            hideTweetModal();
            return;
        }
        
        if (e.key === 'Tab') {
            const focusables = Array.from(tweetModal.querySelectorAll('button, textarea, [tabindex="0"]'))
                .filter(el => !el.classList.contains('hidden') && el.offsetParent !== null);
            
            if (focusables.length === 0) return;
            
            const firstEl = focusables[0];
            const lastEl = focusables[focusables.length - 1];
            
            if (e.shiftKey) { // Shift + Tab
                if (document.activeElement === firstEl) {
                    lastEl.focus();
                    e.preventDefault();
                }
            } else { // Tab
                if (document.activeElement === lastEl) {
                    firstEl.focus();
                    e.preventDefault();
                }
            }
        }
    }

    // Tweet Modal Logic
    function showTweetModal(note) {
        modalTriggerElement = document.activeElement;
        currentSelectedNote = note;
        
        // Display source preview snippet
        let snippet = note.content_text;
        if (snippet.length > 150) {
            snippet = snippet.substring(0, 147) + '...';
        }
        sourceUpdateText.textContent = `"[${note.type}] ${snippet}"`;
        
        // Construct standard starting tweet
        // Structure: 🆕 [Type] BigQuery (Date): ShortText... #BigQuery #GoogleCloud Link
        const baseTags = ' #BigQuery #GoogleCloud';
        const linkStr = ` ${note.link}`;
        const headerText = `🆕 [${note.type}] BigQuery (${note.date}): `;
        
        // Calculate maximum room left for original content text
        const maxContentLength = 280 - headerText.length - baseTags.length - linkStr.length - 4; // -4 for margin/ellipses
        
        let noteContent = note.content_text;
        if (noteContent.length > maxContentLength) {
            noteContent = noteContent.substring(0, maxContentLength - 3) + '...';
        }
        
        const defaultTweet = `${headerText}${noteContent}${baseTags}${linkStr}`;
        
        tweetTextarea.value = defaultTweet;
        updateCharCount();
        
        tweetModal.classList.remove('hidden');
        tweetTextarea.focus();
        document.addEventListener('keydown', onModalKeyDown);
    }

    function hideTweetModal() {
        document.removeEventListener('keydown', onModalKeyDown);
        tweetModal.classList.add('hidden');
        currentSelectedNote = null;
        if (modalTriggerElement) {
            modalTriggerElement.focus();
        }
    }

    function updateCharCount() {
        const text = tweetTextarea.value;
        const count = text.length;
        charCounter.textContent = `${count} / 280`;
        
        if (count > 280 || count === 0) {
            charCounter.classList.add('error');
            charWarning.classList.remove('hidden');
            sendTweetBtn.disabled = true;
        } else {
            charCounter.classList.remove('error');
            charWarning.classList.add('hidden');
            sendTweetBtn.disabled = false;
        }
    }

    // Initialize Theme from localStorage
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
            themeToggleBtn.setAttribute('aria-pressed', 'true');
            themeToggleBtn.setAttribute('aria-label', 'Switch to Dark Theme');
            if (themeText) themeText.textContent = 'Light Mode';
        } else {
            document.body.classList.remove('light-theme');
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
            themeToggleBtn.setAttribute('aria-pressed', 'false');
            themeToggleBtn.setAttribute('aria-label', 'Switch to Light Theme');
            if (themeText) themeText.textContent = 'Dark Mode';
        }
    }

    // Toggle Theme handler
    function toggleTheme() {
        const isLightTheme = document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', isLightTheme ? 'light' : 'dark');
        
        if (isLightTheme) {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
            themeToggleBtn.setAttribute('aria-pressed', 'true');
            themeToggleBtn.setAttribute('aria-label', 'Switch to Dark Theme');
            if (themeText) themeText.textContent = 'Light Mode';
            showToast('Swapped to Light Theme');
        } else {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
            themeToggleBtn.setAttribute('aria-pressed', 'false');
            themeToggleBtn.setAttribute('aria-label', 'Switch to Light Theme');
            if (themeText) themeText.textContent = 'Dark Mode';
            showToast('Swapped to Dark Theme');
        }
    }

    // Toast Notification helper
    let toastTimeout = null;
    function showToast(message) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 2500);
    }
});

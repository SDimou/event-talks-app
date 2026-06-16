document.addEventListener('DOMContentLoaded', () => {
    // State management
    let releaseNotes = [];
    let filteredNotes = [];
    let activeFilter = 'All';
    let searchQuery = '';
    let currentSelectedNote = null;

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const exportBtn = document.getElementById('export-btn');
    const searchInput = document.getElementById('search-input');
    const typeFiltersContainer = document.getElementById('type-filters');
    const statsText = document.getElementById('stats-text');
    const sourceBadge = document.getElementById('source-badge');
    const feedList = document.getElementById('feed-list');
    
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
    fetchReleaseNotes();

    // Event Listeners
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    exportBtn.addEventListener('click', exportToCSV);
    retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    resetFiltersBtn.addEventListener('click', resetFilters);
    
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        filterAndRender();
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
    copyTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard!');
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
            chip.className = `tag-chip ${type === activeFilter ? 'active' : ''}`;
            chip.setAttribute('data-type', type);
            chip.textContent = type;
            
            chip.addEventListener('click', () => {
                document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                activeFilter = type;
                filterAndRender();
            });

            typeFiltersContainer.appendChild(chip);
        });
    }

    // Filter and Render Feed
    function filterAndRender() {
        let filtered = releaseNotes;

        // Apply type filter
        if (activeFilter !== 'All') {
            filtered = filtered.filter(note => note.type === activeFilter);
        }

        // Apply search query
        if (searchQuery) {
            filtered = filtered.filter(note => {
                return note.date.toLowerCase().includes(searchQuery) ||
                       note.type.toLowerCase().includes(searchQuery) ||
                       note.content_text.toLowerCase().includes(searchQuery);
            });
        }

        // Update stats
        statsText.textContent = `Showing ${filtered.length} of ${releaseNotes.length} updates`;

        filteredNotes = filtered;

        // Render feed items
        if (filtered.length === 0) {
            showState('empty');
        } else {
            showState('feed');
            renderFeed(filtered);
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
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <span class="badge badge-type ${badgeClass}">${note.type}</span>
                        <span class="card-date">${note.date}</span>
                    </div>
                    <a href="${note.link}" class="badge badge-info" target="_blank" rel="noopener noreferrer">Source Link</a>
                </div>
                <div class="card-body">
                    ${bodyContent}
                </div>
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
            card.querySelector('.btn-card-copy').addEventListener('click', () => {
                const textToCopy = `[${note.type}] BigQuery (${note.date}): ${note.content_text}\nSource: ${note.link}`;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showToast('Copied to clipboard!');
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                    showToast('Failed to copy to clipboard.');
                });
            });

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
        activeFilter = 'All';
        
        // Reset category UI active class
        document.querySelectorAll('.tag-chip').forEach(c => {
            if (c.getAttribute('data-type') === 'All') {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });
        
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
            const sanitizedFilter = activeFilter.toLowerCase().replace(/\s+/g, '-');
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

    // Tweet Modal Logic
    function showTweetModal(note) {
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
    }

    function hideTweetModal() {
        tweetModal.classList.add('hidden');
        currentSelectedNote = null;
    }

    function updateCharCount() {
        const text = tweetTextarea.value;
        const count = text.length;
        charCounter.textContent = `${count} / 280`;
        
        if (count > 280) {
            charCounter.classList.add('error');
            charWarning.classList.remove('hidden');
        } else {
            charCounter.classList.remove('error');
            charWarning.classList.add('hidden');
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

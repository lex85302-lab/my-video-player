// === DOM Elements ===
const myPlayer = document.getElementById('myPlayer');
const playerContainer = document.getElementById('playerContainer');
const controlsOverlay = document.getElementById('controlsOverlay');
const lockOverlay = document.getElementById('lockOverlay');
const playPauseBtn = document.getElementById('playPauseBtn');
const seekBar = document.getElementById('seekBar');
const currentTimeDisplay = document.getElementById('currentTime');
const durationDisplay = document.getElementById('duration');
const currentVideoTitle = document.getElementById('currentVideoTitle');
const playlistEl = document.getElementById('playlist');
const folderSelect = document.getElementById('folderSelect');
const libraryModal = document.getElementById('libraryModal');
const settingsModal = document.getElementById('settingsModal');
const searchInput = document.getElementById('searchInput'); // Search Bar အသစ်

// === State ===
let videos = [];
let folders = JSON.parse(localStorage.getItem('videoFolders')) || [{ id: 'default', name: 'Default Folder' }];
let currentFolderId = folders.length > 0 ? folders[0].id : 'default';
let currentVideoId = null;
let controlsTimeout;
let isLocked = false;
let lastTap = 0;
let pressTimer;
let sleepTimer = null;
let db = null;
let wakeLock = null;

// Gesture state
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isSwiping = false;
let isVerticalSwipe = false;
let brightness = 1;
let currentScale = 1;
let initialDistance = 0;
let initialScale = 1;

// === IndexedDB Setup ===
const request = indexedDB.open('VideoPlayerDB', 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains('videos')) {
        db.createObjectStore('videos', { keyPath: 'id' });
    }
};
request.onsuccess = (e) => {
    db = e.target.result;
    loadVideos();
    initSettings();
};

// === Video Management ===
function loadVideos() {
    const transaction = db.transaction(['videos'], 'readonly');
    const store = transaction.objectStore('videos');
    const req = store.getAll();
    req.onsuccess = () => {
        videos = req.result;
        renderPlaylist();
        renderFolders();
    };
}

function saveVideoToDB(file) {
    return new Promise((resolve, reject) => {
        const id = file.name + '_' + file.size;
        const transaction = db.transaction(['videos'], 'readwrite');
        const store = transaction.objectStore('videos');
        const record = {
            id: id,
            name: file.name,
            blob: file,
            folderId: currentFolderId
        };
        const req = store.put(record);
        req.onsuccess = () => resolve(id);
        req.onerror = () => reject(req.error);
    });
}

function playVideo(id) {
    const transaction = db.transaction(['videos'], 'readonly');
    const store = transaction.objectStore('videos');
    const req = store.get(id);
    
    req.onsuccess = () => {
        const record = req.result;
        if (record) {
            if (myPlayer.src) {
                URL.revokeObjectURL(myPlayer.src);
            }
            myPlayer.src = URL.createObjectURL(record.blob);
            myPlayer.load();
            myPlayer.play().catch(e => console.log("Autoplay blocked:", e));
            
            currentVideoId = id;
            currentVideoTitle.textContent = record.name;
            
            libraryModal.classList.add('hidden');
            renderPlaylist();
            showControls();
        }
    };
}

function deleteVideo(id) {
    if (confirm("Are you sure you want to delete this video from the app?")) {
        const transaction = db.transaction(['videos'], 'readwrite');
        const store = transaction.objectStore('videos');
        store.delete(id);
        
        videos = videos.filter(v => v.id !== id);
        if (currentVideoId === id) {
            myPlayer.pause();
            myPlayer.src = '';
            currentVideoId = null;
            currentVideoTitle.textContent = 'No Video Selected';
        }
        renderPlaylist();
    }
}

function moveVideoToFolder(id) {
    const folderName = prompt("Enter folder name to move to (or create new):");
    if (!folderName) return;
    
    let folder = folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
    if (!folder) {
        folder = { id: 'folder_' + Date.now(), name: folderName };
        folders.push(folder);
        localStorage.setItem('videoFolders', JSON.stringify(folders));
        renderFolders();
    }
    
    const transaction = db.transaction(['videos'], 'readwrite');
    const store = transaction.objectStore('videos');
    const req = store.get(id);
    req.onsuccess = () => {
        const record = req.result;
        if (record) {
            record.folderId = folder.id;
            store.put(record);
            
            const index = videos.findIndex(v => v.id === id);
            if (index !== -1) videos[index].folderId = folder.id;
            
            renderPlaylist();
        }
    };
}

// === UI Rendering ===
function renderFolders() {
    folderSelect.innerHTML = '';
    folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        if (f.id === currentFolderId) opt.selected = true;
        folderSelect.appendChild(opt);
    });
}

function renderPlaylist() {
    playlistEl.innerHTML = '';
    const query = searchInput.value.toLowerCase(); // Search စာသားယူမယ်
    
    // Folder နဲ့ Search ၂ ခုလုံးနဲ့ ကိုက်ညီတာကို စစ်ထုတ်မယ်
    const filtered = videos.filter(v => 
        v.folderId === currentFolderId && 
        v.name.toLowerCase().includes(query)
    );
    
    filtered.forEach(v => {
        const li = document.createElement('li');
        li.className = v.id === currentVideoId ? 'active' : '';
        
        const span = document.createElement('span');
        span.className = 'video-info';
        span.textContent = v.name;
        span.onclick = () => playVideo(v.id);
        
        const actions = document.createElement('div');
        actions.className = 'video-actions';
        
        const moveBtn = document.createElement('button');
        moveBtn.className = 'icon-btn';
        moveBtn.textContent = '📁';
        moveBtn.onclick = (e) => { e.stopPropagation(); moveVideoToFolder(v.id); };
        
        const delBtn = document.createElement('button');
        delBtn.className = 'icon-btn';
        delBtn.textContent = '❌';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteVideo(v.id); };
        
        actions.appendChild(moveBtn);
        actions.appendChild(delBtn);
        li.appendChild(span);
        li.appendChild(actions);
        playlistEl.appendChild(li);
    });
}

// === Controls & Playback ===
playPauseBtn.addEventListener('click', () => {
    if (myPlayer.paused) myPlayer.play(); else myPlayer.pause();
});

myPlayer.addEventListener('play', () => {
    playPauseBtn.textContent = '⏸';
    requestWakeLock();
});

myPlayer.addEventListener('pause', () => {
    playPauseBtn.textContent = '▶️';
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
});

myPlayer.addEventListener('timeupdate', () => {
    if (!myPlayer.duration) return;
    const percent = (myPlayer.currentTime / myPlayer.duration) * 100;
    seekBar.value = percent;
    currentTimeDisplay.textContent = formatTime(myPlayer.currentTime);
    
    if (currentVideoId) {
        localStorage.setItem('resume_' + currentVideoId, myPlayer.currentTime);
    }
});

myPlayer.addEventListener('loadedmetadata', () => {
    durationDisplay.textContent = formatTime(myPlayer.duration);
    if (currentVideoId) {
        const savedTime = localStorage.getItem('resume_' + currentVideoId);
        if (savedTime) myPlayer.currentTime = parseFloat(savedTime);
    }
});

myPlayer.addEventListener('ended', () => {
    const filtered = videos.filter(v => v.folderId === currentFolderId);
    const currentIndex = filtered.findIndex(v => v.id === currentVideoId);
    if (currentIndex !== -1 && currentIndex < filtered.length - 1) {
        playVideo(filtered[currentIndex + 1].id);
    }
});

seekBar.addEventListener('input', () => {
    if (!myPlayer.duration) return;
    myPlayer.currentTime = (seekBar.value / 100) * myPlayer.duration;
});

document.getElementById('rewindBtn').addEventListener('click', () => {
    myPlayer.currentTime = Math.max(0, myPlayer.currentTime - 10);
});

document.getElementById('forwardBtn').addEventListener('click', () => {
    myPlayer.currentTime = Math.min(myPlayer.duration, myPlayer.currentTime + 10);
});

document.getElementById('nextBtn').addEventListener('click', () => {
    const filtered = videos.filter(v => v.folderId === currentFolderId);
    const currentIndex = filtered.findIndex(v => v.id === currentVideoId);
    if (currentIndex !== -1 && currentIndex < filtered.length - 1) {
        playVideo(filtered[currentIndex + 1].id);
    }
});

document.getElementById('prevBtn').addEventListener('click', () => {
    const filtered = videos.filter(v => v.folderId === currentFolderId);
    const currentIndex = filtered.findIndex(v => v.id === currentVideoId);
    if (currentIndex > 0) {
        playVideo(filtered[currentIndex - 1].id);
    }
});

function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// === Auto-hide Controls ===
function showControls() {
    controlsOverlay.classList.remove('hidden');
    controlsOverlay.classList.add('visible');
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => {
        if (!myPlayer.paused) {
            controlsOverlay.classList.remove('visible');
            controlsOverlay.classList.add('hidden');
        }
    }, 3000);
}

// === Gestures (Swipe, Double Tap, Long Press, Pinch) ===
playerContainer.addEventListener('touchstart', (e) => {
    if (isLocked) return;
    
    if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        isSwiping = false;
        isVerticalSwipe = false;
        
        pressTimer = setTimeout(() => {
            if (!isSwiping) {
                myPlayer.playbackRate = 2;
            }
        }, 500);
    } else if (e.touches.length === 2) {
        initialDistance = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
        );
        initialScale = currentScale;
    }
});

playerContainer.addEventListener('touchmove', (e) => {
    if (isLocked) return;
    clearTimeout(pressTimer);
    
    if (e.touches.length === 2) {
        const currentDistance = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
        );
        currentScale = initialScale * (currentDistance / initialDistance);
        currentScale = Math.max(1, Math.min(currentScale, 3));
        myPlayer.style.transform = `scale(${currentScale})`;
        return;
    }

    if (e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            isSwiping = true;
            isVerticalSwipe = false;
        } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
            isSwiping = true;
            isVerticalSwipe = true;
            
            if (touchStartX < window.innerWidth / 2) {
                const delta = -deltaY / (window.innerHeight / 2);
                brightness = Math.max(0.1, Math.min(1, brightness + delta));
                myPlayer.style.filter = `brightness(${brightness})`;
            } else {
                const delta = -deltaY / (window.innerHeight / 2);
                myPlayer.volume = Math.max(0, Math.min(1, myPlayer.volume + delta));
            }
        }
    }
});

playerContainer.addEventListener('touchend', (e) => {
    if (isLocked) return;
    clearTimeout(pressTimer);
    
    if (myPlayer.playbackRate === 2) {
        myPlayer.playbackRate = parseFloat(document.getElementById('speedSelect').value);
    }
    
    if (e.changedTouches.length === 1 && !isSwiping) {
        const touch = e.changedTouches[0];
        const now = Date.now();
        const timeDiff = now - touchStartTime;
        
        if (timeDiff < 300) {
            const tapLength = now - lastTap;
            if (tapLength < 300 && tapLength > 0) {
                // Double tap skip
                const rect = myPlayer.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                if (x < rect.width / 2) {
                    myPlayer.currentTime = Math.max(0, myPlayer.currentTime - 10);
                } else {
                    myPlayer.currentTime = Math.min(myPlayer.duration, myPlayer.currentTime + 10);
                }
                lastTap = 0;
            } else {
                // Single tap play/pause & show controls
                if (myPlayer.paused) { myPlayer.play(); } else { myPlayer.pause(); }
                showControls();
                lastTap = now;
            }
        }
    }
    
    if (isSwiping && !isVerticalSwipe && e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(deltaX) > 50) {
            const seekAmount = (deltaX / window.innerWidth) * 60;
            myPlayer.currentTime = Math.max(0, Math.min(myPlayer.duration, myPlayer.currentTime + seekAmount));
        }
    }
});

// === Screen Lock ===
document.getElementById('lockBtn').addEventListener('click', () => {
    isLocked = true;
    controlsOverlay.classList.add('hidden');
    controlsOverlay.classList.remove('visible');
    lockOverlay.classList.add('show');
});

lockOverlay.addEventListener('click', () => {
    isLocked = false;
    lockOverlay.classList.remove('show');
    showControls();
});

// === Modals ===
document.getElementById('openLibraryBtn').addEventListener('click', () => {
    searchInput.value = ''; // Library ဖွင့်တိုင်း Search ကို ရှင်းမယ်
    libraryModal.classList.remove('hidden');
    renderFolders();
    renderPlaylist();
});

document.getElementById('openSettingsBtn').addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
});

document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.getElementById(e.target.dataset.target).classList.add('hidden');
    });
});

// Search Bar Event
searchInput.addEventListener('input', renderPlaylist);

// === Folder Management ===
document.getElementById('addFolderBtn').addEventListener('click', () => {
    const name = prompt("Enter new folder name:");
    if (name) {
        const newFolder = { id: 'folder_' + Date.now(), name: name };
        folders.push(newFolder);
        localStorage.setItem('videoFolders', JSON.stringify(folders));
        renderFolders();
        folderSelect.value = newFolder.id;
        currentFolderId = newFolder.id;
        searchInput.value = ''; // Folder အသစ်ဖွင့်ရင် Search ရှင်းမယ်
        renderPlaylist();
    }
});

folderSelect.addEventListener('change', (e) => {
    currentFolderId = e.target.value;
    searchInput.value = ''; // Folder ပြောင်းရင် Search ရှင်းမယ်
    renderPlaylist();
});

// === File Selection ===
document.getElementById('selectVideoBtn').addEventListener('click', () => {
    document.getElementById('videoFile').click();
});

document.getElementById('videoFile').addEventListener('change', async (e) => {
    const files = e.target.files;
    for (let file of files) {
        await saveVideoToDB(file);
    }
    loadVideos();
    e.target.value = '';
});

// === Settings Configuration ===
function initSettings() {
    const savedTheme = localStorage.getItem('theme') || 'theme-dark';
    document.body.className = savedTheme;
    document.getElementById('themeSelect').value = savedTheme;
    
    const savedAspect = localStorage.getItem('aspect') || 'contain';
    myPlayer.style.objectFit = savedAspect;
    document.getElementById('aspectSelect').value = savedAspect;
    
    const savedSpeed = localStorage.getItem('speed') || '1';
    myPlayer.playbackRate = parseFloat(savedSpeed);
    document.getElementById('speedSelect').value = savedSpeed;
    
    const subSize = localStorage.getItem('subSize') || '20';
    const subColor = localStorage.getItem('subColor') || '#ffffff';
    const subBg = localStorage.getItem('subBg') || '#000000';
    
    document.getElementById('subSize').value = subSize;
    document.getElementById('subColor').value = subColor;
    document.getElementById('subBg').value = subBg;
    
    applySubtitleStyles();
}

document.getElementById('themeSelect').addEventListener('change', (e) => {
    document.body.className = e.target.value;
    localStorage.setItem('theme', e.target.value);
});

document.getElementById('aspectSelect').addEventListener('change', (e) => {
    myPlayer.style.objectFit = e.target.value;
    localStorage.setItem('aspect', e.target.value);
});

document.getElementById('speedSelect').addEventListener('change', (e) => {
    myPlayer.playbackRate = parseFloat(e.target.value);
    localStorage.setItem('speed', e.target.value);
});

document.getElementById('subSize').addEventListener('input', applySubtitleStyles);
document.getElementById('subColor').addEventListener('input', applySubtitleStyles);
document.getElementById('subBg').addEventListener('input', applySubtitleStyles);

function applySubtitleStyles() {
    const size = document.getElementById('subSize').value;
    const color = document.getElementById('subColor').value;
    const bg = document.getElementById('subBg').value;
    
    let styleTag = document.getElementById('subtitleStyles');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'subtitleStyles';
        document.head.appendChild(styleTag);
    }
    
    styleTag.textContent = `
        ::cue {
            font-size: ${size}px;
            color: ${color};
            background-color: ${bg};
        }
    `;
    localStorage.setItem('subSize', size);
    localStorage.setItem('subColor', color);
    localStorage.setItem('subBg', bg);
}

// === Subtitles ===
document.getElementById('loadSubtitleBtn').addEventListener('click', () => {
    document.getElementById('subtitleFile').click();
});

document.getElementById('subtitleFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        let content = ev.target.result;
        content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        content = content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        if (!content.startsWith('WEBVTT')) {
            content = "WEBVTT\n\n" + content;
        }
        
        const blob = new Blob([content], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);
        
        const existingTracks = myPlayer.querySelectorAll('track');
        existingTracks.forEach(t => t.remove());
        
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = 'Custom Subtitle';
        track.srclang = 'en';
        track.src = url;
        track.default = true;
        
        myPlayer.appendChild(track);
        track.track.mode = 'showing';
        
        alert("Subtitle loaded successfully!");
    };
    reader.readAsText(file);
    e.target.value = '';
});

// === Utilities (Sleep Timer, PiP, Fullscreen, Clear) ===
document.getElementById('sleepTimerSelect').addEventListener('change', (e) => {
    const minutes = parseInt(e.target.value);
    if (sleepTimer) clearTimeout(sleepTimer);
    
    if (minutes > 0) {
        sleepTimer = setTimeout(() => {
            myPlayer.pause();
            alert("Sleep timer ended: Video paused.");
            document.getElementById('sleepTimerSelect').value = '0';
        }, minutes * 60 * 1000);
    }
});

document.getElementById('pipBtn').addEventListener('click', async () => {
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (myPlayer.requestPictureInPicture) {
            await myPlayer.requestPictureInPicture();
        }
    } catch (error) {
        alert("PiP is not supported or failed.");
    }
});

document.getElementById('fullscreenBtn').addEventListener('click', () => {
    if (!document.fullscreenElement) {
        if (playerContainer.requestFullscreen) {
            playerContainer.requestFullscreen();
        }
    } else {
        document.exitFullscreen();
    }
});

document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    if (confirm("Clear all playback history?")) {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('resume_')) {
                localStorage.removeItem(key);
            }
        });
        alert("History cleared!");
    }
});

// === Wake Lock ===
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.log('Wake Lock error:', err);
    }
                     }
// === Folder Management Logic (For existing UI) ===

// Local Storage ကနေ Folder တွေကို ယူမယ်၊ မရှိသေးရင် Default Folder ပဲ ထည့်ထားမယ်
let userFolders = JSON.parse(localStorage.getItem('userFolders')) || [
    { id: 'default', name: 'Default Folder', videos: [] }
];

// Folder Dropdown ကို Update လုပ်တဲ့ Function
function updateFolderDropdown() {
    const select = document.getElementById('folderSelect'); // အကို့ HTML က select ID ကို ထည့်ပါ
    if (!select) return;

    // လက်ရှိ ရွေးထားတဲ့ Folder ကို မှတ်ထားမယ်
    const currentSelected = select.value; 
    
    // အဟောင်းတွေ ရှင်းမယ်
    select.innerHTML = ""; 

    // Folder တွေ အကုန် ပြန်ထည့်မယ်
    userFolders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = folder.name;
        select.appendChild(option);
    });

    // အရင် ရွေးထားတာ ရှိသေးရင် အဲဒါပဲ ပြန်ရွေးထားမယ်
    if (currentSelected) {
        select.value = currentSelected;
    }
}

// Folder အသစ် ဖန်တီးတဲ့ Function
function createFolder() {
    const folderName = prompt("Folder အသစ် နာမည် ထည့်ပါ:");
    
    if (!folderName || folderName.trim() === "") {
        return; // နာမည် မထည့်ရင် ဘာမှ မလုပ်ဘူး
    }

    // နာမည် တူနေလား စစ်မယ်
    const isExist = userFolders.some(f => f.name.toLowerCase() === folderName.toLowerCase());
    if (isExist) {
        alert("ဒီနာမည်နဲ့ Folder ရှိပြီးသားပါ။");
        return;
    }

    // Folder အသစ် Object ဆောက်မယ်
    const newFolder = {
        id: 'folder_' + Date.now(), // သီးသန့် ID
        name: folderName,
        videos: [] // ဗီဒီယိုတွေ ထည့်ဖို့ နေရာလွတ်
    };

    userFolders.push(newFolder);
    localStorage.setItem('userFolders', JSON.stringify(userFolders));
    
    updateFolderDropdown(); // Dropdown မှာ ချက်ချင်း ပေါ်လာအောင် လုပ်မယ်
    alert(`"${folderName}" Folder ဖန်တီးပြီးပါပြီ။`);
}

// Button တွေကို ချိတ်ဆက်ခြင်း (Event Listeners)
document.addEventListener('DOMContentLoaded', () => {
    // စဖွင့်ဖွင့်ချင်း Dropdown မှာ Folder တွေ ပေါ်အောင်
    updateFolderDropdown();

    // "+ Folder" ခလုတ်ကို နှိပ်ရင် createFolder အလုပ်လုပ်အောင်
    const addFolderBtn = document.getElementById('addFolderBtn'); // အကို့ HTML က button ID
    if (addFolderBtn) {
        addFolderBtn.addEventListener('click', createFolder);
    }
});

const videoFileInput = document.getElementById('videoFile');
const myPlayer = document.getElementById('myPlayer');
const playlist = document.getElementById('playlist');
const speedControl = document.getElementById('speedControl');
const themeToggle = document.getElementById('themeToggle');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const rewindBtn = document.getElementById('rewindBtn');
const forwardBtn = document.getElementById('forwardBtn');
const clearBtn = document.getElementById('clearBtn');
const pipBtn = document.getElementById('pipBtn');
const subtitleFileInput = document.getElementById('subtitleFile');
const fullscreenBtn = document.getElementById('fullscreenBtn');

let videoURLs = []; 
let videoFiles = [];
let currentVideoIndex = 0; 
let wakeLock = null; 

// မျက်နှာပြင် နှစ်ချက်နှိပ်တာကို ဖတ်ဖို့ အချိန်မှတ်တဲ့ ကုဒ်
let lastTap = 0;

videoFileInput.addEventListener('change', function(event) {
    const files = event.target.files; 
    playlist.innerHTML = ''; 
    videoURLs = []; 
    videoFiles = [];

    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileURL = URL.createObjectURL(file);
            videoURLs.push(fileURL); 
            videoFiles.push(file);
            
            const listItem = document.createElement('li');
            listItem.textContent = file.name;
            
            listItem.addEventListener('click', function() {
                playVideoByIndex(i);
            });

            playlist.appendChild(listItem);
        }
        playVideoByIndex(0);
    }
});

subtitleFileInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            let content = e.target.result;
            
            if (content.charCodeAt(0) === 0xFEFF) {
                content = content.slice(1);
            }

            if (file.name.toLowerCase().endsWith('.srt')) {
                content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                content = content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
                content = "WEBVTT\n\n" + content;
            }

            const blob = new Blob([content], { type: 'text/vtt' });
            const url = URL.createObjectURL(blob);
            
            const oldTracks = myPlayer.querySelectorAll('track');
            oldTracks.forEach(t => t.remove());

            const newTrack = document.createElement('track');
            newTrack.kind = 'subtitles';
            newTrack.label = 'Subtitle';
            newTrack.srclang = 'mm';
            newTrack.src = url;
            newTrack.default = true;
            
            myPlayer.appendChild(newTrack);
            
            setTimeout(() => {
                if (myPlayer.textTracks.length > 0) {
                    myPlayer.textTracks[0].mode = 'showing';
                }
            }, 100);
        };
        reader.readAsText(file);
    }
});

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.log(`Wake Lock Error: ${err.name}, ${err.message}`);
    }
}

function playVideoByIndex(index) {
    if (index >= 0 && index < videoURLs.length) {
        currentVideoIndex = index; 
        
        const fileName = videoFiles[index].name;
        const savedTime = localStorage.getItem('time_' + fileName);

        myPlayer.src = videoURLs[index];
        myPlayer.playbackRate = speedControl.value; 
        
        if (savedTime) {
            myPlayer.currentTime = parseFloat(savedTime);
        }

        myPlayer.play();
        requestWakeLock();

        const allItems = playlist.querySelectorAll('li');
        allItems.forEach((item, i) => {
            if (i === index) {
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }
}

// 🔥 မျက်နှာပြင် နှစ်ချက်နှိပ်ရင် ရှေ့/နောက် ရွှေ့တဲ့ စနစ် 🔥
myPlayer.addEventListener('click', function(e) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    
    // နှစ်ချက်နှိပ်တာ ဟုတ်/မဟုတ် စစ်ဆေးခြင်း (၃၀၀ မီလီစက္ကန့်အတွင်း နှိပ်ရမယ်)
    if (tapLength < 300 && tapLength > 0) {
        // နှိပ်လိုက်တဲ့ နေရာကို ရှာမယ်
        const rect = myPlayer.getBoundingClientRect();
        const x = e.clientX - rect.left; // Video ရဲ့ ဘယ်ဘက်ကနေ အကွာအဝေး
        
        // Video ရဲ့ ဘယ်ဘက်တစ်ဝက်လား၊ ညာဘက်တစ်ဝက်လား ခွဲခြားမယ်
        if (x < rect.width / 2) {
            // ဘယ်ဘက်ဆိုရင် ၁၀ စက္ကန့် နောက်ပြန်
            myPlayer.currentTime = Math.max(0, myPlayer.currentTime - 10);
        } else {
            // ညာဘက်ဆိုရင် ၁၀ စက္ကန့် ရှေ့သွား
            myPlayer.currentTime = Math.min(myPlayer.duration, myPlayer.currentTime + 10);
        }
        // နှစ်ချက်နှိပ်ပြီးရင် အချိန်ကို ပြန်စမယ်
        lastTap = 0; 
    } else {
        // တစ်ချက်ပဲ နှိပ်တယ်ဆိုရင် Play/Pause လုပ်မယ်
        if (myPlayer.paused) {
            myPlayer.play();
        } else {
            myPlayer.pause();
        }
        lastTap = currentTime;
    }
});

fullscreenBtn.addEventListener('click', function() {
    if (!document.fullscreenElement) {
        if (myPlayer.requestFullscreen) {
            myPlayer.requestFullscreen();
        } else if (myPlayer.webkitRequestFullscreen) { 
            myPlayer.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
});

myPlayer.addEventListener('pause', function() {
    if (videoFiles.length > 0 && videoFiles[currentVideoIndex]) {
        const fileName = videoFiles[currentVideoIndex].name;
        localStorage.setItem('time_' + fileName, myPlayer.currentTime);
    }
});

myPlayer.addEventListener('ended', function() {
    if (videoFiles.length > 0 && videoFiles[currentVideoIndex]) {
        const fileName = videoFiles[currentVideoIndex].name;
        localStorage.removeItem('time_' + fileName);
    }
    
    if (currentVideoIndex < videoURLs.length - 1) {
        playVideoByIndex(currentVideoIndex + 1);
    }
});

pipBtn.addEventListener('click', async function() {
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else {
            await myPlayer.requestPictureInPicture();
        }
    } catch (error) {
        alert("သင့်ဖုန်းရဲ့ Browser က PiP ကို မပံ့ပိုးထားပါဘူး။");
    }
});

prevBtn.addEventListener('click', function() {
    if (currentVideoIndex > 0) {
        playVideoByIndex(currentVideoIndex - 1);
    } else {
        alert("ဒါက ပထမဆုံး Video ပါ။");
    }
});

nextBtn.addEventListener('click', function() {
    if (currentVideoIndex < videoURLs.length - 1) {
        playVideoByIndex(currentVideoIndex + 1);
    } else {
        alert("ဒါက နောက်ဆုံး Video ပါ။");
    }
});

rewindBtn.addEventListener('click', function() {
    myPlayer.currentTime = Math.max(0, myPlayer.currentTime - 10);
});

forwardBtn.addEventListener('click', function() {
    myPlayer.currentTime = Math.min(myPlayer.duration, myPlayer.currentTime + 10);
});

clearBtn.addEventListener('click', function() {
    myPlayer.pause();
    
    if (videoFiles.length > 0 && videoFiles[currentVideoIndex]) {
        const fileName = videoFiles[currentVideoIndex].name;
        localStorage.removeItem('time_' + fileName);
    }

    myPlayer.removeAttribute('src');
    myPlayer.load(); 
    playlist.innerHTML = '';
    videoURLs = [];
    videoFiles = [];
    currentVideoIndex = 0;
    videoFileInput.value = ''; 
    subtitleFileInput.value = '';
});

speedControl.addEventListener('change', function() {
    myPlayer.playbackRate = this.value;
});

themeToggle.addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
    if(document.body.classList.contains('dark-mode')) {
        themeToggle.textContent = '☀️ Light Mode';
    } else {
        themeToggle.textContent = '🌙 Dark Mode';
    }
});

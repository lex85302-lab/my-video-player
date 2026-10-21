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

let videoURLs = []; 
let videoFiles = []; // ဖိုင်အမည်တွေကို သိမ်းထားဖို့ အသစ်ထည့်ထားပါတယ်
let currentVideoIndex = 0; 
let wakeLock = null; // မျက်နှာပြင် မလင်းစေတဲ့ စနစ်အတွက်

// Video ရွေးတဲ့ ကုဒ်
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
            videoFiles.push(file); // ဖိုင်အချက်အလက်ကို သိမ်းထားမယ်
            
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

// စာတန်းထိုး ဖိုင်ရွေးတဲ့ ကုဒ်
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

// 🔥 Wake Lock စနစ် (မျက်နှာပြင် မည်းမသွားစေဖို့) 🔥
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.log(`Wake Lock Error: ${err.name}, ${err.message}`);
    }
}

// 🔥 ဗီဒီယို ဖွင့်တဲ့ Function (Resume စနစ် ပါဝင်လာပါပြီ) 🔥
function playVideoByIndex(index) {
    if (index >= 0 && index < videoURLs.length) {
        currentVideoIndex = index; 
        
        // အရင်က ကြည့်ခဲ့တဲ့ အချိန်ကို ရှာမယ်
        const fileName = videoFiles[index].name;
        const savedTime = localStorage.getItem('time_' + fileName);

        myPlayer.src = videoURLs[index];
        myPlayer.playbackRate = speedControl.value; 
        
        // အရင်က ကြည့်ခဲ့တဲ့ အချိန် ရှိရင် အဲဒီကနေ ဆက်ဖွင့်မယ်
        if (savedTime) {
            myPlayer.currentTime = parseFloat(savedTime);
        }

        myPlayer.play();

        // မျက်နှာပြင် မလင်းစေတဲ့ စနစ်ကို ဖွင့်မယ်
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

// 🔥 ဗီဒီယို ရပ်သွားရင် အချိန်ကို သိမ်းထားမယ် 🔥
myPlayer.addEventListener('pause', function() {
    if (videoFiles.length > 0 && videoFiles[currentVideoIndex]) {
        const fileName = videoFiles[currentVideoIndex].name;
        localStorage.setItem('time_' + fileName, myPlayer.currentTime);
    }
});

// ဗီဒီယို ပြီးသွားရင် အချိန်ကို ပြန်လည် သုညချမယ်
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

myPlayer.addEventListener('click', function() {
    if (myPlayer.paused) {
        myPlayer.play();
    } else {
        myPlayer.pause();
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
    
    // ရှင်းလင်းတဲ့အခါ အချိန်တွေကိုပါ ဖျက်မယ်
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

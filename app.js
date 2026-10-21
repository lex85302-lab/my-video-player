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
const videoSubtitle = document.getElementById('videoSubtitle');

let videoURLs = []; 
let currentVideoIndex = 0; 

// Video ရွေးတဲ့ ကုဒ် (အရင်အတိုင်း)
videoFileInput.addEventListener('change', function(event) {
    const files = event.target.files; 
    playlist.innerHTML = ''; 
    videoURLs = []; 

    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileURL = URL.createObjectURL(file);
            videoURLs.push(fileURL); 
            
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
            
            // SRT ဖိုင်ကို VTT အဖြစ် ပြောင်းလဲခြင်း (Browser တွေက VTT ကိုပဲ ဖတ်နိုင်လို့ပါ)
            if (file.name.endsWith('.srt')) {
                content = content.replace(/\r/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
                content = "WEBVTT\n\n" + content;
            }

            const blob = new Blob([content], { type: 'text/vtt' });
            const url = URL.createObjectURL(blob);
            
            videoSubtitle.src = url;
            videoSubtitle.track.mode = 'showing'; // စာတန်းထိုးကို အလိုအလျောက် ဖွင့်ပြမယ်
        };
        reader.readAsText(file);
    }
});

function playVideoByIndex(index) {
    if (index >= 0 && index < videoURLs.length) {
        currentVideoIndex = index; 
        myPlayer.src = videoURLs[index];
        myPlayer.playbackRate = speedControl.value; 
        myPlayer.play();

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
    myPlayer.removeAttribute('src');
    myPlayer.load(); 
    playlist.innerHTML = '';
    videoURLs = [];
    currentVideoIndex = 0;
    videoFileInput.value = ''; 
    subtitleFileInput.value = '';
    videoSubtitle.src = ''; // စာတန်းထိုးကိုပါ ရှင်းလင်းမယ်
});

myPlayer.addEventListener('ended', function() {
    if (currentVideoIndex < videoURLs.length - 1) {
        playVideoByIndex(currentVideoIndex + 1);
    }
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

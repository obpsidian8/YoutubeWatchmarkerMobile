console.log("Content script injected:", window.location.href);

let lastLocalSave = 0;
let lastSyncSave = 0;
let timeUpdateEventCount = 0;

function attachListeners(video) {
  if (!video || video.dataset.bound) return;
  video.dataset.bound = "true";

  const videoId = new URLSearchParams(window.location.search).get("v");
  let resumedOnce = false;
  console.log(`Attaching listeners to video:${videoId}`);
  console.log(`Video resumedOnce flag: ${resumedOnce}`);

  // Resume logic: fetch saved progress and seek
  //Make sure video is playing before seeking
  video.addEventListener("playing", () => {
    chrome.runtime.sendMessage({ type: "FETCH_VIDEOS", data: {} }, (response) => {
      console.log("Fetched videos for resuming:", response.videos);
      const videos = response.videos || {};
      const saved = videos[videoId];
      if (saved && saved.currentTime) {
        console.log(`Found video ${videoId} at saved time: ${saved.currentTime}s`);
        console.log(`Video resumedOnce flag before seeking: ${resumedOnce}`);
        if (!resumedOnce) {
          setTimeout(() => {
            video.currentTime = saved.currentTime;
            console.log(`Resumed video ${videoId} to ${saved.currentTime}s`);
          }, 2000); // delay ensures video is ready
          resumedOnce = true;
        }
      }
    });
  });

  // Debug all events
  [
    "play",
    "playing",
    "pause",
    "ended",
    "seeked",
    "seeking",
    "timeupdate",
    "durationchange",
    "ratechange",
    "volumechange",
    "waiting",
    "canplay",
    "canplaythrough",
    "loadeddata",
    "loadedmetadata",
  ].forEach((evt) => {
    video.addEventListener(evt, () => {
      console.log("event:", evt, video.currentTime);
    });
  });

  // Progress saving
  function saveProgress() {
    console.log("timeupdate event fired.");
    // Increase time spent playing
    //timeupdate fires 4 times per second, so 120 events = 30 seconds
    console.log(`timeUpdateEventCount before increment: ${timeUpdateEventCount}`);
    timeUpdateEventCount += 1;

    const now = Date.now();
    // We will save video progress if video has been playing for more than 30 seconds
    
    if (timeUpdateEventCount < 120) return;

    const progress = {
      videoId: new URLSearchParams(window.location.search).get("v"),
      currentTime: video.currentTime,
      title: document.title,
      lastPlayed: new Date().toDateString(),
      timeLastPlayed: new Date().toISOString(),
    };

    if (now - lastLocalSave > 5000) {
      lastLocalSave = now;
      console.log("Saving progress locally:", progress);
      chrome.runtime.sendMessage({ type: "SAVE_LOCAL", data: progress });
    }

    if (now - lastSyncSave > 120000) {
      lastSyncSave = now;
      console.log("Saving progress to sync:", progress);
      chrome.runtime.sendMessage({ type: "SAVE_SYNC", data: progress });
    }
  }

  video.addEventListener("timeupdate", saveProgress);

  ["pause", "seeked"].forEach((evt) => {
    video.addEventListener(evt, () => {
      console.log(`Event ${evt} fired, saving progress (SYNC).`);
      // if timeSpentPlaying is less than 30 seconds, do not save
      if (timeUpdateEventCount < 120) return;

      chrome.runtime.sendMessage({
        type: "SAVE_SYNC",
        data: {
          videoId: new URLSearchParams(window.location.search).get("v"),
          currentTime: video.currentTime,
          title: document.title,
          lastPlayed: new Date().toDateString(),
          timeLastPlayed: new Date().toISOString(),
        },
      });
    });
  });
}

// Watch for new video elements
const observer = new MutationObserver(() => {
  console.log("DOM mutation observed. Checking for video elements.");
  const video = document.querySelector("video.video-stream");
  attachListeners(video);
});
observer.observe(document.body, { childList: true, subtree: true });

// Initial run
attachListeners(document.querySelector("video.video-stream"));

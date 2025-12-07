// This is injected into a single page application. This means that the script is only injected once,
// and we need to handle dynamic page changes ourselves.
console.log("Content script injected:", window.location.href);
let CURRENT_VIDEO_ID = null; // Track the current video ID to avoid re-attaching listeners
video_events = [
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
];

special_force_save_events = ["pause", "seeked"];

function attachListeners(video) {
  let lastLocalSave = 0;
  let lastSyncSave = 0;
  let timeUpdateEventCount = 0;
  let resumedOnce = false;

  if (!video) {
    console.log("Video element is null. Cannot attach listeners.");
    return;
  }

  const videoId = new URLSearchParams(window.location.search).get("v");
  CURRENT_VIDEO_ID = videoId;
  if (!videoId) {
    console.log("No videoId found in URL, cannot attach listeners.");
    return;
  }
  
  // Remove old listeners first before attaching new ones
  video.removeEventListener("timeupdate", saveProgress);
  video.removeEventListener("playing", resumeVideo);
  video_events.forEach((evt) => {
    video.removeEventListener(evt, logEvents);
  });
  special_force_save_events.forEach((evt) => {
    video.removeEventListener(evt, forceSaveProgress);
  });

  console.log(`Attaching listeners to video: ${videoId}`);
  console.log(`Video resumedOnce flag: ${resumedOnce}`);

  // Debug all events
  function logEvents(evt) {
    console.log("event:", evt.type, video.currentTime);
  }

  // Regular progress saving function
  function saveProgress() {
    // Increase time spent playing
    console.log(`timeupdate event fired!! timeUpdateEventCount before increment: ${timeUpdateEventCount}`);
    timeUpdateEventCount += 1;

    const now = Date.now();
    // We will save video progress if video has been playing for more than 15 seconds
    if (timeUpdateEventCount < 60) return;

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

  //Forced save progress function for special events
  function forceSaveProgress(evt) {
    // if timeSpentPlaying is less than 15 seconds, do not save
    if (timeUpdateEventCount < 60) return;
    console.log(`Event ${evt.type} fired, saving progress (SYNC).`);

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
  }

  function resumeVideo() {
    chrome.runtime.sendMessage({ type: "FETCH_VIDEOS", data: {} }, (response) => {
      console.log(`Fetched videos for resuming ${videoId}:`, response.videos);
      const videos = response.videos || {};
      const saved = videos[videoId];
      console.log(`Resuming video ${videoId}:`, saved);
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
      }else {
        console.log(`No saved progress found for video ${videoId}`);
      }
    });
  }

  // Resume logic: fetch saved progress and seek
  //Make sure video is playing before seeking
  video.addEventListener("playing", resumeVideo);

  // Debug all events
  video_events.forEach((evt) => {
    video.addEventListener(evt, logEvents);
  });

  // Attach main progress saving listener
  video.addEventListener("timeupdate", saveProgress);

  // Attach special force save listeners
  special_force_save_events.forEach((evt) => {
    video.addEventListener(evt, forceSaveProgress);
  });
}

// Define a MutationObserver to watch for video element additions
const observer = new MutationObserver(() => {
  console.log("DOM mutation observed. Checking for video elements.");
  const video = document.querySelector("video.video-stream");
  // This detects all dom changes such as loading of nodes and tags. Also, the same vidoe element may persist across navigations.
  // So we need to check if we have already attached listeners for the current videoId.
  let newVideoId = new URLSearchParams(window.location.search).get("v");
  if (video && newVideoId === CURRENT_VIDEO_ID) {
    console.log("Video element already processed for current videoId.");
    return;
  }
  console.log("Video element found by observer:");
  // Since window element may persist, remove old listeners first before attaching new ones. (timeupdate, playing)
  // Remove the within the attachListeners function

  attachListeners(video);
});

//Catch dynamic page changes
observer.observe(document.body, { childList: true, subtree: true });

// Initial run
attachListeners(document.querySelector("video.video-stream"));

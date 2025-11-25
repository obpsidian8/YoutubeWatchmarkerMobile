console.log("Content script injected:", window.location.href);
let lastLocalSave = 0;
let lastSyncSave = 0;
(function () {
  const video = document.getElementsByClassName("video-stream")[0];
  if (!video) return;

  console.log("Content script loaded on YouTube page.");
  const videoId = new URLSearchParams(window.location.search).get("v");
  console.log("Video ID extracted:", videoId);
  let resumedOnce = false;

  // On page load, fetch saved progress
  chrome.runtime.sendMessage({ type: "FETCH_VIDEOS", data: {} }, (response) => {
    console.log("Fetched videos for resuming:", response.videos);
    const videos = response.videos || {};
    const saved = videos[videoId];
    if (saved && saved.currentTime) {
      console.log(`Found video ${videoId} at saved time: ${saved.currentTime}s`);
      if (!resumedOnce) {
        console.log(`Resuming video ${videoId} from saved time: ${saved.currentTime}s`);
        setTimeout(() => {
          video.currentTime = saved.currentTime;
        }, 1500); // slight delay to ensure video is ready

        resumedOnce = true; // ensure this only happens once
      }
    }
  });

  function saveProgress() {
    // if (!allowSaving) return;
    console.log("saveProgress event fired.");
    var dateValue = new Date().toDateString();
    let timeLastPlayed = new Date().toISOString();
    const now = Date.now();
    // Only save if current time is greater than 30 seconds
    if (video.currentTime < 30) return;

    const progress = {
      videoId: new URLSearchParams(window.location.search).get("v"),
      currentTime: video.currentTime,
      title: document.title,
      lastPlayed: dateValue,
      timeLastPlayed: timeLastPlayed,
    };

    // Save locally every 5s
    if (now - lastLocalSave > 5000) {
      lastLocalSave = now;
      console.log("Saving progress locally:", progress);
      chrome.runtime.sendMessage({ type: "SAVE_LOCAL", data: progress });
    }

    // Save to sync every 120s
    if (now - lastSyncSave > 120000) {
      lastSyncSave = now;
      console.log("Saving progress to sync:", progress);
      chrome.runtime.sendMessage({ type: "SAVE_SYNC", data: progress });
    }
  }

  // setInterval(saveProgress, 10000); // Save every 10 seconds
  video.addEventListener("timeupdate", saveProgress);
  
  // Extra: save on pause/seek
  ["pause", "seeked"].forEach((evt) => {
    video.addEventListener(evt, () => {
      console.log(`Event ${evt} fired, saving progress (SYNC).`);
      var dateValue = new Date().toDateString();
      let timeLastPlayed = new Date().toISOString();
      chrome.runtime.sendMessage({
        type: "SAVE_SYNC",
        data: {
          videoId: new URLSearchParams(window.location.search).get("v"),
          currentTime: video.currentTime,
          title: document.title,
          lastPlayed: dateValue,
          timeLastPlayed: timeLastPlayed,
        },
      });
    });
  });
  //End of pause/seek save
})();

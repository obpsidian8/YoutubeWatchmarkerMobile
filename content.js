// This is injected into a single page application. This means that the script is only injected once,
// and we need to handle dynamic page changes ourselves.
console.log("Content script injected:", window.location.href);
let GLOBAL_INSTANCE_ID = null;
let SAVED_VID_ID = null; // Track the current video ID to avoid re-attaching listeners
const video_events = [
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
  let latest_instance_id = Math.random().toString(36).substring(2, 10);
  console.log(`Latest Instance ID: ${latest_instance_id}, Global Instance ID: ${GLOBAL_INSTANCE_ID}`);
  GLOBAL_INSTANCE_ID = latest_instance_id;

  //We  will only run the functions here if this instance matches the global instance id
  // Every new instance created will update the global instance id ensuring only the latest instance is active

  let lastLocalSave = 0;
  let lastSyncSave = 0;
  let timeUpdateEventCount = 0;
  let resumedOnce = false;
  const saveDelayTimeout = 60; // Number of timeupdate events before saving (approx 15 seconds)

  if (!video) {
    console.log("Video element is null. Cannot attach listeners.");
    return;
  }

  const videoId = new URLSearchParams(window.location.search).get("v");
  if (!videoId) {
    console.log("No videoId found in URL, cannot attach listeners.");
    return;
  }

  SAVED_VID_ID = videoId;
  // Remove old listeners first before attaching new ones
  console.log(`Removing old listeners for video: ${videoId}`);
  video.removeEventListener("timeupdate", saveProgress);
  video.removeEventListener("playing", resumeVideo);
  video_events.forEach((evt) => {
    video.removeEventListener(evt, logEvents);
  });
  special_force_save_events.forEach((evt) => {
    video.removeEventListener(evt, forceSaveProgress);
  });

  // Debug all events
  function logEvents(evt) {
    if (latest_instance_id !== GLOBAL_INSTANCE_ID) {
      console.log(`Instance ${latest_instance_id} is outdated. Current Global Instance ID: ${GLOBAL_INSTANCE_ID}. Aborting logEvents.`);
      return;
    }
    console.log(`Instance ${latest_instance_id}: event:`, evt.type, video.currentTime);
  }

  // Regular progress saving function
  function saveProgress() {
    // Increase time spent playing
    if (latest_instance_id !== GLOBAL_INSTANCE_ID) {
      console.log(`Instance ${latest_instance_id} is outdated. Current Global Instance ID: ${GLOBAL_INSTANCE_ID}. Aborting saveProgress.`);
      return;
    }
    console.log(`Instance ${latest_instance_id} .timeupdate event fired!! timeUpdateEventCount before increment: ${timeUpdateEventCount}`);
    timeUpdateEventCount += 1;

    const now = Date.now();
    // We will save video progress if video has been playing for more than 15 seconds
    if (timeUpdateEventCount < saveDelayTimeout) return;

    const progress = {
      videoId: new URLSearchParams(window.location.search).get("v"),
      currentTime: video.currentTime,
      title: document.title,
      lastPlayed: new Date().toDateString(),
      timeLastPlayed: new Date().toISOString(),
    };

    if (now - lastLocalSave > 3000) {
      lastLocalSave = now;
      console.log(`Instance ${latest_instance_id} Saving progress locally:`, progress);
      chrome.runtime.sendMessage({ type: "SAVE_LOCAL", data: progress });
    }

    if (now - lastSyncSave > 120000) {
      lastSyncSave = now;
      console.log(`Instance ${latest_instance_id} Saving progress to sync:`, progress);
      chrome.runtime.sendMessage({ type: "SAVE_SYNC", data: progress });
    }
  }

  //Forced save progress function for special events
  function forceSaveProgress(evt) {
    if (latest_instance_id !== GLOBAL_INSTANCE_ID) {
      console.log(`Instance ${latest_instance_id} is outdated. Current Global Instance ID: ${GLOBAL_INSTANCE_ID}. Aborting forceSaveProgress.`);
      return;
    }
    // if timeSpentPlaying is less than 15 seconds, do not save
    if (timeUpdateEventCount < saveDelayTimeout) return;
    console.log(`Instance ${latest_instance_id}: Event ${evt.type} fired, saving progress (SYNC).`);

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
    if (latest_instance_id !== GLOBAL_INSTANCE_ID) {
      console.log(`Instance ${latest_instance_id} is outdated. Current Global Instance ID: ${GLOBAL_INSTANCE_ID}. Aborting resumeVideo.`);
      return;
    }
    chrome.runtime.sendMessage({ type: "FETCH_VIDEOS", data: {} }, (response) => {
      console.log(`Instance ${latest_instance_id}: Fetched videos for resuming ${videoId}:`, response.videos);
      const videos = response.videos || {};
      const saved = videos[videoId];
      console.log(`Instance ${latest_instance_id}: Resuming video ${videoId}:`, saved);
      if (saved && saved.currentTime) {
        console.log(`Instance ${latest_instance_id}: Found video ${videoId} at saved time: ${saved.currentTime}s`);
        console.log(`Instance ${latest_instance_id}: Video resumedOnce flag before seeking: ${resumedOnce}`);
        // Check if saved time is different from current time to avoid redundant seeks
        let diff = Math.abs(video.currentTime - saved.currentTime);
        console.log(`Instance ${latest_instance_id}: Current time: ${video.currentTime}s, Saved time: ${saved.currentTime}s, Difference: ${diff}s`);
        if (diff < 3) {
          console.log(`Instance ${latest_instance_id}: Video ${videoId} is already at the saved time: ${saved.currentTime}s, no need to seek.`);
          resumedOnce = true;
          return;
        }

        if (!resumedOnce) {
          setTimeout(() => {
            video.currentTime = saved.currentTime;
            console.log(`Instance ${latest_instance_id}: Resumed video ${videoId} to ${saved.currentTime}s`);
          }, 1000); // delay ensures video is ready
          resumedOnce = true;
        }
      } else {
        console.log(`Instance ${latest_instance_id}: No saved progress found for video ${videoId}`);
      }
    });
  }

  console.log(`Instance ${latest_instance_id}: Attaching listeners to video: ${videoId}`);
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
  console.log("\n---------------------------------------------------------------------------------------------------");
  console.log("DOM mutation observed.");
  const video = document.querySelector("video.video-stream");
  // This detects all dom changes such as loading of nodes and tags. Also, the same vidoe element may persist across navigations.
  // So we need to check if we have already attached listeners for the current videoId.
  let newVideoId = new URLSearchParams(window.location.search).get("v");
  console.log(`videoId from URL: ${newVideoId}, SAVED_VID_ID: ${SAVED_VID_ID}`);

  //Check if dom change corresponds to a new videoId
  if (newVideoId === SAVED_VID_ID) {
    console.log(`DOM changed on SAME page: ${newVideoId}. No need to re-attach listeners.`);
    return;
  }

  if (!newVideoId) {
    console.log("DOM changed to NEW page with NO videoId. Resetting SAVED_VID_ID.");
    SAVED_VID_ID = null; // Reset saved video ID
    return;
  }

  console.log(`DOM changed to NEW page: ${newVideoId}. Attaching listeners if video element exists.`);
  if (!video) {
    console.log("No video element found on the page.");
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

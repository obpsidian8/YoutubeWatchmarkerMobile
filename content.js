// This is injected into a single page application. This means that the script is only injected once,
// and we need to handle dynamic page changes ourselves.
console.log("Content script injected:", window.location.href);
// Registry: video element -> array of { type, fn }
const handlerRegistry = new Map();

let GLOBAL_INSTANCE_ID = null; // Used to keep track of functions run by listeners.
// Track the latest instance ID to manage multiple instances on SPA navigations.

let SAVED_VID_ID = null; // Track the current video ID to avoid re-attaching listeners. Used to detect if dom change corresponds to new pages or
// change in elements on the same page.

let LISTENER_ATTACHED = false; // Flag to track if listeners have been attached

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

const special_force_save_events = ["pause", "seeked"];

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
  let videoPlaying = false;
  const saveDelayTimeout = 60; // Number of timeupdate events before saving (approx 15 seconds)

  //log videe element first
  console.log("Attaching listeners to video element:", video);

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
      duration: video.duration,
      title: document.title,
      lastPlayed: new Date().toDateString(),
      timeLastPlayed: new Date().toISOString(),
    };

    if (now - lastLocalSave > 3000) {
      lastLocalSave = now;
      console.log(`Instance ${latest_instance_id} Saving progress locally:`, progress);
      try {
        chrome.runtime.sendMessage({ type: "SAVE_LOCAL", data: progress }, (response) => {
          if (chrome.runtime.lastError) {
            console.error(`Instance ${latest_instance_id} Message failed:`, chrome.runtime.lastError.message);
          } else {
            console.log(`Instance ${latest_instance_id} Message sent successfully:`, response);
          }
        });
      } catch (e) {
        console.error(`Instance ${latest_instance_id} Error sending SAVE_LOCAL message:`, e);
      }
    }

    if (now - lastSyncSave > 120000) {
      lastSyncSave = now;
      console.log(`Instance ${latest_instance_id} Saving progress to sync:`, progress);
      try {
        chrome.runtime.sendMessage({ type: "SAVE_SYNC", data: progress }, response =>{
          if (chrome.runtime.lastError) {
            console.error(`Instance ${latest_instance_id} Message failed:`, chrome.runtime.lastError.message);
          } else {
            console.log(`Instance ${latest_instance_id} Message sent successfully:`, response);
          }
        });
      } catch (e) {
        console.error(`Instance ${latest_instance_id} Error sending SAVE_SYNC message:`, e);
      }
    }
  }

  //Forced save progress function for special events
  function forceSaveProgress(evt) {
    if (latest_instance_id !== GLOBAL_INSTANCE_ID) {
      console.log(`Instance ${latest_instance_id} is outdated. Current Global Instance ID: ${GLOBAL_INSTANCE_ID}. Aborting forceSaveProgress.`);
      return;
    }
    // if video has not started playing yet, do not save
    if (!videoPlaying) {
      console.log(`Instance ${latest_instance_id}: Video is not playing yet. Aborting forceSaveProgress.`);
      return;
    }

    // if timeSpentPlaying is less than 15 seconds, do not save
    // if (timeUpdateEventCount < saveDelayTimeout) return;

    const data = {
      videoId: new URLSearchParams(window.location.search).get("v"),
      currentTime: video.currentTime,
      duration: video.duration,
      title: document.title,
      lastPlayed: new Date().toDateString(),
      timeLastPlayed: new Date().toISOString(),
    };
    console.log(`Instance ${latest_instance_id}: Event ${evt.type} fired, FORCE SAVE progress:`, data);
    try {
      chrome.runtime.sendMessage({ type: "SAVE_SYNC", data: data }, response =>{
        if (chrome.runtime.lastError) {
          console.error(`Instance ${latest_instance_id} Message failed:`, chrome.runtime.lastError.message);
        } else {
          console.log(`Instance ${latest_instance_id} Message sent successfully:`, response);
        }
      });
    } catch (e) {
      console.error(`Instance ${latest_instance_id} Error sending FORCE SAVE_SYNC message:`, e);
    }

    try {
      chrome.runtime.sendMessage({ type: "SAVE_LOCAL", data: data }, response =>{
        if (chrome.runtime.lastError) {
          console.error(`Instance ${latest_instance_id} Message failed:`, chrome.runtime.lastError.message);
        } else {
          console.log(`Instance ${latest_instance_id} Message sent successfully:`, response);
        }
      });
    } catch (e) {
      console.error(`Instance ${latest_instance_id} Error sending FORCE SAVE_LOCAL message:`, e);
    }
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
      console.log(`Saved video data for ${videoId}:`, saved);
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
        } else {
          console.log(`Instance ${latest_instance_id}: Video ${videoId} has already been resumed once, skipping seek.`);
        }
      } else {
        console.log(`Instance ${latest_instance_id}: No saved progress found for video ${videoId}`);
      }
    });
  }

  function cleanupListeners(video) {
    if (!video) {
      console.log(`Instance ${latest_instance_id}:  No video element provided for cleanup.`);
      return;
    }

    // Look up handlers for this video
    const handlers = handlerRegistry.get(video);
    if (!handlers) {
      console.log(`Instance ${latest_instance_id}: No handlers found in registry for this video ${videoId}.`);
      return;
    }

    console.log(`Instance ${latest_instance_id}: Cleaning up ${handlers.length} listeners for video ${videoId}.`);
    // Remove each listener using the stored reference
    handlers.forEach(({ type, fn }) => {
      video.removeEventListener(type, fn);
    });

    // Remove from registry so closures can be garbage‑collected
    handlerRegistry.delete(video);
  }

  // Remove old listeners first before attaching new ones
  cleanupListeners(video);

  console.log(`Instance ${latest_instance_id}: Attaching listeners to video: ${videoId}`);
  // Resume logic: fetch saved progress and seek
  //Make sure video is playing before seeking
  video.addEventListener("playing", resumeVideo);
  video.addEventListener("playing", () => {
    if (latest_instance_id !== GLOBAL_INSTANCE_ID) {
      console.log(`Instance ${latest_instance_id} is outdated. Current Global Instance ID: ${GLOBAL_INSTANCE_ID}. Aborting play listener.`);
      return;
    }
    console.log(`Instance ${latest_instance_id}: playing event fired, setting videoPlaying to true.`);
    videoPlaying = true;
  });
  // Add listener for seeking event to set resumedOnce flag to true
  video.addEventListener("seeked", () => {
    if (latest_instance_id !== GLOBAL_INSTANCE_ID) {
      console.log(`Instance ${latest_instance_id} is outdated. Current Global Instance ID: ${GLOBAL_INSTANCE_ID}. Aborting seeked listener.`);
      return;
    }
    if (!videoPlaying) {
      console.log(`Instance ${latest_instance_id}: seeked event fired but video is not playing. Not setting resumedOnce to true.`);
      return;
    } // Only set resumedOnce if video is playing

    console.log(`Instance ${latest_instance_id}: seeked event fired, setting resumedOnce to true.`);
    resumedOnce = true;
  });

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

  // Save references in registry
  handlerRegistry.set(video, [
    { type: "timeupdate", fn: saveProgress },
    { type: "playing", fn: resumeVideo },
    ...video_events.map((evt) => ({ type: evt, fn: logEvents })),
    ...special_force_save_events.map((evt) => ({ type: evt, fn: forceSaveProgress })),
  ]);
  console.log(`Instance ${latest_instance_id}: Listeners attached to video: ${videoId}`);
  LISTENER_ATTACHED = true;
}

// Define a MutationObserver to watch for video element additions
const observer = new MutationObserver(() => {
  console.log("\n---------------------------------------------------------------------------------------------------");
  console.log("DOM mutation observed.");
  // log the global tracking variables
  console.log(`SAVED_VID_ID: ${SAVED_VID_ID}, LISTENER_ATTACHED: ${LISTENER_ATTACHED}, GLOBAL_INSTANCE_ID: ${GLOBAL_INSTANCE_ID}`);
  const video = document.querySelector("video") || document.querySelector("video.video-stream");
  // This detects all dom changes such as loading of nodes and tags. Also, the same vidoe element may persist across navigations.
  // So we need to check if we have already attached listeners for the current videoId.
  let newVideoId = new URLSearchParams(window.location.search).get("v");
  console.log(`videoId from URL: ${newVideoId}, SAVED_VID_ID: ${SAVED_VID_ID}`);

  //Check if dom change corresponds to a new videoId
  if (newVideoId === SAVED_VID_ID && LISTENER_ATTACHED) {
    console.log(`DOM changed on SAME page: ${newVideoId}. No need to re-attach listeners.`);
    return;
  }

  if (!newVideoId) {
    console.log("DOM changed to NEW page with NO videoId. Resetting SAVED_VID_ID.");
    SAVED_VID_ID = null; // Reset saved video ID
    LISTENER_ATTACHED = false; // Reset listener attached flag
    return;
  }

  if (!video) {
    console.log(`DOM changed to NEW page ${newVideoId} but no video element found.`);
    return;
  }

  console.log(`DOM changed to NEW page with video element. ${newVideoId}.`);
  // Since window element may persist, remove old listeners first before attaching new ones. (timeupdate, playing)
  // Remove the within the attachListeners function
  // There are some things we need to immediately do once we are on a new video page
  // Need to set the SAVED_VID_ID to the new videoId, even if video element is not ready yet.
  // TThis is because the script will still be running in within context/data from the previous video page and the new video will be saved a postion 0
  // in the interval before the video element is ready, change GLOBAL_INSTANCE_ID to invalidate previous instance
  SAVED_VID_ID = newVideoId;
  GLOBAL_INSTANCE_ID = null;
  LISTENER_ATTACHED = false;
  if (video && video.src && video.src.startsWith("blob:")) {
    // Valid video element found, attach listeners
    console.log(`Valid video element found for new videoId ${newVideoId}, attaching listeners.`);
    attachListeners(video);
  } else {
    // If we dont change the the global variables above, the previous instance of the content script will continue to run and save progress for the previous video
    console.log(`Video not ready yet for new videoId ${newVideoId}`);
  }
});

//Catch dynamic page changes
observer.observe(document.body, { childList: true, subtree: true });

// Initial run
const video = document.querySelector("video") || document.querySelector("video.video-stream");
if (video && video.src && video.src.startsWith("blob:")) {
  // Valid video element found, attach listeners
  console.log(`Valid video element found for new videoId ${newVideoId}`);
  attachListeners(video);
} else {
  console.log("Video not ready yet on initial load.");
}

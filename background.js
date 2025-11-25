console.log("Loading background.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`Background received message type: ${message.type}`);
  const { videoId, currentTime, title, lastPlayed } = message.data;

  if (message.type === "SAVE_LOCAL") {
    console.log("Saving locally:", message.data);
    chrome.storage.local.get(["videos"], (result) => {
      const videos = result.videos || {};
      videos[videoId] = { title, currentTime, lastPlayed };
      chrome.storage.local.set({ videos });
    });
  }

  if (message.type === "SAVE_SYNC") {
    console.log("Saving to sync:", message.data);
    chrome.storage.sync.get(["videos"], (result) => {
      const videos = result.videos || {};
      videos[videoId] = { title, currentTime, lastPlayed };
      chrome.storage.sync.set({ videos });
    });
  }

  if (message.type === "CLEAR_DATA") {
    console.log("Clearing all stored data.");
    chrome.storage.local.remove(["videos"]);
    chrome.storage.sync.remove(["videos"]);
  }

  if (message.type === "DELETE_VIDEO") {
    console.log(`Deleting video ${videoId} from storage.`);
    chrome.storage.sync.get(["videos"], (result) => {
      const videos = result.videos || {};
      delete videos[videoId];
      chrome.storage.sync.set({ videos });
    });
    // Also delete from local storage
    chrome.storage.local.get(["videos"], (result) => {
      const videos = result.videos || {};
      delete videos[videoId];
      chrome.storage.local.set({ videos });
    });
  }

  async function fetchVideos() {
    const syncResult = await chrome.storage.sync.get(["videos"]);
    console.log("Videos fetched from sync storage:", syncResult.videos);
    const localResult = await chrome.storage.local.get(["videos"]);
    console.log("Videos fetched from local storage:", localResult.videos);
    merged_videos = { ...syncResult.videos, ...localResult.videos };
    console.log("Merged videos:", merged_videos);
    return merged_videos;
  }

  if (message.type === "FETCH_VIDEOS") {
    fetchVideos().then((videos) => sendResponse({ videos }));
    return true;
  }

  if (message.type === "RESUME_VIDEO") {
    chrome.storage.sync.get(["videos"], (result) => {
      const videos = result.videos || {};
      const saved = videos[videoId];
      if (saved) {
        const url = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(saved.currentTime)}s`;
        chrome.tabs.create({ url });
      }
    });
  }

});

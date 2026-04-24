console.log("Loading background.js");

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed or reloaded. Reinjection starting...");
  reinjectContentScripts();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Browser restarted. Reinjection starting...");
  reinjectContentScripts();
});

function reinjectContentScripts() {
  chrome.tabs.query({ url: "*://www.youtube.com/*" }, (tabs) => {
    for (const tab of tabs) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ["content.js"],
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn("Injection failed:", chrome.runtime.lastError.message);
          } else {
            console.log(`Reinjected content.js into tab ${tab.id}`);
          }
        },
      );
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`Background received message type: ${message.type}`);
  const { videoId, duration, currentTime, title, lastPlayed, timeLastPlayed } = message.data;

  if (message.type === "SAVE_LOCAL") {
    console.log("Saving locally:", message.data);
    // Will not sasve if videoId is undefined
    if (!videoId) return;
    chrome.storage.local.get(["videos"], async (result) => {
      const videos = result.videos || {};
      videos[videoId] = { title, duration, currentTime, lastPlayed, timeLastPlayed };
      chrome.storage.local.set({ videos: videos });
    });
  }

  if (message.type === "SAVE_SYNC") {
    console.log("Saving to sync:", message.data);
    // Will not sasve if videoId is undefined
    if (!videoId) return;
    chrome.storage.sync.get(["videos"], async (result) => {
      const videos = result.videos || {};
      videos[videoId] = { title, duration, currentTime, lastPlayed, timeLastPlayed };
      chrome.storage.sync.set({ videos: videos });
    });
  }
  
  if (message.type === "SAVE_GOOGLE") {
    console.log("Saving to Google Drive:", message.data);
    // Will not sasve if videoId is undefined
    if (!videoId) return;
    chrome.storage.local.get(["videos"], async (result) => {
      const videos = result.videos || {};
      videos[videoId] = { title, duration, currentTime, lastPlayed, timeLastPlayed };
      try {
        const token = await getOrRefreshGoogleDriveAccessToken();
        const fileId = await uploadToGoogleDrive(token, videos);
      } catch (error) {
        console.error("Failed to upload to Google Drive:", error);
      }
    });
  }

  if (message.type === "CLEAR_DATA") {
    console.log("Clearing all stored data.");
    chrome.storage.local.remove(["videos"]);
    chrome.storage.sync.remove(["videos"]);
    // We also want to delete the file from Google Drive when clearing data, so we will trigger an upload to Google Drive with empty videos after clearing local and sync storage
    chrome.storage.local.get(["videos"], async (result) => {
      const videos = {}; // Empty videos to overwrite existing data on Google Drive
      try {
        const token = await getOrRefreshGoogleDriveAccessToken();
        const fileId = await uploadToGoogleDrive(token, videos);
      } catch (error) {
        console.error("Failed to upload cleared videos to Google Drive:", error);
      }
    });
  }

  if (message.type === "DELETE_VIDEO") {
    console.log(`Deleting video ${videoId} from storage.`);
    chrome.storage.sync.get(["videos"], (result) => {
      const videos = result.videos || {};
      delete videos[videoId];
      chrome.storage.sync.set({ videos: videos });
    });
    // Also delete from local storage
    chrome.storage.local.get(["videos"], (result) => {
      const videos = result.videos || {};
      delete videos[videoId];
      chrome.storage.local.set({ videos: videos });
    });
    //We want the delete to show up in google drive too so we will trigger an upload to Google Drive with the updated videos after deletion
    chrome.storage.local.get(["videos"], async (result) => {
      const videos = result.videos || {};
      try {
        const token = await getOrRefreshGoogleDriveAccessToken();
        const fileId = await uploadToGoogleDrive(token, videos);
      } catch (error) {
        console.error("Failed to upload updated videos to Google Drive:", error);
      }
    });
  }

  if (message.type === "IMPORT_VIDEOS") {
    const videos = message.data.videos;
    // Fetch existing videos to merge
    existing_videos = fetchVideos().then((existing_videos) => {
      const merged_videos = { ...existing_videos, ...videos };
      chrome.storage.local.set({ videos: merged_videos });
      // chrome.storage.sync.set({ videos: merged_videos });
      console.log("Imported videos into storage:", merged_videos);

      // Try to upload merged videos to Google Drive if token is available
      getOrRefreshGoogleDriveAccessToken()
        .then((token) => uploadToGoogleDrive(token, merged_videos))
        .then((fileId) => {
          // Save the file ID to local storage so that we can update the same file next time instead of creating a new file each time
          chrome.storage.local.set({ googleDriveFileId: fileId });
          console.log("Merged videos uploaded to Google Drive (import)");
        })
        .catch((error) => {
          console.error("Failed to upload merged videos to Google Drive:", error);
          // Continue anyway, local save is already done
        });
    });
    // Send response back to popup
    sendResponse({ status: "IMPORT_SAVED" });
    return true; // Indicate that we will send a response asynchronously
  }

  if (message.type === "SYNC_WITH_GOOGLE_DRIVE") {
    console.log("Signing in to Google Drive and syncing data");
    
    getOrRefreshGoogleDriveAccessToken()
      .then(async (token) => {
        const videos = await fetchVideos(token); // Will fetch merged videos from all sources including Google Drive to ensure we have the latest data before syncing back
        // Saved newly merged videos back to local storage to ensure we have the latest data locally as well
        console.log("Saving merged videos(including Google Drive) to local storage before syncing to Google Drive:", videos);
        chrome.storage.local.set({ videos: videos });
        
        const fileId = await uploadToGoogleDrive(token, videos);
        // Save the file ID to local storage so that we can update the same file next time instead of creating a new file each time
        chrome.storage.local.set({ googleDriveFileId: fileId });
        console.log("Data successfully synced to Google Drive");
        sendResponse({ success: true, fileId: fileId });
      })
      .catch((error) => {
        console.error("Upload error:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }

  async function getOrRefreshGoogleDriveAccessToken() {
    // Check if token exists in storage
    const result = await chrome.storage.local.get(["googleDriveToken", "googleDriveTokenTimestamp"]);
    const token = result.googleDriveToken;
    const timestamp = result.googleDriveTokenTimestamp;
    
    // Token expiry window (in milliseconds) - Google tokens typically last 1 hour
    const TOKEN_EXPIRY_WINDOW = 60 * 60 * 1000; // 1 hour
    
    // Check if token is still valid
    if (token && timestamp) {
      const now = Date.now();
      if (now - timestamp < TOKEN_EXPIRY_WINDOW) {
        console.log("Using cached Google Drive token");
        return token;
      }
    }
    
    // Token is missing or expired, perform auth flow
    console.log("Token missing or expired, requesting new token");
    const clientId = "644683038468-ov9srral9clec4ibqvhk2v6q6uj8a2th.apps.googleusercontent.com";
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("response_type", "token");
    authUrl.searchParams.append("redirect_uri", redirectUrl);
    authUrl.searchParams.append("scope", "https://www.googleapis.com/auth/drive.appdata");
    
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl.toString(), interactive: true },
        (responseUrl) => {
          if (chrome.runtime.lastError) {
            console.error("Auth error:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          
          const url = new URL(responseUrl);
          const newToken = url.hash.substring(1).split("&").find(part => part.startsWith("access_token="))?.split("=")[1];
          
          if (!newToken) {
            reject(new Error("No access token received"));
            return;
          }
          
          // Save token and timestamp to storage
          chrome.storage.local.set({
            googleDriveToken: newToken,
            googleDriveTokenTimestamp: Date.now()
          });
          
          resolve(newToken);
        }
      );
    });
  }

  // chceck signed in status
  if (message.type === "GET_SIGNED_IN_STATUS") {
    console.log("Getting signed in status");
    // This is a placeholder for the actual logic to check signed-in status
    // For now, we just simulate that the user is not signed in
    setTimeout(() => {
      console.log("Simulated signed-in status: false");
      sendResponse({ signedIn: false });
    }, 500);
    return true; // Indicate that we will send a response asynchronously
  }

  async function fetchVideos(accessToken = null) {
    // Fetch videos from 3 sources: sync storage, local storage, and Google Drive (if access token is provided)
    const syncResult = await chrome.storage.sync.get(["videos"]);
    console.log("Videos fetched from sync storage:", syncResult.videos);
    const localResult = await chrome.storage.local.get(["videos"]);
    console.log("Videos fetched from local storage:", localResult.videos);

    let mergedVideos = { ...syncResult.videos, ...localResult.videos };

    // Fetch videos from Google Drive if access token is provided
    if (accessToken) {
      try {
        const driveVideos = await downloadFromGoogleDrive(accessToken);
        if (driveVideos && Object.keys(driveVideos).length > 0) {
          console.log("Videos fetched from Google Drive:", driveVideos);
          // Merge with existing videos (Google Drive data takes precedence)
          mergedVideos = { ...mergedVideos, ...driveVideos };
        }
        else{
          console.log("No videos found on Google Drive");
        }
      } catch (error) {
        console.error("Error fetching from Google Drive:", error);
      }
    }

    console.log("Merged videos:", mergedVideos);
    // Sort by lastPlayed date descending
    const sorted_videos = Object.entries(mergedVideos).sort((a, b) => {
      // timeLastPlayed may be undefined for older entries
      if (!a[1].timeLastPlayed) return 1;
      if (!b[1].timeLastPlayed) return -1;
      const dateA = new Date(a[1].timeLastPlayed);
      const dateB = new Date(b[1].timeLastPlayed);
      return dateA - dateB;
    });
    return Object.fromEntries(sorted_videos);
  }

  async function downloadFromGoogleDrive(accessToken) {
    const fileName = "youtube-watchmarker-data.json";
    let fileId = null;
    
    // Try to get the file ID from local storage first
    const result = await chrome.storage.local.get("googleDriveFileId");
    fileId = result.googleDriveFileId;
    
    // If no fileId in storage, try to find it by name (fallback for new devices)
    if (!fileId) {
      console.log("File ID not found in storage, searching by file name");
      try {
        const listResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&spaces=appDataFolder&fields=files(id)`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
        
        if (!listResponse.ok) {
          throw new Error(`Failed to search for file: ${listResponse.status}`);
        }
        
        const listData = await listResponse.json();
        const foundFile = listData.files && listData.files.length > 0 ? listData.files[0] : null;
        
        if (foundFile) {
          fileId = foundFile.id;
          // Save the file ID to local storage for future use
          chrome.storage.local.set({ googleDriveFileId: fileId });
          console.log("Found file by name, saved file ID to local storage");
        } else {
          console.log("No file found on Google Drive");
          return {};
        }
      } catch (error) {
        console.error("Error searching for file by name:", error);
        throw error;
      }
    }
    
    // Now download the file using the fileId
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to download from Google Drive: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Data downloaded from Google Drive successfully");
      return data;
    } catch (error) {
      console.error("Error downloading from Google Drive:", error);
      throw error;
    }
  }

  async function uploadToGoogleDrive(accessToken, videos) {
    const fileName = "youtube-watchmarker-data.json";
    const fileContent = JSON.stringify(videos, null, 2);
    
    // Check if file already exists in app data folder. 
    // We are checking by name because we want to reuse the same file each time to avoid cluttering user's Google Drive with multiple files. 
    // If the file exists, we will update it. If not, we will create a new file.
    const listResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&spaces=appDataFolder&fields=files(id)`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    
    if (!listResponse.ok) {
      throw new Error(`Failed to list files: ${listResponse.status}`);
    }
    
    const listData = await listResponse.json();
    const existingFile = listData.files && listData.files.length > 0 ? listData.files[0] : null;
    
    if (existingFile) {
      // Update existing file
      console.log("Updating existing file:", existingFile.id);
      const updateResponse = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: fileContent
        }
      );
      
      if (!updateResponse.ok) {
        throw new Error(`Failed to update file: ${updateResponse.status}`);
      }
      
      const result = await updateResponse.json();
      return result.id;
    } else {
      // Create new file
      console.log("Creating new file in Google Drive");
      const metadata = {
        name: fileName,
        mimeType: "application/json",
        parents: ["appDataFolder"]
      };
      
      const formData = new FormData();
      formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      formData.append("file", new Blob([fileContent], { type: "application/json" }));
      
      const createResponse = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&spaces=appDataFolder",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          body: formData
        }
      );
      
      if (!createResponse.ok) {
        throw new Error(`Failed to create file: ${createResponse.status}`);
      }
      
      const result = await createResponse.json();
      return result.id; //This is the file ID of the newly created file
    }
  }

  if (message.type === "FETCH_VIDEOS") {
    // Don't block popup load by requesting auth token
    // Just fetch from local/sync storage without Google Drive
    fetchVideos().then((videos) => sendResponse({ videos }));
    return true; // Indicate that we will send a response asynchronously
  }

  if (message.type === "RESUME_VIDEO") {
    fetchVideos().then((videos) => {
      const saved = videos[videoId];
      console.log(`Resuming video ${videoId}:${saved}`);
      if (saved) {
        const url = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(saved.currentTime)}s`;
        chrome.tabs.create({ url });
      }
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  console.log("Popup DOMContentLoaded");
  const list = document.getElementById("video-list");

  function renderVideos(videos) {
    list.innerHTML = "";
    Object.entries(videos).forEach(([id, { title, duration, currentTime, lastPlayed, timeLastPlayed }]) => {
      //Convert time to hh:mm:ss format
      const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      };

      const getTimeOnlyFromIsoString = (isoString) => {
        // Convert ISO string to readable local date time
        const date = new Date(isoString); //e,g 1/2/2026, 11:45:38 AM
        // Return only the time portion HH:MM:SS AM/PM
        return date.toLocaleTimeString();
      };

      const cleanTitle = (title) => {
        // Remove parentheses and their contents, id digits, from beginning of the title eg (40) Title -> Title
        // Remove "- Youtube" from end of title
        return title
          .replace(/^\s*\(.*\d+\)\s*/, "")
          .replace(/- YouTube$/, "")
          .trim();
      };

      const container = document.createElement("div");
      container.id = id;
      container.className = "video_item";

      const titleEl = document.createElement("div");
      titleEl.className = "video_title";
      titleEl.textContent = cleanTitle(title);

      const timeEl = document.createElement("div");
      timeEl.className = "video_time";
      timeEl.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;

      const lastPlayedEl = document.createElement("div");
      lastPlayedEl.className = "video_last_played";
      lastPlayedEl.textContent = `Last played: ${lastPlayed} at ${getTimeOnlyFromIsoString(timeLastPlayed)}`;

      const imageElement = document.createElement("img");
      imageElement.src = "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg";

      // Create progress bar
      const progressBar = document.createElement("progress");
      // Express progress bar value as a percent of duration
      console.log(`Video ${id} duration: ${videos[id].duration}, currentTime: ${currentTime}`);
      progressBar.value = (currentTime / (videos[id].duration || 1)) * 100; // Avoid division by zero
      progressBar.max = 100;
      progressBar.className = "progress_bar";

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete_button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        console.log(`Delete button clicked for video ${id}`);
        chrome.runtime.sendMessage({ type: "DELETE_VIDEO", data: { videoId: id } });
        container.remove(); // Remove the video item from the popup
      });

      const resumeButton = document.createElement("button");
      resumeButton.type = "button";
      resumeButton.className = "resume_button";
      resumeButton.textContent = "Resume";
      resumeButton.addEventListener("click", () => {
        console.log(`Resume button clicked for video ${id}`);
        // Send a message to background.js to handle resume logic
        chrome.runtime.sendMessage({ type: "RESUME_VIDEO", data: { videoId: id } });
      });

      list.appendChild(container);

      const buttonRow = document.createElement("div");
      buttonRow.className = "button_row";
      buttonRow.appendChild(deleteButton);
      buttonRow.appendChild(resumeButton);

      container.appendChild(imageElement);
      container.appendChild(progressBar);
      container.appendChild(titleEl);
      container.appendChild(timeEl);
      container.appendChild(lastPlayedEl);

      container.appendChild(buttonRow);
    });
  }

  // When pop is opened for the first time, fetch videos and render
  chrome.runtime.sendMessage({ type: "FETCH_VIDEOS", data: {} }, (response) => {
    console.log("Fetched videos for rendering:", response.videos);
    const videos = response.videos || {};
    // Reverse the order of the vidoes so that the most recenlt added are at the top
    const reversedVideos = Object.fromEntries(Object.entries(videos).reverse());
    renderVideos(reversedVideos);
  });

  // While popup is open, listen for storage changes and update the list
  chrome.storage.onChanged.addListener((changes, area) => {
    console.log("Storage change detected in popup:", changes);
    console.log("Area of change:", area);
    if (!changes.videos) return;
    chrome.runtime.sendMessage({ type: "FETCH_VIDEOS", data: {} }, (response) => {
    console.log("Fetched videos for rendering:", response.videos);
    const videos = response.videos || {};
    // Reverse the order of the vidoes so that the most recenlt added are at the top
    const reversedVideos = Object.fromEntries(Object.entries(videos).reverse());
    renderVideos(reversedVideos);
  });
  });

  // Search functionality
  const searchBar = document.getElementById("searchbar");
  searchBar.addEventListener("input", () => {
    const query = searchBar.value.toLowerCase();
    const videoItems = document.getElementsByClassName("video_item");
    Array.from(videoItems).forEach((item) => {
      const title = item.querySelector("div").textContent.toLowerCase();
      if (title.includes(query)) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });
  });
});

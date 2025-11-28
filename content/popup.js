document.addEventListener("DOMContentLoaded", () => {
  console.log("Popup DOMContentLoaded");
  const list = document.getElementById("video-list");

  function renderVideos(videos) {
    list.innerHTML = "";
    Object.entries(videos).forEach(([id, { title, currentTime, lastPlayed, timeLastPlayed }]) => {
      //Convert time to hh:mm:ss format
      const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      };

      const container = document.createElement("div");
      container.id = id;
      container.className = "video_item";

      const titleEl = document.createElement("div");
      titleEl.textContent = title;

      const timeEl = document.createElement("div");
      timeEl.textContent = `Current Time: ${formatTime(currentTime)}`;

      const lastPlayedEl = document.createElement("div");
      lastPlayedEl.textContent = `Last played: ${lastPlayed}`;

      const timeLastPlayedEl = document.createElement("div");
      timeLastPlayedEl.textContent = `Time last played: ${timeLastPlayed}`;


      const imageElement = document.createElement("img");
      imageElement.src = "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg";

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete_button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        console.log(`Delete button clicked for video ${id}`);
        chrome.runtime.sendMessage({ type: "DELETE_VIDEO", data: { videoId: id } });
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
      container.appendChild(imageElement);

      const buttonRow = document.createElement("div");
      buttonRow.className = "button_row";
      buttonRow.appendChild(deleteButton);
      buttonRow.appendChild(resumeButton);

      container.appendChild(imageElement);
      container.appendChild(titleEl);
      container.appendChild(timeEl);
      container.appendChild(lastPlayedEl);
      container.appendChild(timeLastPlayedEl);
      container.appendChild(buttonRow);
    });
  }

  chrome.runtime.sendMessage({ type: "FETCH_VIDEOS", data: {} }, (response) => {
    console.log("Fetched videos for rendering:", response.videos);
    const videos = response.videos || {};
    // Reverse the order of the vidoes so that the most recenlt added are at the top
    const reversedVideos = Object.fromEntries(Object.entries(videos).reverse());
    renderVideos(reversedVideos);
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

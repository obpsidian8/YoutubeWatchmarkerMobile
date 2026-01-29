document.addEventListener("DOMContentLoaded", () => {
  console.log("Popup DOMContentLoaded");
  const root = document.getElementById("content-container");

  function renderVideoTiles(videos) {
    //create dive to hold video list
    const videoListDiv = document.createElement("div");
    videoListDiv.id = "video-list-div";
    root.appendChild(videoListDiv);

    //create video list and append to videoListDiv
    const list = document.createElement("ul");
    list.id = "video-list";
    videoListDiv.appendChild(list);

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
      lastPlayedEl.textContent = `${lastPlayed}, ${getTimeOnlyFromIsoString(timeLastPlayed)}`;

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
        customConfirm("Are you sure?", function (result) {
          if (result) {
            console.log("OK pressed — run code");
            chrome.runtime.sendMessage({ type: "DELETE_VIDEO", data: { videoId: id } });
            // container.remove(); // Remove the video item from the popup
            renderVideosPage(); // Rerender the video list to reflect deletion
          } else {
            console.log("Cancel pressed — exit");
          }
        });
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

      // Crate video details div
      const videoDetailsDiv = document.createElement("div");
      videoDetailsDiv.className = "video_details";
      container.appendChild(videoDetailsDiv);

      videoDetailsDiv.appendChild(titleEl);
      videoDetailsDiv.appendChild(timeEl);
      videoDetailsDiv.appendChild(lastPlayedEl);
      videoDetailsDiv.appendChild(progressBar);
      videoDetailsDiv.appendChild(buttonRow);
    });
  }

  function renderVideosPage() {
    setOptionsButtonNormalFunction();
    // Fetch videos from background script
    chrome.runtime.sendMessage({ type: "FETCH_VIDEOS", data: {} }, (response) => {
      console.log("Fetched videos for rendering:", response.videos);
      const videos = response.videos || {};
      // Reverse the order of the vidoes so that the most recenlt added are at the top
      const reversedVideos = Object.fromEntries(Object.entries(videos).reverse());
      //Clear existing content
      root.innerHTML = "";
      updateVideoCountBubble(Object.keys(videos).length);
      renderVideoTiles(reversedVideos);
    });
  }

  function updateVideoCountBubble(count) {
    const btn = document.getElementById("options-menu");
    btn.setAttribute("data-count", count);
  }

  function renderOptionsPage() {
    setOptionsButtonBackFunction();
    // Clear existing content
    root.innerHTML = "";
    // Get root element (app div) and add options title. We will append content to this
    const appDiv = document.getElementById("content-container");

    //Create div to hold options page
    const optionsDiv = document.createElement("div");
    optionsDiv.id = "options-page";
    appDiv.appendChild(optionsDiv);

    // Create and append title to options page
    const titleEl = document.createElement("h2");
    titleEl.textContent = "Options";
    optionsDiv.appendChild(titleEl);

    //create delete all data button
    const deleteAllButton = document.createElement("button");
    deleteAllButton.type = "button";
    deleteAllButton.className = "delete-all-button";
    deleteAllButton.textContent = "Delete All Stored Data";
    deleteAllButton.addEventListener("click", () => {
      console.log("Delete All Stored Data button clicked");
      // Pass message and function to run(if true) into custom confirm
      customConfirm("Are you sure?", function (result) {
        if (result) {
          console.log("OK pressed — run code");
          chrome.runtime.sendMessage({ type: "CLEAR_DATA", data: {} });
        } else {
          console.log("Cancel pressed — exit");
        }
        updateVideoCountBubble(0);
      });
    });
    optionsDiv.appendChild(deleteAllButton);
    // ======================= End delete all data button

    // Create Download Data Button
    const downloadDataButton = document.createElement("button");
    downloadDataButton.type = "button";
    downloadDataButton.className = "download-data-button";
    downloadDataButton.textContent = "Download Stored Data";
    downloadDataButton.addEventListener("click", () => {
      console.log("Download Stored Data button clicked");
      chrome.runtime.sendMessage({ type: "FETCH_VIDEOS", data: {} }, (response) => {
        const dataStr = JSON.stringify(response.videos, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });

        const a = document.createElement("a");
        a.download = "stored_videos_data.json";
        a.href = URL.createObjectURL(blob);
        a.textContent = "Download stored_videos_data.json";
        a.dataset.downloadurl = ["application/json", a.download, a.href].join(":");
        document.body.appendChild(a);

        a.click();

        // Clean up
        URL.revokeObjectURL(a.href); // <-- release memory
        document.body.removeChild(a); // <-- remove temporary element
      });
    });
    optionsDiv.appendChild(downloadDataButton);
    // ======================= End Download Data Button

    // Create Import Data Button
    const importDataButton = document.createElement("button");
    importDataButton.type = "button";
    importDataButton.className = "import-data-button";
    importDataButton.textContent = "Import Saved Data";
    importDataButton.addEventListener("click", () => {
      console.log("Import Stored Data button clicked");
      // Create file input element
      const fileInput = document.createElement("input");

      // Configure it to accept JSON files
      fileInput.type = "file"; // Set file input type
      fileInput.accept = ".json,application/json";

      // Listen for file selection
      fileInput.addEventListener("change", (event) => {
        // Get the selected file
        const file = event.target.files[0];
        const reader = new FileReader();

        // When file is read, parse JSON and send to background script
        reader.onload = (e) => {
          try {
            const importedData = JSON.parse(e.target.result);
            chrome.runtime.sendMessage({ type: "IMPORT_VIDEOS", data: { videos: importedData } }, (response) => {
              console.log("Import response:", response);
              // Display confirmation to user
              customConfirm("Import successful!", function (result) {
                // Do nothing on OK
              });
            });
          } catch (error) {
            console.error("Error parsing imported JSON:", error);
          }
        };
        reader.readAsText(file);
      });
      fileInput.click();
    });
    optionsDiv.appendChild(importDataButton);
    // ======================= End Import Data Button

    // Add back button to return to video list
    const backButton = document.createElement("button");
    backButton.textContent = "← Back";
    backButton.id = "back-button";
    backButton.className = "back-button";
    backButton.addEventListener("click", () => {
      // Call method to render video list again
      renderVideosPage();
    });
    optionsDiv.appendChild(backButton);

    //Add version info
    const versionInfo = document.createElement("div");
    versionInfo.id = "version-info";
    versionInfo.textContent = `Version: ${chrome.runtime.getManifest().version}`;
    optionsDiv.appendChild(versionInfo);
  }

  function customConfirm(message, callback) {
    // Get modal elements
    const modal = document.getElementById("myConfirm");
    const msg = document.getElementById("confirmMessage");
    const okBtn = document.getElementById("confirmOk");
    const cancelBtn = document.getElementById("confirmCancel");

    msg.textContent = message;
    modal.classList.remove("hidden");

    //Special case: if message is "Import successful!", hide cancel button
    if (message === "Import successful!") {
      cancelBtn.style.display = "none";
      // Change okBtn text to "Close"
      okBtn.textContent = "Close";

      //Change okBtn color to default
      okBtn.style.background = "#39753e";
    } else {
      cancelBtn.style.display = "inline-block";
    }

    // Cleanup function to remove event listeners and hide modal
    const cleanup = () => {
      modal.classList.add("hidden");
      okBtn.onclick = null;
      cancelBtn.onclick = null;
    };

    okBtn.onclick = () => {
      cleanup();
      // Call the callback with true
      callback(true); // OK pressed
    };

    cancelBtn.onclick = () => {
      cleanup();
      // Call the callback with false
      callback(false); // Cancel pressed
    };
  }

  // While popup is open, listen for storage changes and update the list
  chrome.storage.onChanged.addListener((changes, area) => {
    console.log("Storage change detected in popup:", changes);
    console.log("Area of change:", area);
    if (!changes.videos) return;
    // Check for options-page div, if it exists, do not rerender video list
    if (document.getElementById("options-page")) return;
    renderVideosPage();
  });

  function setOptionsButtonNormalFunction() {
    let optionsButton = document.getElementById("options-menu");
    optionsButton.classList.remove("back-icon");
    // Remove existing event listeners by cloning
    let newOptionsButton = optionsButton.cloneNode(true);
    // Add back the three span tags inside the button
    newOptionsButton.innerHTML = `<span class="bar1"></span><span class="bar2"></span><span class="bar3"></span>`;
    optionsButton.parentNode.replaceChild(newOptionsButton, optionsButton);
    newOptionsButton.addEventListener("click", () => {
      console.log("Options button clicked");
      // Rerender page to show options page instead of video list
      renderOptionsPage();
    });
  }

  // ========================== setOptionsButtonBackFunction
  function setOptionsButtonBackFunction() {
    let optionsButton = document.getElementById("options-menu");
    // Remove existing event listeners by cloning
    let newOptionsButton = optionsButton.cloneNode(true);
    // Remove two of the three the empty span tags inside the button
    newOptionsButton.classList.add("back-icon");

    optionsButton.parentNode.replaceChild(newOptionsButton, optionsButton);
    newOptionsButton.addEventListener("click", () => {
      console.log("Back to videos button clicked");
      // Rerender video list
      renderVideosPage();
    });
  }
  // ======================= End setOptionsButtonBackFunction

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

  // When pop is opened for the first time, fetch videos and render
  renderVideosPage();
});

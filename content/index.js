document.addEventListener("DOMContentLoaded" ,fillpage);
function fillpage()
    {
        console.log("The popup content has been loaded. Querying fronend for usage data.")

        // Query frontend for storage usage

        chrome.tabs.query({active: true, currentWindow: true}, tabFunction)
        function tabFunction(tabs)
        {
            dataToSend =  {
                message: "autoFill",
                type: "usage" 
            }

            console.log(`Current Page: ${tabs[0].url}`)
            if (!tabs[0].url.includes("youtube.com"))
                {
                    console.log('Not on a youtube page');
                    alert("Switch to a Youtube tab to run");
                    return
                }
            
            else
                {
                    // Run for else block
                    chrome.tabs.sendMessage(
                        tabs[0].id, dataToSend, function(response) {
                            console.log(response) // Data received from front end as JSON
            
                            //Display message from front end that data has been received
                            console.log(response.message)                
                            var watchData = response.watchData
                            var _lsTotal = response.total
                            var watchDataAmt = response.watchDataAmt
                            console.log("watchDataAmt = " + (watchDataAmt / 1024).toFixed(2) + "KB");
                            if (watchData === "")
                                {
                                    watchData = "Total watchData Usage: 0KB"
                                }
                    
                            const TotalUsedEle = document.createElement("p");
                            const watchDataEle = document.createElement("p");
                    
                            TotalUsedEle.textContent = "Total Local Storage Used of 5000KB (5MB): " + (_lsTotal / 1024).toFixed(2) + "KB (" + ((_lsTotal / 1024)/ 5000).toFixed(3) + "%)"
                            watchDataEle.textContent = watchData
                            document.querySelectorAll('.stats-total')[0].appendChild(TotalUsedEle);
                            document.querySelectorAll('.stats-total')[0].appendChild(watchDataEle);
                    
                            var elem = document.getElementById("myBar");   
                            var width = 0;
                            var id = setInterval(frame, 10);
                            function frame() {
                                width = (_lsTotal / 1024).toFixed(2) / 5000; 
                                elem.style.width = width + '%'; 
                            }
                        }
                    )
                    // End else block
                }


        }

        // CLEAR WATCH DATA SECTION
        document.getElementById("clearWatchDataBtn").addEventListener("click", clearWatchData);
        function clearWatchData (e) 
        {
            if( ! confirm("Do you really want clear all Watch data?") )
                {
                    e.preventDefault();
                    // alert('Watch data not cleared'); // ! => don't want to do this
                } 
            else 
                {
                    //want to do this! => maybe do something about it?
                    alert('Ok, lets do this!');
                    window.localStorage.removeItem("watchData"); // Clears the data on the backend
                    window.localStorage.setItem("watchData", JSON.stringify({}));
                    
                    const clearMsg = document.createElement("p");
                    clearMsg.style = "text-align: center;"
                    clearMsg.id = "dataClearMsg"
                    clearMsg.textContent = "Watch Data Cleared!"
                    document.querySelectorAll(".clearBtn")[0].appendChild(clearMsg);
    
                    setTimeout(function () {
                        document.getElementById('dataClearMsg').style.display = 'none'
                        document.location.reload()
                    }, 3000)
    
                    // Send message to content script to also clear the storage there
                    console.log(`Sending signal to content script to clear watchData.`)
                    function clearWatchTabFunc(tabs)
                    {
                        chrome.tabs.sendMessage(tabs[0].id, 
                            {
                                message: "autoFill",
                                type: "clearWatchData" 
                            }, function(response) {})
                    }

                    chrome.tabs.query({active: true, currentWindow: true}, clearWatchTabFunc)
    
                    // END SEND MESSAGE
                }
        }
        
        // SHOW DATA SECTION
        document.getElementById("showWatchDataBtn").addEventListener("click", showWatchData);
        function showWatchData () 
        {
            function showWatchtFunct (tabs) 
                {
                    console.log(`Current Page: ${tabs[0].url}`)
                    if (!tabs[0].url.includes("youtube.com"))
                    {
                        console.log('Not on a youtube page');
                        alert("Switch to a Youtube tab to run");
                        return
                    }
                    
                    dataToSend =  {
                        message: "autoFill",
                        type: "syncData" 
                    }

                    chrome.tabs.sendMessage(
                        tabs[0].id, dataToSend, function(response) {
                            console.log(response) // Data received from front end as JSON
                            
                            // Show data section
                            var watchdata_details_ele = document.getElementById("watchdata_details");
                            if (watchdata_details_ele.style.display==="none" ||  watchdata_details_ele.style.display==="")
                                {
                                    watchdata_details_ele.style.display = "block";
                                    // Get details of watchData
                                    var currentWatchDataObj = response.data;
                                    var num = 0
                                    // currentWatchDataObj = JSON.parse(currentWatchDataObj);
                                    for (property in currentWatchDataObj)
                                        {
                                            num = num +1;
                                            const container = document.createElement("div");
                                            container.className = "watchDataDiv"

                                            const divider = document.createElement("hr")
                                            divider.className = "divider"
                                            const dividerA = divider.cloneNode(true);
                                            const dividerB = divider.cloneNode(true);

                                            // Create Delete button for current tile
                                            const deleteButton = document.createElement("button");
                                            deleteButton.type = "button";
                                            deleteButton.className = "delete_button";
                                            deleteButton.id = currentWatchDataObj[property].vidId
                                            deleteButton.textContent = "Delete"
                                            container.appendChild(deleteButton)

                                            // Create Play button for current tile
                                            const playButton = document.createElement("button");
                                            playButton.type = "button";
                                            playButton.className = "play_button";
                                            playButton.id = currentWatchDataObj[property].vidId
                                            playButton.textContent = "Play"
                                            container.appendChild(playButton)

                                            // Create image container
                                            const infoEleImageContainer = document.createElement("div")
                                            infoEleImageContainer.className  = "thumbnail-container"
                                            const imageElement = document.createElement("img")
                                            imageElement.alt= ""
                                            imageElement.className="image-loaded"
                                            imageElement.src = "https://i.ytimg.com/vi/"+currentWatchDataObj[property].vidId+"/mqdefault.jpg"
                                            infoEleImageContainer.appendChild(imageElement)


                                            const infoEleTitle = document.createElement("span");
                                            const infoElePercentPlayed = document.createElement("span");
                                            const infoEleVidId = document.createElement("span");
                                            const infoLastPlayed = document.createElement("span");

                                            infoEleTitle.textContent = ""+currentWatchDataObj[property].title
                                            infoElePercentPlayed.textContent = "Progress: " + Math.floor(((currentWatchDataObj[property].timeInfo.percentPlayed))*100) +"%" + " (" + Math.floor((currentWatchDataObj[property].timeInfo.currentTime)/60) + " min " + Math.floor((currentWatchDataObj[property].timeInfo.currentTime)%60) + " s)"
                                            infoEleVidId.textContent =  "Url: " +"https://www.youtube.com/watch?v=" + currentWatchDataObj[property].vidId
                                            infoLastPlayed.textContent = "Viewed on: "+`${currentWatchDataObj[property].lastPlayed}`
                                            // infoEleVidId.href = "https://www.youtube.com/watch?v=" + currentWatchDataObj[property].vidId;

                                            //Create progress bar
                                            const progressBarContainer = document.createElement("div");
                                            progressBarContainer.className = "ytm-thumbnail-overlay-resume-playback-renderer"
                                            const progress = document.createElement("div")
                                            progress.className = "thumbnail-overlay-resume-playback-progress"
                                            progress.style= "width: "+Math.floor(((currentWatchDataObj[property].timeInfo.percentPlayed))*100) +"%"
                                            progressBarContainer.appendChild(progress)


                                            container.appendChild(infoEleImageContainer);
                                            container.append(progressBarContainer)
                                            container.appendChild(dividerA);
                                            container.appendChild(infoEleTitle);
                                            container.appendChild(divider);
                                            container.appendChild(infoElePercentPlayed);
                                            //container.appendChild(dividerA);
                                            //container.appendChild(infoEleVidId);
                                            container.appendChild(dividerB);
                                            container.appendChild(infoLastPlayed)

                                            firstChildEle = document.querySelectorAll('.watchdata_details')[0].firstElementChild;

                                            // This will make sure that the most seen videos (end of the object) will be on the top of the page
                                            if (!firstChildEle)
                                                {
                                                    document.querySelectorAll('.watchdata_details')[0].appendChild(container);
                                                }
                                            else
                                                {
                                                    document.querySelectorAll('.watchdata_details')[0].insertBefore(container, firstChildEle)
                                                }
                                        }
                                        
                                        //============================================================================
                                        // ADD EVENT LISTENERS FOR ALL DELETE BUTTONS FOR TILES
                                        const del_buttons = document.querySelectorAll('.delete_button')
                                        del_buttons.forEach(function(currentBtn)
                                        {
                                            currentBtn.addEventListener('click', handleDelEvent)
                                          })
                                        function handleDelEvent(event)
                                            {
                                                dataToSend =  {
                                                    message: "autoFill",
                                                    type: "deleteEntry",
                                                    vidId:  event.target.id
                                                }
                                                chrome.tabs.sendMessage(
                                                    tabs[0].id, dataToSend, function(response) {
                                                        console.log(`${event.target.id} deleted!`)
                                                        document.location.reload();
                                                    }
                                                )
                                            }
                                        
                                        //============================================================================
                                        // ADD EVENT LISTENERS FOR ALL THE PLAY BUTTONS FOR TILES
                                        const play_buttons = document.querySelectorAll('.play_button')
                                        play_buttons.forEach(function(currentBtn)
                                        {
                                            currentBtn.addEventListener('click', handlePlayEvent)
                                          })
                                        function handlePlayEvent(event)
                                            {
                                                var newURL = "https://www.youtube.com/watch?v="+event.target.id;
                                                chrome.tabs.create({ url: newURL });
                                            }
                                        
                                        //============================================================================
                                        // ADD VID COUNT TO BANNER
                                        const vidCountElement = document.createElement("p");
                                        vidCountElement.textContent = "Vid Count:"+num
                                        document.querySelectorAll('.stats-total')[0].appendChild(vidCountElement)
                                        
                                        
                                }

                            else
                                {
                                    watchdata_details_ele.style.display = "none";
                                    document.getElementsByClassName("watchDataDiv")[0].remove()
                                    document.location.reload();
                                    return
                                }


                        }
                    )
                }
            
            chrome.tabs.query({active: true, currentWindow: true}, showWatchtFunct)

        }

        // EXPORT WATCH DATA SECTION
        document.getElementById("exportWatchDataBtn").addEventListener("click", exportWatchData);
        function exportWatchData ()
        {
            function exportTabFunc(tabs) 
                        {
                            console.log(`Current Page: ${tabs[0].url}`)
                            if (!tabs[0].url.includes("youtube.com"))
                            {
                                console.log('Not on a youtube page');
                                alert("Switch to a Youtube tab to run");
                                return
                            }

                            dataToSend =  {
                                message: "autoFill",
                                type: "syncData" 
                            }

                            chrome.tabs.sendMessage(
                                tabs[0].id, dataToSend, function(response) {
                                    console.log(response) // Data received from front end as JSON

                                    var contentType = 'text/json';
                                    var jsonFile = new Blob([JSON.stringify(response.data)], {type: contentType});
        
                                    var a = document.createElement('a');
                                    a.download = 'watchdata.json';
                                    a.href = window.URL.createObjectURL(jsonFile);
                                    a.textContent = 'Watchdata download link';
        
                                    a.dataset.downloadurl = [contentType, a.download, a.href].join(':');
        
                                    document.body.appendChild(a);
                                    
                                    // // Display watchdata section
                                    // const container = document.createElement("div");
                                    // container.className = "watchDataTextDiv"
                                    // const infoEleTitle = document.createElement("span");
                                    // infoEleTitle.textContent = JSON.stringify(response.data)
                        
                                    // container.appendChild(infoEleTitle);
                                    // document.body.appendChild(container);
                                }
                            )
                }

            chrome.tabs.query({active: true, currentWindow: true}, exportTabFunc)
        }

        // IMPORT WATCH DATA SECTION
        document.getElementById("importWatchDataBtn").addEventListener("click", importWatchData);
        function importWatchData ()
        {
            // Sets/syncs the backend watchData witn the response from front end
            // Send message to content script to fetch data

            function importTabFunct(tabs) 
                        {
                            console.log(`Current Page: ${tabs[0].url}`)
                            if (!tabs[0].url.includes("youtube.com"))
                            {
                                console.log('Not on a youtube page');
                                alert("Switch to a Youtube tab to run");
                                return
                            }

                            var inputForm = document.createElement('input');
                            inputForm.type = "file"
                            inputForm.id = "jsonFile"
                            inputForm.accept = ".json"

                            var submitForm = document.createElement('input');
                            submitForm.type = "submit"
                            submitForm.value = "Submit"

                            document.querySelectorAll('.importControls')[0].appendChild(inputForm)
                            document.querySelectorAll('.importControls')[0].appendChild(document.createElement("br"))
                            document.querySelectorAll('.importControls')[0].appendChild(submitForm)
                            document.querySelectorAll('.importControls')[0].after(document.createElement("br"))

                            const myForm = document.getElementById("importControls");
                            const jsonFile = document.getElementById("jsonFile");

                            myForm.addEventListener("submit", function (e) {
                                e.preventDefault();
                                const input =jsonFile.files[0];
                                const reader  = new FileReader();
                                reader.onload = function (e) 
                                {
                                   const text = e.target.result;
                                   document.write(text);

                                   dataToSend =  {
                                    message: "autoFill",
                                    type: "importData" ,
                                    data: JSON.parse(text)
                                }

                                chrome.tabs.sendMessage(
                                    tabs[0].id, dataToSend, function(response) {
                                        console.log(response) // Data received from front end as JSON
    
                                        //Display message from front end that data has been received
    
                                    }
                                )

                                };
                                reader.readAsText(input);
                             });
                            

                        }
            chrome.tabs.query({active: true, currentWindow: true}, importTabFunct)
        }
        
    }
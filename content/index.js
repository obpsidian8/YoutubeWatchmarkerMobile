document.addEventListener("DOMContentLoaded" ,function ()
    {
        var watchData = ""
        var watchDataDetails = ""
        console.log("The popup content has been loaded")
        var _lsTotal = 0,
        _xLen, _x;
        for (_x in localStorage) 
        {
            if (!localStorage.hasOwnProperty(_x)) 
                {
                    continue;
                }
                _xLen = ((localStorage[_x].length + _x.length) * 2);
                _lsTotal += _xLen;
                console.log(_x.substr(0, 50) + " = " + (_xLen / 1024).toFixed(2) + " KB")
                if (_x.substr(0, 50).includes("watchData"))
                    {
                        watchData = _x.substr(0, 50) + " Usage: " + (_xLen / 1024).toFixed(2) + "KB"
                        
                    }
        };
        console.log("Total = " + (_lsTotal / 1024).toFixed(2) + "KB");

        if (watchData === "")
            {
                watchData = "Total watchData Usage: 0KB"
            }

        const TotalUsedEle = document.createElement("p");
        const watchDataEle = document.createElement("p");

        TotalUsedEle.textContent = "Total Local Storage Used (of 5MB): " + (_lsTotal / 1024).toFixed(2) + "KB (" + ((_lsTotal / 1024)/ 50).toFixed(2) + ") %"
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
                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                        chrome.tabs.sendMessage(tabs[0].id, 
                            {
                                message: "autoFill",
                                type: "clearWatchData" 
                            }, function(response) {})
                    })
    
                    // END SEND MESSAGE
                }
        }
        
        document.getElementById("showWatchDataBtn").addEventListener("click", showWatchData);
        function showWatchData () 
        {
            // Sync data first
            dataToSend =  {
                message: "autoFill",
                type: "syncData" 
            }
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(
                        tabs[0].id, dataToSend, function(response) {
                            console.log(response) // Data received from front end as JSON
                            window.localStorage.setItem("watchData", JSON.stringify(response.data)); // Set the backend watchData witn the response from front end
                        }
                    )
            })
            
            // Show data section
            var watchdata_details_ele = document.getElementById("watchdata_details");
            if (watchdata_details_ele.style.display==="none" ||  watchdata_details_ele.style.display==="")
                {
                    watchdata_details_ele.style.display = "block";
                    // Get details of watchData
                    var currentWatchDataObj = window.localStorage.getItem("watchData");
                    currentWatchDataObj = JSON.parse(currentWatchDataObj);
                    for (property in currentWatchDataObj)
                        {
                            const container = document.createElement("div");
                            container.className = "watchDataDiv"

                            const divider = document.createElement("hr")
                            divider.className = "divider"
                            const dividerA = divider.cloneNode(true);

                            const infoEleTitle = document.createElement("span");
                            const infoElePercentPlayed = document.createElement("span");
                            const infoEleVidId = document.createElement("span");

                            infoEleTitle.textContent = "Title: "+currentWatchDataObj[property].title
                            infoElePercentPlayed.textContent = "Played: " + Math.floor(((currentWatchDataObj[property].timeInfo.percentPlayed))*100) +"%" + " (" + Math.floor((currentWatchDataObj[property].timeInfo.currentTime)/60) + " min " + Math.floor((currentWatchDataObj[property].timeInfo.currentTime)%60) + " s)"
                            infoEleVidId.textContent =  "Vid id: " + currentWatchDataObj[property].vidId
                            // infoEleVidId.href = "https://m.youtube.com/watch?v=" + currentWatchDataObj[property].vidId;

                            container.appendChild(infoEleTitle);
                            container.appendChild(divider);
                            container.appendChild(infoElePercentPlayed);
                            container.appendChild(dividerA);
                            container.appendChild(infoEleVidId);

                            firstChildEle = document.querySelectorAll('.watchdata_details')[0].firstElementChild;

                            if (!firstChildEle)
                                {
                                    document.querySelectorAll('.watchdata_details')[0].appendChild(container);
                                }
                            else
                                {
                                    document.querySelectorAll('.watchdata_details')[0].insertBefore(container, firstChildEle)
                                }

                            
                        }
                }

            else
                {
                    watchdata_details_ele.style.display = "none";
                    document.getElementsByClassName("watchDataDiv")[0].remove()
                    document.location.reload();
                    return
                }
        }

        document.getElementById("syncWatchDataBtn").addEventListener("click", syncWatchData);
        function syncWatchData ()
        {
            
            // Sets/syncs the backend watchData witn the response from front end
            // Send message to content script to fetch data
            dataToSend =  {
                message: "autoFill",
                type: "syncData" 
            }
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(
                        tabs[0].id, dataToSend, function(response) {
                            console.log(response) // Data received from front end as JSON
                            window.localStorage.setItem("watchData", JSON.stringify(response.data)); // Set the backend watchData witn the response from front end
                        }
                    )
            })
            // END SEND MESSAGE
            // Message Display section
            const syncMsg = document.createElement("p");
            syncMsg.style = "text-align: center;"
            syncMsg.id = "syncClearMsg"
            syncMsg.textContent = "Watch Data Synced!"
            document.querySelectorAll(".syncDataBtn")[0].appendChild(syncMsg);

            setTimeout(function () {
                document.getElementById('syncClearMsg').style.display = 'none'
                document.location.reload()
            }, 3000)

        }
        
    }
);


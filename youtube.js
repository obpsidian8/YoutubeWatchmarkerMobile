console.log("loading youtube.js")
var strLastchange = null;
var objVideocache = [];
var objProgresscache = [];
var boolMarkcache = {};
var currentTime = 0;
var vidDuration =  null;
var currentVideo = null;
var vidsWatched  = {}
var checkPageCount = 0;
var currentpage = null;

console.log(`Loading watchData via content script`)

// Data will be refreshed each time the page is loaded
var vidsWatched = window.localStorage.getItem("watchData"); //STRING
if (!vidsWatched)
    {
        var vidsWatched = {}; //JSON
        window.localStorage.setItem("watchData", JSON.stringify(vidsWatched)) //STRING
    }
else
    {
        var vidsWatched = JSON.parse(vidsWatched) //JSON
    }
console.log(vidsWatched)

// ##########################################################
function refresh ()
    {
        console.log('Starting function for refresh');
        console.log(`objVideocache ${objVideocache}`);
        console.log(objVideocache);
        console.log(`objProgresscache ${objProgresscache}`);
        console.log(objProgresscache);
        console.log(`vidsWatched ${vidsWatched}`);
        console.log(vidsWatched);

        for (vidObj of objVideocache) 
            {
                // Get the vid id of the current video object from watched vids
                vidId = vidObj.href.split('&')[0].slice(-11);
                // console.log(`Checking if video ${vidId}`)
                if (vidsWatched[vidId])
                    {
                        console.log(`${vidId} IS IN vidsWatched`)
                        watchedVidObject = vidsWatched[vidId]
                        percentPlayed = watchedVidObject["timeInfo"]["percentPlayed"]
                        mark(vidObj, percentPlayed, true);
                    }
                else 
                    {
                        console.log(`${vidId} NOT in vidsWatched`)
                    }
            }
    };


function mark (objVideo,percentPlayed, boolMark)
    {
        console.log(`Marking video: ${objVideo.href}`)
        if ((boolMark === true) ) 
        {
            objVideo.classList.add('youwatch-mark');
            objVideo.style = "opacity:0.4";

            try {
                element = objVideo.querySelector('.yt-core-attributed-string');
                objVideo.querySelector('.yt-core-attributed-string').textContent
                element.textContent = "seen| " + element.textContent
              } 
            catch (err) 
                {
                console.log(`Error: ${err}`)
                }

            createOverlay(objVideo,percentPlayed);
        } 
        
        else if ((boolMark !== true) && (objVideo.classList.contains('youwatch-mark') !== false)) 
        {
            objVideo.classList.remove('youwatch-mark');
            objVideo.style = "opacity:1";
        }

    };

function createOverlay (objVideo, percentPlayed)
    {
        const playbackOverlayElement = document.createElement("div");
        playbackOverlayElement.className = "thumbnail-overlay-resume-playback-progress"
        playbackOverlayElement.style= "width: "+(percentPlayed *100)+"%"

        console.log(`About to overlay video: ${objVideo}`);
        var targetElement = objVideo.lastChild.lastChild
        if (targetElement === null)
            {
                targetElement = objVideo.closest('.style-scope.ytd-rich-grid-media');
                objVideoChild = targetElement.querySelectorAll('.thumbnail-overlay-resume-playback-progress')[0]
                if (objVideoChild)
                    {
                        console.log(`Overlay already present`)
                        return
                    }
                targetElement.appendChild(playbackOverlayElement);
                targetElement.insertBefore(targetElement.querySelectorAll('.youwatch-mark')[0], playbackOverlayElement);
            }
        else
            {
                targetElement.appendChild(playbackOverlayElement);
            }
            

    };

// ##########################################################
chrome.runtime.onMessage.addListener(messageReceivedProcess);
function messageReceivedProcess (objData, objSender, funcResponse)
    {
        console.log('Message received from background. Processing.');
        if (objData.type === "NEW")
            {
                console.log(`Received message from background that page has changed.`);
                refresh();
                funcResponse(null);
            }
        else if (objData.type === "clearWatchData")
            {
                console.log(`Received clearWatchData  message from content. Details:`);
                window.localStorage.removeItem("watchData");
                window.localStorage.setItem("watchData", JSON.stringify({}));
                funcResponse(null);
            }
        else if (objData.type === "syncData")
        {
            console.log(`Received syncDataBtn  message from content. Sending back watchdata:`);
            funcResponse({"data": vidsWatched});
        }
        console.log("Done messageReceivedProcess")
        
        return true
    };

// ##########################################################
// This will set the interval to update the list of elements on the page and also to send time info to backend. Need to be fast beause you scroll the page quickly
// Updates data from the page at given interval
window.setInterval(checkPage, 300);
function checkPage()
    {
        if (checkPageCount % 20 === 0)
            {
                console.log(`Checking page for new elements ${checkPageCount}`)
            }
        
        
        // if (document.hidden === true) {
        //     return;
        // }

        if (document.URL.includes("youtube.com/watch")) 
            {
                var vidId = document.URL.split('v=')[1].split("#")[0];
                if (vidId.includes("&"))
                {
                    vidId = vidId.split("&")[0]
                }

                if (vidsWatched[vidId] && currentpage != document.URL)
                {
                    // Start the video from last played time
                    let watchedVidObject = vidsWatched[vidId]
                    let latestTimePlayed = Math.floor(watchedVidObject["timeInfo"]["currentTime"])
                    document.getElementsByClassName('video-stream')[0].currentTime = latestTimePlayed
                    currentpage = document.URL
                }

                if (isNaN(parseFloat(vidDuration))) 
                    {
                        vidDuration = document.getElementsByClassName('video-stream')[0].duration;
                        console.log(`Total time for video: ${document.URL}: ${vidDuration}`);
                    };

                
                if (vidDuration === null) 
                {
                    console.log(`Vid has not started playing yet`)
                    //  block of code to be executed if the condition is true
                }
                else 
                    {
                        console.log(`Vid has started playing!`)
                        // console.log(`Getting current position for video: ${document.URL}`)
                        currentTime = document.getElementsByClassName('video-stream')[0].currentTime;
                        console.log(`Current vid time for ${document.URL}: ${currentTime}`);

                        var fractionWatched =currentTime/vidDuration

                        if (fractionWatched >= 0.98)
                            {
                                console.log(`Video has finished playing`)
                            }
                        else if ((vidDuration<120 && fractionWatched >0.5 )  || (vidDuration>120 && currentTime >60) )
                        // else
                            {
                                console.log(`Enough time has passed for vid! video will be stored`)
                                // Send message to backend with time of video
                                console.log(`Sending current vid details to background`)
                                message = { "timeInfo": {  "currentTime":currentTime, 
                                                        "totalDuration": vidDuration, 
                                                        },
                                            "vidUrl": document.URL,
                                            "title": document.title,
                                            "msgType": "vidPlayingInfo",
                                            "vidId": vidId
                                        }

                                chrome.runtime.sendMessage
                                (message, 
                                            function (response) 
                                            {
                                                // console.log();
                                            }

                                );
                                            
                                // Save data to localStorage from frontend
                                percentPlayed = message.timeInfo.currentTime/message.timeInfo.totalDuration
                                var details = { 
                                            "vidId": vidId,
                                            "vidUrl": message.vidUrl,
                                            "title": message.title,
                                            "timeInfo": {  "currentTime":message.timeInfo.currentTime, 
                                                            "totalDuration": message.timeInfo.totalDuration,
                                                            "percentPlayed": percentPlayed
                                                        }
                                            };
                            
                                var currentWatchDataObj = window.localStorage.getItem("watchData"); // result is a STRING
                                currentWatchDataObj = JSON.parse(currentWatchDataObj) //turn to JSON to modify
                                console.log(details);
                                currentWatchDataObj[vidId] = details
                                console.log(`currentWatchDataObj:-`);
                                console.log(currentWatchDataObj);
                                window.localStorage.setItem("watchData", JSON.stringify(currentWatchDataObj)); // turn to STRING to set
                            }
                    }
            }

        checkPageCount = checkPageCount +1;
        objVideocache = window.document.querySelectorAll('a.ytd-thumbnail[href^="/watch?v="],a.compact-media-item-image[href^="/watch?v="], a.media-item-thumbnail-container[href^="/watch?v="], a.ytd-thumbnail[href^="/shorts/"]');
        objProgresscache = window.document.querySelectorAll('ytd-thumbnail-overlay-resume-playback-renderer');
        if (strLastchange === window.location.href + ':' + window.document.title + ':' + objVideocache.length + ':' + objProgresscache.length) 
        {
            return;
        }

        strLastchange = window.location.href + ':' + window.document.title + ':' + objVideocache.length + ':' + objProgresscache.length;
        console.log(`strLastchange: ${strLastchange}`)
        refresh();
        
    };


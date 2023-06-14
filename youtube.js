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

function initWatchData ()
    {
        // Data will be refreshed each time the page is loaded
        vidsWatched = window.localStorage.getItem("watchData"); //STRING
        if (!vidsWatched)
            {
                vidsWatched = {}; //JSON
                window.localStorage.setItem("watchData", JSON.stringify(vidsWatched)) //STRING
            }
        else
            {
                vidsWatched = JSON.parse(vidsWatched) //JSON
            }
        
    };
initWatchData();
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
        var targetElement = objVideo.lastChild.lastChild // target element for mobile page
        if (targetElement === null)
            {
                targetElement = objVideo.closest('.style-scope.ytd-rich-grid-media'); // target element for desktop page
                
                // ###################################################################################################
                objVideoChild = null
                objVideoChildList = targetElement.querySelectorAll('.thumbnail-overlay-resume-playback-progress')
                if (objVideoChildList)
                    {
                        objVideoChild = objVideoChildList[0]
                    }

                if (objVideoChild)
                    {
                        console.log(`Overlay already present`)
                        return
                    }
                // ###################################################################################################
                
                targetElement.appendChild(playbackOverlayElement);
                targetElement.insertBefore(targetElement.querySelectorAll('.youwatch-mark')[0], playbackOverlayElement); //Placing target element for desktop page
            }
        else
            {
                targetElement.appendChild(playbackOverlayElement); // Placing overlay element for mobile page
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
            initWatchData();
            funcResponse({"data": vidsWatched});
        }
        else if (objData.type === "importData")
        {
            console.log(`Received importData  message from popup.`);
            console.log(objData.data)
            responseMessage = {
                message: "Frontend has processed imported data"
            }
            funcResponse(responseMessage);
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

                vidDuration = document.getElementsByClassName('video-stream')[0].duration;
                if (checkPageCount % 20 === 0)
                {
                    console.log(`Total time for video: ${document.URL}: ${vidDuration}`);
                }
                
                // if (isNaN(parseFloat(vidDuration))) 
                //     {
                //         vidDuration = document.getElementsByClassName('video-stream')[0].duration;
                //         console.log(`Total time for video: ${document.URL}: ${vidDuration}`);
                //     };
                
                if (isNaN(parseFloat(vidDuration))) 
                    {
                        if (checkPageCount % 20 === 0)
                        {
                            console.log(`Vid ${vidId} has not started playing yet`)
                        }
                    }
                else 
                    {
                        
                        if (checkPageCount % 20 === 0)
                        {
                            console.log(`Vid ${vidId} has started playing!`)
                        }
                        
                        if (vidsWatched[vidId] && currentpage != document.URL)
                        {
                            // Start the video from last played time
                            let watchedVidObject = vidsWatched[vidId]
                            let latestTimePlayed = Math.floor(watchedVidObject["timeInfo"]["currentTime"])
                            console.log(`Resuming ${vidId} from last location ${latestTimePlayed}`)
                            document.getElementsByClassName('video-stream')[0].currentTime = latestTimePlayed
                            currentpage = document.URL
                        }


                        // console.log(`Getting current position for video: ${document.URL}`)
                        currentTime = document.getElementsByClassName('video-stream')[0].currentTime;
                        console.log(`Current vid time for ${document.URL}: ${currentTime}`);
                        var fractionWatched =currentTime/vidDuration;

                        if (fractionWatched >= 0.98)
                            {
                                console.log(`Video has finished playing`)
                            }
                        else if ((vidDuration<120 && fractionWatched >0.5 )  || (vidDuration>120 && currentTime >60) )
                        // else
                            {
                                console.log(`Enough time has passed for vid! video will be stored`)
                                message = { "timeInfo": {  "currentTime":currentTime, 
                                                        "totalDuration": vidDuration, 
                                                        },
                                            "vidUrl": document.URL,
                                            "title": document.title,
                                            "msgType": "vidPlayingInfo",
                                            "vidId": vidId
                                        }

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
        // console.log(`strLastchange: ${strLastchange}`)
        refresh();
        
    };


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

console.log(`Loading watchData via content script`)
var vidsWatched = window.localStorage.getItem("watchData");
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
            objVideo.style = "opacity:0.35";
            element = objVideo.querySelector('.yt-core-attributed-string');
            objVideo.querySelector('.yt-core-attributed-string').textContent
            element.textContent = "seen| " + element.textContent
            createOverlay(objVideo,percentPlayed);
            // objVideo.lastChild.lastChild.lastChild.lastChild.lastChild.lastChild.textContent = objVideo.lastChild.lastChild.lastChild.lastChild.lastChild.lastChild.textContent + " WATCHED"
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

        vidId = vidObj.href.split('&')[0].slice(-11);

        for (var objVideo of document.querySelectorAll('a.ytd-thumbnail[href^="/watch?v=' + vidId + '"], a.compact-media-item-image[href^="/watch?v=' + vidId + '"], a.media-item-thumbnail-container[href^="/watch?v=' + vidId + '"], a.ytd-thumbnail[href^="/shorts/' + vidId + '"]')) 
        {
            console.log(` About to overlay video: ${objVideo}`);
            var targetElement = objVideo.lastChild.lastChild
            if (targetElement === null)
                {
                    targetElement = objVideo.lastElementChild
                }

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
                console.log(`Received vidswatched message from background. Details:`);
                // vidsWatched = objData.vidsWatched
                // vidsWatched = JSON.parse(vidsWatched)
                // console.log(`vidsWatched from listener${vidsWatched}`);
                // console.log(vidsWatched);
                // currentVideo = objData.videoId;
                console.log(objData)
                refresh();
            }
        else if (objData.type === "clearWatchData")
            {
                console.log(`Received clearWatchData  message from content. Details:`);
                window.localStorage.removeItem("watchData");
                window.localStorage.setItem("watchData", JSON.stringify({}));
            }
        console.log("Done messageReceivedProcess")
        funcResponse(null);
    };

// ##########################################################
// This will set the interval to update the list of elements on the page and also to send time info to backend. Need to be fast beause you scroll the page quickly
// Updates data from the page at given interval
window.setInterval(checkPage, 300);
function checkPage()
    {
        console.log(`Checking page for new elements ${checkPageCount}`)
        // if (document.hidden === true) {
        //     return;
        // }

        if (document.URL.includes("youtube.com/watch")) 
            {
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
                        else if (fractionWatched > 0.2)
                            {
                                console.log(`Enough time has passed for vid! video will be stored`)
                                // Send message to backend with time of video
                                console.log(`Sending current vid details to background`)
                                message = { "timeInfo": {  "currentTime":currentTime, 
                                                        "totalDuration": vidDuration, 
                                                        },
                                            "vidUrl": document.URL,
                                            "title": document.title,
                                            "msgType": "vidPlayingInfo"
                                        }

                                chrome.runtime.sendMessage
                                (message, 
                                            function (response) 
                                            {
                                                // console.log(JSON.parse(response.vidsWatched));
                                            }

                                );
                                            
                                // Save data to localStorage from frontend
                                var vidId = message.vidUrl.split('v=')[1].split("#")[0];
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
                            
                                var currentWatchDataObj = window.localStorage.getItem("watchData");
                                currentWatchDataObj = JSON.parse(currentWatchDataObj) //JSON
                                console.log(details);
                                currentWatchDataObj[vidId] = details
                                console.log(`currentWatchDataObj:-`);
                                console.log(currentWatchDataObj);
                                window.localStorage.setItem("watchData", JSON.stringify(currentWatchDataObj));
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


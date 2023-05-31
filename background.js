
console.log("Loading background.js")
console.log("Initializing storage")
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
chrome.tabs.onUpdated.addListener(tabsUpdatedProcess);
function tabsUpdatedProcess (tabId,changeInfo, tab)
    {
        console.log(`........................................................`)
        console.log(`UPDATE EVENT FIRED! URL: ${tab.url}, Tab id: ${tab.id}`)
        if (tab.url && tab.url.includes("youtube.com"))
            {
                console.log(`YOUTUBE VIDEO PLAYER PAGE: ${tab.url}`);

                chrome.tabs.insertCSS(tab.id, {
                    'code': 'ytd-thumbnail-overlay-resume-playback-renderer { display:none !important; }'
                });

                chrome.tabs.insertCSS(tab.id, {
                    'code': '.youwatch-mark:last-of-type:after { background-color:#000000; border-radius:2px; color:#FFFFFF; content:"WATCHED"; font-size:11px; left:4px; opacity:0.8; padding:3px 4px 3px 4px; position:absolute; top:4px; !important;}'
                });

                chrome.tabs.insertCSS(tab.id, {
                    'code': '.youwatch-mark yt-img-shadow img { filter:grayscale(1.0); }' + '.youwatch-mark yt-image img { filter:grayscale(1.0); }'
                });

                chrome.tabs.insertCSS(tab.id, {
                    'code': '.youwatch-mark yt-img-shadow img { opacity:0.3; }' + '.youwatch-mark yt-image img { opacity:0.3; }'
                });
                
                const queryparameters = tab.url.split("?")[1];
                const urlParamaters = new URLSearchParams(queryparameters);
                console.log(`urlParamaters: ${urlParamaters}`)
                var currentWatchDataObj = window.localStorage.getItem("watchData");
                var message  =  {
                    "type": "NEW",
                    "videoId": urlParamaters.get("v"),
                    "vidsWatched":currentWatchDataObj
                }
                console.log(`Message: ${message}`)
                console.log(message)
                chrome.tabs.sendMessage(tabId, message);
            }
        
    };

// Listen for message from contet script that has the time information
chrome.runtime.onMessage.addListener(processMsgFromFrontend);
function processMsgFromFrontend (message, sender, sendResponse)
    {
        console.log(`+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++`)
        console.log(`MESSAGE RECEIVED FROM CONTENT SCRIPT!`)
        if (message.msgType==="vidPlayingInfo")
            {
                console.log(message);
                console.log(`Current Vid Url: ${message.vidUrl}`);
                console.log(`Current Vid TIme: ${message.timeInfo.currentTime}`);
                console.log(`Total Vid TIme: ${message.timeInfo.totalDuration}`);
                console.log(`Fraction Watched : ${message.timeInfo.currentTime/message.timeInfo.totalDuration}`);
                // console.log(message.timeInfo.currentTime< 60);
                if (message.timeInfo.totalDuration === null) 
                    {
                        console.log(`Vid has not started playing yet`)
                        return;
                        //  block of code to be executed if the condition is true
                    }
        
                console.log(`Storing vid details on backend`)
                percentPlayed = message.timeInfo.currentTime/message.timeInfo.totalDuration
                var details = { 
                            "vidId": message.vidId,
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
                currentWatchDataObj[message.vidId] = details
                console.log(`currentWatchDataObj:-`);
                console.log(currentWatchDataObj);
                window.localStorage.setItem("watchData", JSON.stringify(currentWatchDataObj));

                // Callback for that message
                var messageResponse  =  {
                    "type": "NEW",
                    "videoId": null,
                    "vidsWatched":currentWatchDataObj,
                    "message": "Background has received that message ?"
                }
                sendResponse({"messageResponse": messageResponse});


            }


    };




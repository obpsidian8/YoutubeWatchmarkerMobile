console.log("Loading background.js")
chrome.tabs.onUpdated.addListener(tabsUpdatedProcess);
function tabsUpdatedProcess (tabId,changeInfo, tab)
    {
        console.log(`....................................................................`)
        console.log(`*UPDATE EVENT FIRED! URL: ${tab.url}, Tab id: ${tab.id}`)
        console.log(`changeInfo: ${JSON. stringify(changeInfo)}`)
        console.log(`changeInfo.status: ${changeInfo.status}`)
        if (tab.url && tab.url.includes("youtube.com"))
            {
                //Inject css into page
                console.log(`UPDATE EVENT FIRED FOR YOUTUBE PAGE: ${tab.url}`);
                chrome.tabs.insertCSS(tab.id, {
                    file: "youtube.css"
                });
                
                // Inject script into page
                chrome.tabs.executeScript(tab.id, {
                    "file": "youtube.js"
                }, function () {
                    console.log("***Main Script Executed***"); // Notification on Completion
                })

                var message  =  {
                    "type": "NEW",
                }
                console.log(message)
                chrome.tabs.sendMessage(tab.id, message);

            }
        
    };






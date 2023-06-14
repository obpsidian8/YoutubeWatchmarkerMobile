console.log("Loading background.js")
chrome.tabs.onUpdated.addListener(tabsUpdatedProcess);
function tabsUpdatedProcess (tabId,changeInfo, tab)
    {
        console.log(`........................................................`)
        console.log(`UPDATE EVENT FIRED! URL: ${tab.url}, Tab id: ${tab.id}`)
        if (tab.url && tab.url.includes("youtube.com"))
            {
                console.log(`YOUTUBE PAGE: ${tab.url}`);
                chrome.tabs.insertCSS(tab.id, {
                    file: "youtube.css"
                });

            }
        
    };






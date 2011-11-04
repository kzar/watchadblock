// Schedules an function to be executed when the computer is idle.
// Call idleHandler.scheduleItem to schedule a function for exection upon idle
// inputs: theFunction: function to be executed
//         maxWaitTime: maximum time to wait upon idle, in seconds
var idleHandler = {
  scheduleItem:
    function(callback, maxWaitTime) {
      if (SAFARI) {
        callback();
        return;
      }
      idleHandler.scheduledItems.push(callback);
      if (maxWaitTime)
        idleHandler.maxDelay = Math.min(idleHandler.maxDelay, maxWaitTime * 2);
      if (!idleHandler.timer)
        idleHandler.timer = window.setInterval(idleHandler.checkExecutingTime, 500);
    },
  maxDelay:
    600 * 2, // Wait 10 minutes at max, 2 checks/second
  timer:
    null,
  scheduledItems:
    [],
  checkExecutingTime:
    function() {
      chrome.idle.queryState(15, function(state) {
        idleHandler.maxDelay -= 1;
        if (state == "idle" || idleHandler.maxDelay <= 0) {
          idleHandler.maxDelay = 600 * 2;
          idleHandler.timer = window.clearInterval(idleHandler.timer);
          for (i=0; i<idleHandler.scheduledItems.length; i++)
            idleHandler.scheduledItems[i]();
          idleHandler.scheduledItems = [];
        }
      })
    }
};
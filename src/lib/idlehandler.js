"use strict";

// Schedules a function to be executed in the future.
// inputs: theFunction: function to be executed
//         seconds: maximum time to wait upon idle, in seconds. 15000 if omitted.
exports.idleHandler = {
    scheduleItemOnce: function (callback, seconds) {
        // FF doesn't support idle, but at least we make sure that functions
        // don't execute when we're too busy to handle them.
        require('sdk/timers').setTimeout(callback, (seconds || 15000));
    },
};

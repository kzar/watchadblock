    self.on("click", function (node, data) {
        var uniqueID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });    
        node.setAttribute("data-getadblock-com-id", uniqueID);
        self.postMessage(node.getAttribute("data-getadblock-com-id"));
    });
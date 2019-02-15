var interval;
self.addEventListener('message', function (e) {
    switch (e.data) {
        case 'start':
            interval = setInterval(function () {
                self.postMessage('tick');
            }, 100);
            break;
        case 'stop':
            clearInterval(interval);
            break;
    }
    ;
}, false);
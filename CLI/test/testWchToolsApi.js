// This provides an example of how the import artifacts service might call
// the wchToolsApi to execute a push or delete operation on the tenant.

const wchToolsApi = require("wchtools-api");

const log = function(level) {
    return function (...args) {
        console.log(level, args);
    };
};

const logger = {
    "error": log('ERROR'),
    "warn":  log('WARN'),
    "info":  log('INFO'),
    "trace": log('TRACE'),
    "debug": log('DEBUG'),
    "isDebugEnabled": function () {
        return true;
    }
};

/*
Example of service URLS:
    result = {
        'image-profiles': 'http://dx-marathon-3-slave7.rtp.raleigh.ibm.com:31281',
        'types': 'http://dx-marathon-3-slave2.rtp.raleigh.ibm.com:10631',
        'categories': 'http://dx-marathon-3-slave3.rtp.raleigh.ibm.com:11765',
        'assets': 'http://dx-marathon-3-slave5.rtp.raleigh.ibm.com:31148',
        'resources': 'http://dx-marathon-3-slave4.rtp.raleigh.ibm.com:31200',
        'content': 'http://dx-marathon-3-slave3.rtp.raleigh.ibm.com:31060',
        'default-content': 'http://dx-marathon-3-slave3.rtp.raleigh.ibm.com:31060',
        'renditions': 'http://dx-marathon-3-slave6.rtp.raleigh.ibm.com:9256',
        'layouts': 'http://dx-marathon-3-slave2.rtp.raleigh.ibm.com:77777',
        'layouts-mappings': 'http://dx-marathon-3-slave2.rtp.raleigh.ibm.com:77777',
        'sites': 'http://dx-marathon-3-slave2.rtp.raleigh.ibm.com:77777'
    }
*/
const urls = {
    'image-profiles': 'http://dx-marathon-3-slave7.rtp.raleigh.ibm.com:31281',
    'types': 'http://dx-marathon-3-slave2.rtp.raleigh.ibm.com:10631',
    'categories': 'http://dx-marathon-3-slave3.rtp.raleigh.ibm.com:11765',
    'assets': 'http://dx-marathon-3-slave5.rtp.raleigh.ibm.com:31148',
    'resources': 'http://dx-marathon-3-slave4.rtp.raleigh.ibm.com:31200',
    'content': 'http://dx-marathon-3-slave3.rtp.raleigh.ibm.com:31060',
    'default-content': 'http://dx-marathon-3-slave3.rtp.raleigh.ibm.com:31060',
    'renditions': 'http://dx-marathon-3-slave6.rtp.raleigh.ibm.com:9256',
    'layouts': 'http://dx-marathon-3-slave2.rtp.raleigh.ibm.com:77777',
    'layouts-mappings': 'http://dx-marathon-3-slave2.rtp.raleigh.ibm.com:77777',
    'sites': 'http://dx-marathon-3-slave2.rtp.raleigh.ibm.com:77777'
};

const wch = new wchToolsApi({ logger: logger, urls: urls });
wch.deleteManifestItems({ manifest: '/acoustic/sites/spa/manifests/spa-9.0.11268.json', serverManifest: true, workingDir: '/usr/src/app/workspace/cd065a24-ad0b-468c-943d-7c018cda8dd0' });


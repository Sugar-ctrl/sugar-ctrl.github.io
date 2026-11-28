'use strict';

// Run every test file in one process. This also works in restricted sandboxes
// where Node's test runner cannot spawn child processes.
require('./level.test.js');
require('./physics.test.js');
require('./camera.test.js');
require('./render-smoke.test.js');
require('./settings.test.js');
require('./mechanics.test.js');

// Maestro runScript helper: pin the mock API server's active scenario for the
// current flow. This runs on the HOST machine (where the Maestro CLI lives), not
// on the device/emulator, so it always reaches the mock at MOCK_URL — which
// defaults to localhost regardless of whether the app target is iOS or Android.
//
// Inputs (injected as globals by Maestro):
//   SCENARIO  required — one of the Scenario values the mock understands.
//   MOCK_URL  optional — defaults to http://localhost:4010.
var base = typeof MOCK_URL !== 'undefined' && MOCK_URL ? MOCK_URL : 'http://localhost:4010';

var response = http.post(base + '/__e2e/scenario', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ scenario: SCENARIO }),
});

if (!response.ok) {
  throw new Error('setScenario(' + SCENARIO + ') failed: HTTP ' + response.status);
}

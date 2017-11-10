// Require npm packages.
const fetch = require('node-fetch');
const commandLineArgs = require('command-line-args');

// Get partNumbers from json file.
const partNumbers = require('./partNumbers.json');

// Define command line args accepted.
const optionDefinitions = [
  { name: 'carrier', type: String, defaultValue: 'TMOBILE' },
  { name: 'model', type: String, defaultValue: 'x' },
  { name: 'color', type: String, defaultValue: 'gray' },
  { name: 'storage', type: String, defaultValue: '256' },
  { name: 'zip', type: String, defaultOption: true },
  { name: 'delay', type: Number, defaultValue: 30 },
];

// Parse command line args.
const options = commandLineArgs(optionDefinitions);

// Get part number for the specified device.
const partNumber =
  partNumbers[options.model][options.carrier.toUpperCase()][options.color][options.storage];

// Construct the endpoint url with the options selected.
const endpoint = `https://www.apple.com/shop/retail/pickup-message?pl=true&cppart=${options.carrier}/US&parts.0=${partNumber}&location=${options.zip}`;

// Keep track of the last request time.
let lastRequestTimestamp = null;

/**
 * Update program status display
 *
 * @param {String} str The string that will be outputed.
 */
function updateStatus() {
  if (lastRequestTimestamp === null) {
    return;
  }

  const timeDelta = Date.now() - lastRequestTimestamp;
  const timeInSeconds = Math.floor(timeDelta / 1000);
  process.stdout.write(`Status: Device not available. Last request made ${timeInSeconds} seconds ago\r`);
}

/**
 * Parse the returned data and find stores where the device is available
 *
 * @param {Object} data The api response.
 * @return {Array} The array of stores where the devices is available.
 */
function processResponse(data) {
  // Destructure the stores object out of the body.
  const { stores } = data.body;

  // Filter out stores that do not have the device available.
  const storesAvailable = stores.filter((store) => {
    // Select the specified device partNumber.
    const part = store.partsAvailability[partNumber];
    // Check that the pickupDisplay property says 'available'.
    const availability = part.pickupDisplay === 'available';
    // Return true if the device is available or else false.
    return availability;
  });

  // Return an array of stores where the device is available.
  return storesAvailable;
}

/**
 * Make a request to the endpoint and get list of stores available
 *
 * @return {Promise} A promise that should resolve to an array of stores available.
 */
function getStoresAvailable() {
  // Update lastRequestTimestamp.
  lastRequestTimestamp = Date.now();

  return fetch(endpoint)
    .then(stream => stream.json())
    .catch(error => process.stderr.write('Fetch Error :-S', error))
    .then(data => processResponse(data));
}

/**
 * Output list of stores where the device is avaliable.
 *
 * @param {Array} storesAvailable The array of stores where the device is avaliable.
 */
function displayStoresAvailable(storesAvailable) {
  // Construct the output string by reducing the storesAvailable array into a string.
  const storesAvailableStr = storesAvailable.reduce(
    (result, store) =>
      `${result}\n${store.address.address} which is ${store.storeDistanceWithUnit} away`,
    '',
  );

  // Output the message.
  process.stdout.write(`The device is currently available at ${storesAvailable.length} stores near you:`);
  process.stdout.write(storesAvailableStr);
  process.stdout.write('\n');
}

/**
 * The main program loop
 *
 * Continuously check for the device availability until it is available somewhere.
 */
async function requestLoop() {
  // Fetch the storesAvailable array.
  const storesAvailable = await getStoresAvailable();

  if (storesAvailable.length === 0) {
    // If the array is empty, update the status and after the
    // specified options.delay amount of seconds, try again.
    setTimeout(() => {
      requestLoop();
    }, options.delay * 1000);
  } else {
    // The device is available. Show that information to the user and exit the program.
    displayStoresAvailable(storesAvailable);
    process.exit();
  }
}

// Display program started message.
process.stdout.write('Starting program with the following settings:\n');
process.stdout.write(`${JSON.stringify(options, null, 2)}\n`);

// Kick off program.
setInterval(() => {
  updateStatus();
}, 1000);
requestLoop();

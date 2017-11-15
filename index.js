// Require npm packages.
const fetch = require('node-fetch');
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');
const push = require( 'pushover-notifications' );

// Get partNumbers from json file.
const partNumbers = require('./partNumbers.json');

// Define command line args accepted.
const optionDefinitions = [
  {
    name: 'carrier',
    type: String,
    defaultValue: 'TMOBILE',
    description:
      "Define which carrier to search for.  Accepted options are: 'ATT', 'SPRING', 'TMOBILE', 'VERIZON'.",
  },
  {
    name: 'model',
    type: String,
    defaultValue: 'x',
    description:
      "Define which model iPhone to search for.  'x' is the only option currently available.",
  },
  {
    name: 'color',
    type: String,
    defaultValue: 'gray',
    description:
      "Define which color iPhone to search for.  Accepted options are: 'silver', 'gray'.",
  },
  {
    name: 'storage',
    type: String,
    defaultValue: 256,
    description: "Define which storage size to search for.  Accepted options are: '64', '256'.",
  },
  {
    name: 'zip',
    type: String,
    defaultOption: true,
    description: 'Define the area to search in by zip code.  This option is required.',
  },
  {
    name: 'delay',
    type: Number,
    defaultValue: 30,
    description: 'Define the number of seconds between requests.',
  },
  { name: 'help', type: Boolean, description: 'Display this help screen.' },
];

// Parse command line args.
const options = commandLineArgs(optionDefinitions);

// Define the help screen to be displayed if --help is present in options
const usageDefinition = [
  {
    header: 'iPhone X Availability Node CLI',
    content:
      "The app continously makes requests to Apple's availability api. When it finds some new stock near you, it displays the stores' name and distance from your zipcode then exits the program.",
  },
  {
    header: 'Synopsis',
    content: [
      {
        desc: 'Default arguments.',
        example:
          '$ node index.js [bold]{--carrier} TMOBILE [bold]{--model} x [bold]{--color} gray [bold]{--storage} 256 [bold]{--delay} 30',
      },
      {
        desc: 'Simple example',
        example: '$ node index.js [bold]{--zip} 10001 [bold]{--color} silver',
      },
      {
        desc: 'Help screen.',
        example: '$ node index.js [bold]{--help}',
      },
    ],
  },
  {
    header: 'Options',
    optionList: optionDefinitions,
  },
];

// if --help is present or --zip wasn't defined,
// then display the help screen and exit the program.
if (options.help || options.zip === undefined) {
  console.log(getUsage(usageDefinition));
  process.exit();
}

// Get part number for the specified device.
const partNumber =
  partNumbers[options.model][options.carrier.toUpperCase()][options.color][options.storage];

// Construct the endpoint url with the options selected.
const endpoint = `https://www.apple.com/shop/retail/pickup-message?pl=true&cppart=${options.carrier}/US&parts.0=${partNumber}&location=${options.zip}`;

// Keep track of the last request time.
let lastRequestTimestamp = null;

// Construct push endpoint

const p = new push ( {
  user: process.env.PUSHOVER_USER,
  token: process.env.PUSHOVER_TOKEN
});

/**
 * Update program status display
 *
 * @param {String} str The string that will be outputed.
 */
function updateStatus() {
  // If lastRequestTimestamp hasn't been update yet, do nothing.
  if (lastRequestTimestamp === null) {
    return;
  }

  // Get the amount of time elapsed since last request.
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
  console.log(`The device is currently available at ${storesAvailable.length} stores near you:`);
  console.log(storesAvailableStr);
}

// Build the message
const msg = {
  message: 'iPhone X stock available nearby!',
  title: 'Important News!',
  priority: 2,
  retry: 60,
  expire: 1800
};

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
    p.send (msg, function (err, result){
      if (err) {
        throw err;
      }
    })
    process.exit();
  }
}

// Display program started message.
console.log('Starting program with the following settings:');
console.log(`${JSON.stringify(options, null, 2)}`);

// Update the display every second.
setInterval(() => {
  updateStatus();
}, 1000);

// Kick off request recursion.
requestLoop();

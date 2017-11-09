const fetch = require('node-fetch');
const commandLineArgs = require('command-line-args')

const optionDefinitions = [
  { name: 'carrier', type: String, defaultValue: 'TMOBILE' },
  { name: 'model', type: String, defaultValue: 'x' },
  { name: 'color', type: String, defaultValue: 'gray' },
  { name: 'storage', type: String, defaultValue: '256' },
  { name: 'zip', type: String, defaultOption: true },
  { name: 'delay', type: Number, defaultValue: 30 },
];

const options = commandLineArgs(optionDefinitions);
console.log(options);

const partNumbers = {
  'x': {
    'gray': {
      '64': "",
      '256': "MQAU2LL/A",
    },
    'silver': {
      '64': "",
      '256': "",
    },
  },
  '8': {
    'gray': {
      '64': "",
      '256': "MQ932LL/A",
    },
    'silver': {
      '64': "",
      '256': "",
    },
  },
};

const partNumber = partNumbers[options.model][options.color][options.storage];

const endpoint = `https://www.apple.com/shop/retail/pickup-message?pl=true&cppart=${options.carrier}/US&parts.0=${partNumber}&location=${options.zip}`;
// const endpoint = 'https://www.apple.com/shop/retail/pickup-message?pl=true&cppart=TMOBILE/US&parts.0=MQ932LL/A&location=Salem,%20NH';

let requestsMade = 0;

makeRequest();

function checkAvailability(data) {
  const { stores } = data.body;

  const storesAvailable = stores.filter(store => {
    const parts = Object.values(store.partsAvailability);
    const part = parts[0];
    const pickupDisplay = part.pickupDisplay;
    const availability = pickupDisplay === 'available';
    return availability;
  });

  if (storesAvailable.length > 0) {
    console.log(`Available at ${storesAvailable.length} stores near you:`);
    console.log(storesAvailable.map(store => `${store.address.address} which is ${store.storeDistanceWithUnit} away`).reduce((msg,store) => `${msg}\n${store}`));
    process.exit();
  } else {
    displayResultInPlace("unavailable");
    setTimeout(() => {
      makeRequest();
      requestsMade++;
    }, options.delay * 1000);
  }
}

function makeRequest() {
  fetch(endpoint)
  .then(stream => stream.json())
  .then(data => checkAvailability(data))
  .catch(error => console.log('Fetch Error :-S', error));
}

function displayResultInPlace(data) {
  process.stdout.write(`${data} --- req: ${requestsMade}\r`);
}
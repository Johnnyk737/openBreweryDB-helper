const XLSX = require('xlsx');
const fs = require('fs');

const inputFileName = 'data/ireland-breweries.json';
const countyBreweryMap = new Map();

// Generate obdb_id by name + city, removing spaces and special characters, and adding '-' for empty spaces
// ex:
//    "name": "10-56 Brewing Company"
//    "city": "Knox"
// -> "obdb_id": "10-56-brewing-company-knox"
//
//    "name": "10 Barrel Brewing Co - Bend Pub"
//    "city": "Bend",
// -> "obdb_id": "10-barrel-brewing-co-bend-pub-bend"
function getObdbId(brewery) {
  let name = brewery.name;
  let strippedName = name.replace(/[^A-Za-z0-9 ]/g, '');
  let id = (strippedName.toLowerCase() + ` ${brewery.city.toLowerCase()}`).split(' ').filter(a=>a.length > 0).join('-');
  // console.log(id)
  return id != null || id != undefined || id.length > 0 ? id : '';
}

function addToMap(brewery) {
  let county = brewery.county_province;
  if (!countyBreweryMap.has(county)) {
    countyBreweryMap.set(county, [brewery]);
  } else if (!countyBreweryMap.get(county).includes(brewery)) {
    countyBreweryMap.get(county).push(brewery);
  }
}

function validateBreweryType(breweryType) {
  const BREWERY_TYPES = [
    "micro",
    "nano",
    "regional",
    "brewpub",
    "large",
    "planning",
    "bar",
    "contract",
    "proprietor",
    "taproom",
    "closed",
  ];

  return BREWERY_TYPES.includes(breweryType)
}

// Do basic data validation
function validateField(field) {
  return (field != undefined && field != null) && field.length > 0
}

function main() {
  let breweriesNotEnoughInfo = [];
  // get json
  let data = JSON.parse(fs.readFileSync(inputFileName));

  // Date format: YYYY-MM-DD -> 2020-10-12
  let currentDate = new Date();
  let month = currentDate.getMonth() < 10 ? `0${currentDate.getMonth()}` : currentDate.getMonth()
  let day = currentDate.getDate() < 10 ? `0${currentDate.getDate()}` : currentDate.getDate()
  let formattedDate = `${currentDate.getFullYear()}-${month}-${day}`

  // required properties
  // name, street, brewery_type, city, state (or county_province), postal_code, and country
  data.forEach(obj => {
    if (validateField(obj.name) &&
        validateField(obj.street) &&
        validateBreweryType(obj.brewery_type) &&
        validateField(obj.city) &&
        (validateField(obj.state) || validateField(obj.county_province)) &&
        validateField(obj.postal_code) &&
        validateField(obj.country)
    ) {
      // build odbd_id and add as property
      obj.updated_at = formattedDate
      obj.created_at = formattedDate
      obj.obdb_id = getObdbId(obj)
      obj.tags = ""
      addToMap(obj)
    } else {
      // console.log(`brewery is missing data: ${JSON.stringify(obj)}`)
      breweriesNotEnoughInfo.push(obj)
    }
  });

  // console.log(countyBreweryMap);

  for (let county of countyBreweryMap.keys()) {
    let filename = `${county.toLowerCase()}.csv`;

    // sort by obdb_id
    let breweries = countyBreweryMap.get(county);
    let sortedBreweries = breweries.sort((a, b) => a.obdb_id.localeCompare(b.obdb_id))
    
    let sheet = XLSX.utils.json_to_sheet(sortedBreweries)
    let csv = XLSX.utils.sheet_to_csv(sheet);

    if (!fs.existsSync('output/')) {
      fs.mkdirSync('output/')
    } 
    
    fs.writeFileSync(`output/${filename}`, csv);
  }

  if (breweriesNotEnoughInfo.length > 0) {
    fs.writeFileSync('data/breweries_with_missing_data.json', JSON.stringify(breweriesNotEnoughInfo, null, 2));
  }
};

main();

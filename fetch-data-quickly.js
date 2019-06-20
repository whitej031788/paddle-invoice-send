// Load the SDK for JavaScript
const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-2'});

// Create DynamoDB service object
const ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
const config = require('./config.json');

// The below currenctly successfully gets contracts for a certain day
// and returns them in the data.Items array; important note, each value is
// an object as written, like { "S" : "USD" }

ddb.scan({
  TableName : config.DDB_TABLE_NAME,
  FilterExpression: "contract_start_date = :contract_start_date",
  ExpressionAttributeValues: {
      ":contract_start_date": {
          "S": "2019-06-20"
      }
  }
}, function(err, data) {
  console.log(JSON.stringify(data.Items));
});
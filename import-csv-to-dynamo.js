const csvFilePath = 'test-file.csv';
const csv = require('csvtojson');
const crypto = require('crypto');

// Load the SDK for JavaScript
const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-2'});

// Create DynamoDB service object
const ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
const config = require('./config.json');

// Prepare DynamoDB write params
let writeItem = {};
writeItem.RequestItems = {};
writeItem.RequestItems[config.DDB_TABLE_NAME] = [];

// Create a JSON array from a CSV file using csvtojson library
csv()
.fromFile(csvFilePath)
.then((jsonObj) => {
    let tmpArr = [];
    for (let i = 0; i < jsonObj.length; i) {
        if (tmpArr.length < config.DDB_BATCH_LIMIT) {
            let myId = generateIdFromRow(jsonObj[i]);
            tmpArr.push(generateDynamoObjectFromRow(jsonObj[i], myId));
            i++;
        } else {
            batchWriteItems(tmpArr);
            tmpArr = [];
        }
    }

    if (tmpArr.length > 0) {
        batchWriteItems(tmpArr);
        tmpArr = [];
    }
});

function batchWriteItems(arr) {
    writeItem.RequestItems[config.DDB_TABLE_NAME] = arr;
    ddb.batchWriteItem(writeItem, function(err, data) {
        if (err) {
            console.log("Error", err);
            arr = [];
            writeItem.RequestItems[config.DDB_TABLE_NAME] = [];
        } else {
            console.log("Success written " + arr.length + " items to DynamoDB\nHere are unprocessed data items: ", data);
            arr = [];
            writeItem.RequestItems[config.DDB_TABLE_NAME] = [];
        }
    }); 
}

function generateIdFromRow(row) {
    let string = row.company_name + row.contract_start_date + row.company_email + row.purchase_order_number;
    return crypto.createHash('md5').update(string).digest("hex");
}

function generateDynamoObjectFromRow(row, id) {
    let ddObj = {};
    ddObj.PutRequest = {};
    ddObj.PutRequest.Item = {};
    ddObj.PutRequest.Item.id = {"S" : id};
    for (var property in row) {
        if (row.hasOwnProperty(property)) {
            if (row[property]) {
                ddObj.PutRequest.Item[property] = { "S" : row[property]};
            }
        }
    }
    return ddObj;
}

// The below currenctly successfully gets contracts for a certain day
// and returns them in the data.Items array; important note, each value is
// an object as written, like { "S" : "USD" }
/*
ddb.scan({
    TableName : config.DDB_TABLE_NAME,
    FilterExpression: "contract_start_date = :contract_start_date",
    ExpressionAttributeValues: {
        ":contract_start_date": {
            "S": "2019-06-19"
        }
    }
}, function(err, data) {
    console.log(data.Items[0].contract_currency["S"]);
});
*/
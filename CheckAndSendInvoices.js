// Load the axios library for REST requests
const axios = require('axios');
// Load the SDK for JavaScript
const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-2'});

// Create DynamoDB service object
const ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
const config = require('./config.json');

const cognitoToken = "eyJraWQiOiJySXR3MHphZUpcLzBYYUJ3Q0FNblowekZhXC9TTDQ2UmxLKzJqSmF2SkhnbFE9IiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiIwY2U2MWYxNC1lNGE1LTQ2Y2EtYTkxOC1mN2EyYzg3NjY0NjAiLCJldmVudF9pZCI6ImI1OGU5NGE0LTNhNzMtNGYwMy04NGEwLTQ2MjhhOGFmNTg0NSIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE1NjA5NTk5MTQsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC51cy1lYXN0LTEuYW1hem9uYXdzLmNvbVwvdXMtZWFzdC0xX0g0a09sZTg5QiIsImV4cCI6MTU2MDk2NzQ5NCwiaWF0IjoxNTYwOTYzODk1LCJqdGkiOiI4OGIyOGI3Mi04M2FlLTQzYzctOWQ5ZS01MDA3OGM5MzkwY2YiLCJjbGllbnRfaWQiOiI0aW9rdDEzbWR0cXJnMDNoY3I0NGNnYzZocCIsInVzZXJuYW1lIjoiMGNlNjFmMTQtZTRhNS00NmNhLWE5MTgtZjdhMmM4NzY2NDYwIn0.HLhWyCjjn2O6Uw5ZKFPpiMoLmEB0p3AndxGdIKrsuI88s7wOvfwIfzDzR6U-Z-vdW0e16CDXH1odC0LMaUGFnSKHHwSlcPWvh_7hME9pQFRRnUl_Ppl3i7GMyfFUxLGOcmN9sqQ-SKpf1BqrAiNeZfSwFqD2o27roalXANXkiaU8SNIrq9YpaJd1oqOG33FBHPGcgbegzl7SoINAtJXvayW_LENXideVB-nu3gMfi20isQ8_fX-pMwYHC0alU_tlNti88BKukCsL-7jvIMolhXqaD4cq0-B2Zmp6ePo3qw4vNnEJ1PQYX_9JjsCVz23aliAkD1PDIm8TTRLreTQy3A";

exports.lambdaHandler = (event, context) => {
    try {
        // The below currenctly successfully gets contracts for a certain day
        // and returns them in the data.Items array; important note, each value is
        // an object as written, like { "S" : "USD" }
        ddb.scan({
            TableName : config.DDB_TABLE_NAME,
            FilterExpression: "contract_start_date = :contract_start_date",
            ExpressionAttributeValues: {
                ":contract_start_date": {
                    "S": formatDate()
                }
            }
        }, function(err, data) {
            if (err) {
                console.log('Error in DynamoDB scan: ', err);
                return err;
            } else {
                callPaddleApi(data.Items);
                return data.Items;
            }
        });
    } catch (err) {
        console.log(err);
        return err;
    }
};

const callPaddleApi = async(invoices) => {
    for (let i = 0; i < invoices.length; i++) {
        if (!invoices[i].paddle_buyer_id) {
            await createBuyerPromiseSingleItem(invoices[i]).then((response) => {
                console.log(response.data);
                // Add new Paddle Buyer ID to the object
                invoices[i].paddle_buyer_id = { "S" : response.data.id};
                createContractPromiseSingleItem(invoices[i]).then((response) => {
                    console.log(response);
                });
            });
        }
    }
}

function generateDynamoObjectFromItemAndSave(item) {
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

function createContractPromiseSingleItem(item) {
    return new Promise((resolve, reject) => {
        axios({
            method: 'POST',
            url: 'https://vendors.staging.paddle-internal.com/api/2.1/invoicing/contracts',
            data: formatContractItemForPost(item),
            headers: { Authorization: 'Bearer ' + cognitoToken }
        })
        .then(function (response) {
            //handle success
            return resolve(response);
        })
        .catch(function (error) {
            //handle error
            console.log(error);
            return reject(error);
        });
    });
}

function createBuyerPromiseSingleItem(item) {
    return new Promise((resolve, reject) => {
        axios({
            method: 'POST',
            url: 'https://vendors.staging.paddle-internal.com/api/2.1/invoicing/buyers',
            data: formatBuyerItemForPost(item),
            headers: { Authorization: 'Bearer ' + cognitoToken }
        })
        .then(function (response) {
            //handle success
            return resolve(response);
        })
        .catch(function (error) {
            //handle error
            console.log(error);
            return reject(error);
        });
    });
}

function formatContractItemForPost(item) {
    let retObj = {};
    retObj.start_date = item.contract_start_date["S"];
    retObj.end_date = item.contract_end_date["S"];
    retObj.buyer_id = parseInt(item.paddle_buyer_id["S"]);
    return retObj;
}

function formatBuyerItemForPost(item) {
    let retObj = {};
    retObj.name = item.company_name["S"];
    retObj.email = item.company_email["S"];
    // retObj.vat_number = ""; Don't have valid VAT numbers, exclude
    retObj.company_number = item.company_number["S"];
    retObj.address = item.company_address["S"];
    retObj.city = item.company_city["S"];
    retObj.state = item.company_state["S"];
    retObj.postcode = item.company_postcode["S"];
    retObj.country_id = 223; // This is US country_id in our DB, need to create mapping table for this
    return retObj;
}

function formatDate(date) {
    var d = date ? new Date(date) : new Date(),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}